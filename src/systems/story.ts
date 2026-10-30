/** Executes data-driven story scripts (dialogue + events). Runs on the authority only. */
import { G } from '../core/game';
import { hashString } from '../core/util';
import { renderEnemyFrame } from '../art/enemyArt';
import { portraitURL } from '../art/textures';
import type { DrawTarget } from '../art/characterArt';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { SPEAKERS } from '../data/chapters/helpers';
import type { ChapterDef, CharId, Expr, Script, ScriptStep } from '../data/types';
import { dialogue, type Line } from '../ui/dialogueBox';
import { audio } from './audio';

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

export function storyRunning(): boolean {
  return running;
}

/** Runs a script. Resolves true when finished, false when aborted (e.g. battle lost). */
export async function runScript(script: Script, host: StoryHost): Promise<boolean> {
  if (running) return false;
  running = true;
  dialogue.canAdvance = true;
  dialogue.onAdvance = () => host.broadcastDialogue?.('adv');
  dialogue.onSkip = () => host.broadcastDialogue?.('skip');
  try {
    await exec(script, host);
    return true;
  } catch (e) {
    if (!(e instanceof ScriptAbort)) console.error(e);
    return false;
  } finally {
    dialogue.hide();
    dialogue.onAdvance = null;
    dialogue.onSkip = null;
    host.broadcastDialogue?.('end');
    running = false;
  }
}

async function exec(steps: ScriptStep[], host: StoryHost): Promise<void> {
  const labels = new Map<string, number>();
  steps.forEach((s, i) => { if ('label' in s) labels.set(s.label, i); });
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if ('who' in s && 'text' in s) {
      if (dialogue.skipping) continue;
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
      await exec(G.cond(s.if) ? s.then : s.else ?? [], host);
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
      case 'wait': await new Promise((r) => setTimeout(r, dialogue.skipping ? 0 : s.ms)); break;
      case 'emote': host.emote(s.actor, s.emote); host.broadcastFx?.('emote', { actor: s.actor, emote: s.emote }); break;
      case 'move': await host.moveActor(s.actor, s.x, s.z); break;
      case 'hide': host.setActorVisible(s.actor, false); break;
      case 'show': host.setActorVisible(s.actor, true); break;
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
