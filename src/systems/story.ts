/** Executes data-driven story scripts (dialogue + events). Runs on the authority only. */
import { G } from '../core/game';
import { hashString } from '../core/util';
import { renderEnemyFrame } from '../art/enemyArt';
import { portraitURL } from '../art/textures';
import type { DrawTarget } from '../art/characterArt';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { SPEAKERS } from '../data/chapters/helpers';
import type { ChapterDef, CharId, Expr, NpcLook, Script, ScriptStep } from '../data/types';
import { dialogue, type Line } from '../ui/dialogueBox';
import { audio } from './audio';
import { cinema } from '../ui/cinema';
import { playBook } from '../ui/storybook';

export interface StoryHost {
  chapter: ChapterDef;
  shake(ms: number): void;
  flash(color: number): void;
  emote(actor: string, emote: string): void;
  moveActor(actor: string, x: number, z?: number): Promise<void>;
  setActorVisible(actor: string, v: boolean): void;
  tint(color: number): void;
  battle(encounter: string[], opts: { boss?: boolean; music?: string }): Promise<'win' | 'lose' | 'flee'>;
  chapterEnd(): Promise<void>;
  ending(): Promise<void>;
  save(): void;
  // cutscene support
  cinema(on: boolean): void;
  pan(x: number, ms: number): Promise<void>;
  follow(ms: number): Promise<void>;
  zoom(z: number, ms: number): Promise<void>;
  placeActor(actor: string, x: number, z?: number): void;
  jumpActor(actor: string): Promise<void>;
  animActor(actor: string, anim: string, ms: number): Promise<void>;
  faceActor(actor: string, dir: 1 | -1): void;
  fx(name: string, actor?: string, x?: number): Promise<void>;
  opening(): Promise<void>;
  // staging v2 (optional so a minimal host can skip them)
  spawnActor?(actor: string, look: string | NpcLook, x: number, z: number, dark?: boolean, dir?: 1 | -1, fx?: string): void;
  despawnActor?(actor: string, fx?: string): void;
  walkActor?(actor: string, x: number, z: number | undefined, run: boolean): Promise<void>;
  gather?(on: boolean): void;
  color?(sat: number, ms: number, wave: boolean): Promise<void>;
  interlude?(id: string): Promise<void>;
  startChase?(id: string): void;
  minigame?(id: string): Promise<void>;
  bounceActor?(actor: string, n: number): Promise<void>;
  shiverActor?(actor: string, ms: number): Promise<void>;
  /** Multiplayer: mirror dialogue to clients. */
  broadcastDialogue?(kind: 'line' | 'adv' | 'choice' | 'pick' | 'end' | 'skip', data?: any): void;
  broadcastFx?(kind: string, data: any): void;
}

export class ScriptAbort extends Error {}

const enemyPortraits = new Map<string, string>();

export interface SpeakerInfo { name: string; target: DrawTarget | null; enemy?: string; pitch: number; party: boolean }

export function resolveSpeaker(who: string, chapter: ChapterDef | null): SpeakerInfo {
  if (who === 'narrator') return { name: '', target: null, pitch: 1, party: false };
  const id = who === 'hero' ? G.heroChar : who;
  const pitch = 0.8 + (hashString(id) % 50) / 100;
  if (id in CHARACTERS) {
    const party = id === G.heroChar || G.state?.partners.unlocked.includes(id as CharId) || G.mode === 'multi';
    return { name: CHARACTERS[id as CharId].name, target: { charId: id as CharId }, pitch, party };
  }
  const npc = chapter?.npcs.find((n) => n.id === id);
  if (npc) {
    const t: DrawTarget = typeof npc.look === 'string' ? { charId: npc.look, dark: npc.dark } : { npc: npc.look, dark: npc.dark };
    return { name: npc.name, target: t, pitch, party: false };
  }
  const sp = SPEAKERS[id];
  if (sp) {
    const t: DrawTarget = typeof sp.look === 'string' ? { charId: sp.look, dark: sp.dark } : { npc: sp.look, dark: sp.dark };
    return { name: sp.name, target: t, pitch: id === 'eternatchi' ? 0.7 : pitch, party: false };
  }
  if (ENEMIES[id]) return { name: ENEMIES[id].name, target: null, enemy: id, pitch: 0.6, party: false };
  return { name: id, target: null, pitch, party: false };
}

export function speakerPortrait(sp: SpeakerInfo, face: Expr): string | null {
  if (sp.target) return portraitURL(sp.target, face);
  if (sp.enemy) {
    const k = sp.enemy + (face === 'angry' ? 'a' : face === 'hurt' || face === 'sad' ? 'h' : 'i');
    let u = enemyPortraits.get(k);
    if (!u) {
      const def = ENEMIES[sp.enemy];
      u = renderEnemyFrame(def.art, face === 'angry' ? 'attack' : face === 'hurt' || face === 'sad' ? 'hurt' : 'idle0', def.traits.includes('spiky'), sp.enemy).toDataURL();
      enemyPortraits.set(k, u);
    }
    return u;
  }
  return null;
}

/** Builds a displayable line (also used by multiplayer clients from host data). */
export function buildLine(who: string, text: string, face: Expr | undefined, chapter: ChapterDef | null): Line {
  const sp = resolveSpeaker(who, chapter);
  return { name: sp.name, portrait: speakerPortrait(sp, face ?? 'normal'), text: G.fmt(text), pitch: sp.pitch, side: sp.party || !sp.name ? 'left' : 'right' };
}

let running = false;
let fastForward = false;
let lastActivity = 0;
/** Bumped by resetStory(): a script from an older epoch stops at its next step. */
let epoch = 0;

export function storyRunning(): boolean {
  return running;
}

/** Skip button on cutscenes: fast-forwards the rest of the running script (choices still asked). */
export function skipStory(): void {
  if (!running) return;
  fastForward = true;
  dialogue.requestSkip();
  cinema.clearCaption();
}

/** Seconds since the running script last did anything (watchdog for stuck scripts). */
export function storyIdleMs(): number {
  return running ? performance.now() - lastActivity : 0;
}

/** Emergency reset when a script got stuck (e.g. an awaited animation never finished). */
export function resetStory(): void {
  epoch++;
  running = false;
  fastForward = false;
  dialogue.hide();
  cinema.off();
}

const ff = () => fastForward || dialogue.skipping;
cinema.onSkip = skipStory;

/** Runs a script. Resolves true when finished, false when aborted (e.g. battle lost). */
export async function runScript(script: Script, host: StoryHost): Promise<boolean> {
  if (running) return false;
  running = true;
  fastForward = false;
  lastActivity = performance.now();
  const mine = epoch;
  dialogue.canAdvance = true;
  dialogue.onAdvance = () => host.broadcastDialogue?.('adv');
  dialogue.onSkip = () => host.broadcastDialogue?.('skip');
  try {
    await exec(script, host, mine);
    return true;
  } catch (e) {
    if (!(e instanceof ScriptAbort)) console.error(e);
    return false;
  } finally {
    // the scene that owned this script was torn down (chapter change, title…): leave the new state alone
    if (mine !== epoch) return false;
    dialogue.hide();
    dialogue.onAdvance = null;
    dialogue.onSkip = null;
    host.broadcastDialogue?.('end');
    // always release the cutscene state (cinema may already have been switched off elsewhere,
    // e.g. by a mini-game, which would otherwise leave the player locked)
    if (cinema.active) host.broadcastFx?.('cinema', false);
    host.cinema(false);
    void host.follow(0);
    running = false;
    fastForward = false;
  }
}

/**
 * Runs a script inside the currently running one (interludes played from a chapter's outro).
 * Skipping the outer cutscene does not skip the nested one.
 */
export async function runNested(script: Script, host: StoryHost): Promise<void> {
  const ff0 = fastForward;
  fastForward = false;
  dialogue.endSkip();
  try {
    await exec(script, host, epoch);
  } finally {
    fastForward = ff0;
  }
}

/** Card art for the `card` step: an enemy picture or a character portrait. */
function cardImage(s: { enemy?: string; look?: string }, chapter: ChapterDef | null): string | null {
  if (s.enemy) return speakerPortrait({ name: '', target: null, enemy: s.enemy, pitch: 1, party: false }, 'angry');
  if (s.look) return speakerPortrait(resolveSpeaker(s.look, chapter), 'determined');
  return null;
}

async function exec(steps: ScriptStep[], host: StoryHost, mine: number): Promise<void> {
  const labels = new Map<string, number>();
  steps.forEach((s, i) => { if ('label' in s) labels.set(s.label, i); });
  for (let i = 0; i < steps.length; i++) {
    if (mine !== epoch) throw new ScriptAbort('reset');
    const s = steps[i];
    lastActivity = performance.now();
    if ('who' in s && 'text' in s) {
      if (ff()) continue;
      const line = buildLine(s.who, s.text, s.face, host.chapter);
      host.broadcastDialogue?.('line', { who: s.who, text: s.text, face: s.face });
      await dialogue.say(line);
      continue;
    }
    if ('choice' in s) {
      // choices are never skipped
      const opts = s.choice.map((c) => c.text);
      host.broadcastDialogue?.('choice', { prompt: s.prompt ?? '', options: opts });
      const idx = await dialogue.choose(s.prompt ?? '', opts, true);
      host.broadcastDialogue?.('pick', { idx });
      const c = s.choice[idx];
      if (c.flag) G.dispatch({ a: 'flag', k: c.flag[0], v: c.flag[1] });
      if (c.goto && labels.has(c.goto)) i = labels.get(c.goto)!;
      continue;
    }
    if ('label' in s) continue;
    if ('goto' in s) {
      if (labels.has(s.goto)) i = labels.get(s.goto)!;
      continue;
    }
    if ('end' in s) return;
    if ('if' in s) {
      await exec(G.cond(s.if) ? s.then : s.else ?? [], host, mine);
      continue;
    }
    switch (s.do) {
      case 'flag': G.dispatch({ a: 'flag', k: s.key, v: s.value ?? true }); break;
      case 'give': G.dispatch({ a: 'give', item: s.item, qty: s.qty ?? 1 }); break;
      case 'take': G.dispatch({ a: 'take', item: s.item, qty: s.qty ?? 1 }); break;
      case 'coins': G.dispatch({ a: 'coins', n: s.amount }); break;
      case 'quest':
        if (s.start) G.dispatch({ a: 'questStart', id: s.start });
        if (s.complete) G.dispatch({ a: 'questDone', id: s.complete });
        break;
      case 'join': G.dispatch({ a: 'join', partner: s.partner }); break;
      case 'exp': G.dispatch({ a: 'exp', n: s.amount }); break;
      case 'heal': G.dispatch({ a: 'flag', k: '_healed', v: Date.now() }); break;
      case 'shake': host.shake(s.ms ?? 500); host.broadcastFx?.('shake', s.ms ?? 500); break;
      case 'flash': host.flash(s.color ?? 0xffffff); host.broadcastFx?.('flash', s.color ?? 0xffffff); break;
      case 'sfx': audio.sfx(s.id); host.broadcastFx?.('sfx', s.id); break;
      case 'music': audio.playMusic(s.id); host.broadcastFx?.('music', s.id); break;
      case 'wait': await new Promise((r) => setTimeout(r, ff() ? 0 : s.ms)); break;
      case 'cinema': host.cinema(s.on); host.broadcastFx?.('cinema', s.on); break;
      case 'pan': {
        host.broadcastFx?.('pan', { x: s.x, ms: s.ms ?? 1200 });
        const p = host.pan(s.x, ff() ? 0 : s.ms ?? 1200);
        if (!s.nowait) await p;
        break;
      }
      case 'follow': host.broadcastFx?.('follow', s.ms ?? 600); await host.follow(ff() ? 0 : s.ms ?? 600); break;
      case 'zoom': host.broadcastFx?.('zoom', { z: s.z, ms: s.ms ?? 800 }); await host.zoom(s.z, ff() ? 0 : s.ms ?? 800); break;
      case 'place': host.broadcastFx?.('place', { actor: s.actor, x: s.x, z: s.z }); host.placeActor(s.actor, s.x, s.z); break;
      case 'jump': host.broadcastFx?.('jump', s.actor); if (!ff()) await host.jumpActor(s.actor); break;
      case 'anim': host.broadcastFx?.('anim', { actor: s.actor, anim: s.anim, ms: s.ms ?? 900 }); await host.animActor(s.actor, s.anim, ff() ? 0 : s.ms ?? 900); break;
      case 'face': host.broadcastFx?.('face', { actor: s.actor, dir: s.dir }); host.faceActor(s.actor, s.dir); break;
      case 'caption':
        host.broadcastFx?.('caption', { text: G.fmt(s.text), ms: s.ms ?? 2600 });
        if (!ff()) await cinema.caption(G.fmt(s.text), s.ms ?? 2600);
        break;
      case 'banner': host.broadcastFx?.('banner', { title: G.fmt(s.title), sub: s.sub }); if (!ff()) cinema.flashBanner(G.fmt(s.title), s.sub ? G.fmt(s.sub) : ''); break;
      case 'fx': host.broadcastFx?.('fx', { name: s.name, actor: s.actor, x: s.x }); if (!ff()) await host.fx(s.name, s.actor, s.x); break;
      case 'opening': if (!ff()) await host.opening(); break;
      case 'emote': host.emote(s.actor, s.emote); host.broadcastFx?.('emote', { actor: s.actor, emote: s.emote }); break;
      case 'move':
        host.broadcastFx?.('walk', { actor: s.actor, x: s.x, z: s.z, run: false });
        if (ff()) host.placeActor(s.actor, s.x, s.z); else await host.moveActor(s.actor, s.x, s.z);
        break;
      case 'walk': {
        host.broadcastFx?.('walk', { actor: s.actor, x: s.x, z: s.z, run: !!s.run });
        if (ff() || !host.walkActor) { host.placeActor(s.actor, s.x, s.z); break; }
        const p = host.walkActor(s.actor, s.x, s.z, !!s.run);
        if (!s.nowait) await p;
        break;
      }
      case 'spawn':
        host.broadcastFx?.('spawn', s);
        host.spawnActor?.(s.actor, s.look, s.x, s.z ?? 130, s.dark, s.dir, ff() ? undefined : s.fx);
        break;
      case 'despawn': host.broadcastFx?.('despawn', s); host.despawnActor?.(s.actor, ff() ? undefined : s.fx); break;
      case 'gather': host.broadcastFx?.('gather', s.on); host.gather?.(s.on); break;
      case 'bounce': host.broadcastFx?.('bounce', s); if (!ff()) await host.bounceActor?.(s.actor, s.n ?? 2); break;
      case 'shiver': host.broadcastFx?.('shiver', s); if (!ff()) await host.shiverActor?.(s.actor, s.ms ?? 700); break;
      case 'card': {
        const img = cardImage(s, host.chapter);
        const data = { title: G.fmt(s.title), sub: s.sub ? G.fmt(s.sub) : '', img, color: s.color };
        host.broadcastFx?.('card', data);
        if (!ff()) await cinema.nameCard(data.title, data.sub, img, s.color);
        break;
      }
      case 'book':
        host.broadcastFx?.('book', s.pages);
        if (!ff()) await playBook(s.pages, host.chapter);
        break;
      case 'color':
        host.broadcastFx?.('color', { sat: s.sat, ms: s.ms ?? 1500, wave: !!s.wave });
        await host.color?.(s.sat, ff() ? 0 : s.ms ?? 1500, !!s.wave && !ff());
        break;
      case 'interlude': if (host.interlude) await host.interlude(s.id); break;
      case 'chase': host.startChase?.(s.id); break;
      case 'minigame': if (host.minigame) await host.minigame(s.id); break;
      case 'hide': host.broadcastFx?.('visible', { actor: s.actor, v: false }); host.setActorVisible(s.actor, false); break;
      case 'show': host.broadcastFx?.('visible', { actor: s.actor, v: true }); host.setActorVisible(s.actor, true); break;
      case 'tint': host.tint(s.color); break;
      case 'save': host.save(); break;
      case 'battle': {
        dialogue.hide();
        host.broadcastDialogue?.('end');
        const res = await host.battle(s.encounter, { boss: s.boss, music: s.music });
        if (res !== 'win') throw new ScriptAbort('battle ' + res);
        if (s.flag) G.dispatch({ a: 'flag', k: s.flag, v: true });
        break;
      }
      case 'chapterEnd':
        dialogue.hide();
        host.broadcastDialogue?.('end');
        await host.chapterEnd();
        return;
      case 'ending':
        dialogue.hide();
        host.broadcastDialogue?.('end');
        await host.ending();
        return;
    }
  }
}
