/** Starts battles, wires the core to the scene/UI (and network), and applies results. */
import { bus } from '../core/events';
import { G } from '../core/game';
import { wait } from '../core/util';
import { itemName, ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { iconURL } from '../art/iconArt';
import { audio } from '../systems/audio';
import { h, Layer, btn } from '../ui/dom';
import { touch } from '../ui/touch';
import { hud } from '../ui/hud';
import { BattleCore, fighterFromEnemy, fighterFromMember, type BattleIO } from './battleCore';
import { BattleScene } from './battleScene';
import { battleUI } from './battleUI';
import type { BattleOutcome, BattleSetup, CommandSpec, Fighter, FxStep, GuardResult, MenuChoice, Quality } from './battleTypes';

/** Network hooks installed by the multiplayer session. */
export const battleNet = {
  broadcast: (_ev: any): void => {},
  ask: (_key: string, _kind: 'menu' | 'command' | 'guard', _data: any): Promise<any> => Promise.resolve(null),
};

let active = false;
export const battleActive = () => active;

function scene(): BattleScene {
  return G.game.scene.getScene('Battle') as BattleScene;
}

async function launchScene(themeId: string, party: Fighter[], enemies: Fighter[]): Promise<BattleScene> {
  const sc = scene();
  await new Promise<void>((resolve) => {
    sc.onReady = () => resolve();
    if (G.game.scene.isActive('World')) G.game.scene.pause('World');
    G.game.scene.run('Battle', { themeId, party, enemies });
  });
  touch.setActive(true, 'battle');
  hud.setVisible(false);
  return sc;
}

function closeScene(): void {
  battleUI.unmount();
  touch.setActive(true, 'field');
  hud.setVisible(true);
  G.game.scene.stop('Battle');
  if (G.game.scene.isPaused('World')) G.game.scene.resume('World');
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/* ======================= Authority ======================= */

export interface BattleRequest {
  encounter: string[];
  boss?: boolean;
  music?: string;
  themeId: string;
  first: 'party' | 'enemy' | null;
  firstKind?: 'hammer' | 'jump';
}

export async function runBattle(req: BattleRequest): Promise<BattleOutcome> {
  active = true;
  const members = G.buildParty();
  const party = members.map(fighterFromMember);
  for (const p of party) if (p.hp <= 0) p.hp = 1;
  const enemies = req.encounter.map(fighterFromEnemy);
  const music = req.music ?? (req.boss ? 'boss' : 'battle');
  const setup: BattleSetup = { party, enemies, boss: !!req.boss, music, themeId: req.themeId, first: req.first, firstKind: req.firstKind };
  const prevMusic = audio.currentSong;
  audio.sfx('battleStart');
  audio.playMusic(music);
  await flashTransition();
  if (G.mode === 'multi') battleNet.broadcast({ k: 'start', setup: clone(setup) });
  const sc = await launchScene(req.themeId, clone(party), clone(enemies));
  battleUI.mount();
  battleUI.updateParty(party, null);

  const localKey = G.mode === 'multi' ? G.net!.localKey : 'local';
  const isLocal = (controller: string) => controller === 'local' || controller === localKey;
  let core: BattleCore;
  const io: BattleIO = {
    async menu(f) {
      battleUI.updateParty(core.party, f.id);
      sc.highlight(f.id);
      let choice: MenuChoice | null;
      if (isLocal(f.controller)) choice = await battleUI.menu(menuCtx(core, f, sc));
      else {
        battleUI.showWaiting(`等待 ${f.name} 選擇行動…`);
        battleNet.broadcast({ k: 'turn', who: f.id });
        choice = await battleNet.ask(f.controller, 'menu', { fighter: f.id });
        battleUI.clearMenu();
      }
      sc.highlight(null);
      if (!choice || core.canUse(f, choice)) return { kind: 'defend' };
      return choice;
    },
    async command(controller, spec) {
      if (isLocal(controller)) return sc.command(spec);
      battleUI.showWaiting('對方正在挑戰按鍵時機…');
      const r = await battleNet.ask(controller, 'command', spec);
      battleUI.clearMenu();
      return (r ?? 'ok') as Quality | number;
    },
    async guard(controller, spec) {
      if (isLocal(controller)) return sc.guard(spec);
      const r = await battleNet.ask(controller, 'guard', spec);
      return (r ?? 'fail') as GuardResult;
    },
    async play(steps) {
      if (G.mode === 'multi') battleNet.broadcast({ k: 'play', steps: clone(steps) });
      await sc.play(steps);
      sc.applySnapshot(clone(core.all));
      battleUI.updateParty(core.party, null);
    },
    sync(c) {
      const snap = clone(c.all);
      if (G.mode === 'multi') battleNet.broadcast({ k: 'sync', fighters: snap, darkness: c.darkness });
      sc.applySnapshot(snap);
      sc.setDarkness(c.darkness);
      battleUI.updateParty(c.party, null);
    },
  };
  core = new BattleCore(setup, io);
  if (import.meta.env.DEV) (window as any).__battle = core;
  let outcome: BattleOutcome;
  try {
    outcome = await core.run();
  } catch (e) {
    console.error('battle error', e);
    outcome = { result: 'flee', reward: { exp: 0, coins: 0, items: [], kills: {} }, party: core.party.map((p) => ({ id: p.id, hp: Math.max(1, p.hp), sp: p.sp })) };
  }

  await applyOutcome(outcome, core);
  if (G.mode === 'multi') battleNet.broadcast({ k: 'end', outcome: clone(outcome) });
  await showResults(outcome);
  closeScene();
  audio.playMusic(prevMusic || 'village');
  active = false;
  bus.emit('battle:ended', outcome);
  return outcome;
}

function menuCtx(core: BattleCore, f: Fighter, sc: BattleScene) {
  return {
    fighter: f, party: core.party, enemies: core.enemies, boss: core.setup.boss, teamUnlocked: core.teamUnlocked,
    skillCost: (id: string) => core.skillCost(SKILLS[id]), highlight: (id: string | null) => sc.highlight(id),
  };
}

async function applyOutcome(o: BattleOutcome, core: BattleCore): Promise<void> {
  // vitals
  if (G.mode === 'single') {
    const hp: Record<string, number> = {}, sp: Record<string, number> = {};
    for (const p of o.party) {
      const key = p.id.slice(2);
      hp[key] = o.result === 'lose' ? 0 : Math.max(1, p.hp);
      sp[key] = p.sp;
    }
    G.dispatch({ a: 'partyVitals', hp, sp });
  } else if (G.net?.isHost) {
    const fhp: Record<string, number> = {}, fsp: Record<string, number> = {};
    for (const p of o.party) {
      const r = G.net.roster.find((x) => 'p:' + x.key === p.id);
      if (r) { r.hp = o.result === 'lose' ? Math.ceil(r.stats.maxHP / 2) : Math.max(1, p.hp); r.sp = p.sp; }
      else { fhp[p.id.slice(2)] = Math.max(1, p.hp); fsp[p.id.slice(2)] = p.sp; } // the follower
    }
    if (Object.keys(fhp).length) G.dispatch({ a: 'partyVitals', hp: fhp, sp: fsp });
    bus.emit('net:rosterDirty');
  }
  if (o.result !== 'win') return;
  for (const [eid, n] of Object.entries(o.reward.kills)) G.dispatch({ a: 'kill', enemy: eid, n });
  if (o.reward.coins) G.dispatch({ a: 'coins', n: o.reward.coins });
  for (const it of o.reward.items) G.dispatch({ a: 'give', item: it.id, qty: it.qty, silent: true });
  G.dispatch({ a: 'battleWon' });
  G.dispatch({ a: 'exp', n: o.reward.exp });
  void core;
}

let levelUps: { level: number; newSkills: string[] }[] = [];
bus.on('levelup', (d: { level: number; newSkills: string[] }) => levelUps.push(d));

async function showResults(o: BattleOutcome): Promise<void> {
  await wait(250);
  const layer = new Layer('battle-result', true);
  let resolveFn: () => void = () => {};
  const done = new Promise<void>((r) => (resolveFn = r));
  const close = () => { layer.close(); resolveFn(); };
  layer.onCancel = close;
  const card = h('div', { class: 'paper-card result-card' });
  if (o.result === 'win') {
    audio.playMusic('victory');
    card.append(h('h2', { class: 'result-title win' }, '勝利！'));
    card.append(h('div', { class: 'result-row' }, `獲得經驗值 ${o.reward.exp}`), h('div', { class: 'result-row' }, `獲得金幣 ${o.reward.coins}`));
    for (const it of o.reward.items) card.append(h('div', { class: 'result-row item' }, h('img', { src: iconURL(ITEMS[it.id].icon, it.id), alt: '' }), `${itemName(it.id)} ×${it.qty}`));
    await wait(30);
    for (const lu of levelUps) {
      audio.sfx('levelup');
      card.append(h('div', { class: 'result-levelup' }, `等級提升！ Lv.${lu.level}`));
      for (const s of lu.newSkills) card.append(h('div', { class: 'result-row' }, `學會了新技能「${SKILLS[s]?.name ?? s}」！`));
    }
  } else if (o.result === 'flee') {
    card.append(h('h2', { class: 'result-title' }, '逃跑成功'));
  } else {
    audio.sfx('defeat');
    audio.stopMusic(0.5);
    card.append(h('h2', { class: 'result-title lose' }, '全員倒下了…'));
    if (G.mode === 'multi') card.append(h('div', { class: 'result-row' }, '大家互相扶持，重新站了起來！（HP 回復一半）'));
  }
  levelUps = [];
  card.append(h('div', { class: 'row' }, btn('繼續', close, { cls: 'primary' })));
  layer.el.append(card);
  layer.open();
  const auto = setTimeout(close, o.result === 'win' ? 12000 : 8000);
  await done;
  clearTimeout(auto);
}

async function flashTransition(): Promise<void> {
  const el = h('div', { class: 'battle-flash' });
  document.getElementById('fx-overlay')!.append(el);
  await wait(450);
  setTimeout(() => el.remove(), 600);
}

/* ======================= Multiplayer client ======================= */

let clientScene: BattleScene | null = null;
let clientQueue: Promise<void> = Promise.resolve();
let clientParty: Fighter[] = [];
let clientEnemies: Fighter[] = [];
let clientTeam = false;
let clientPrevMusic = '';

export function clientBattleEvent(ev: any): void {
  clientQueue = clientQueue.then(() => handleClientEvent(ev)).catch((e) => console.error(e));
}

async function handleClientEvent(ev: any): Promise<void> {
  switch (ev.k) {
    case 'start': {
      active = true;
      const s: BattleSetup = ev.setup;
      clientPrevMusic = audio.currentSong;
      audio.sfx('battleStart');
      audio.playMusic(s.music);
      await flashTransition();
      clientParty = s.party;
      clientEnemies = s.enemies;
      clientTeam = false;
      clientScene = await launchScene(s.themeId, s.party, s.enemies);
      battleUI.mount();
      battleUI.updateParty(s.party, null);
      (clientScene as any)._boss = s.boss;
      break;
    }
    case 'play':
      if (clientScene) {
        void clientScene.play(ev.steps as FxStep[]);
        if ((ev.steps as FxStep[]).some((x) => x.t === 'text' && x.text.includes('合奏'))) clientTeam = true;
      }
      break;
    case 'sync':
      clientParty = (ev.fighters as Fighter[]).filter((f) => f.side === 'party');
      clientEnemies = (ev.fighters as Fighter[]).filter((f) => f.side === 'enemy');
      clientScene?.applySnapshot(ev.fighters);
      clientScene?.setDarkness(!!ev.darkness);
      battleUI.updateParty(clientParty, null);
      break;
    case 'turn':
      battleUI.updateParty(clientParty, ev.who);
      break;
    case 'end': {
      const o = ev.outcome as BattleOutcome;
      await (clientScene ? clientScene.play([]) : Promise.resolve());
      await showResults(o);
      closeScene();
      clientScene = null;
      audio.playMusic(clientPrevMusic || 'village');
      active = false;
      bus.emit('battle:ended', o);
      break;
    }
  }
}

/** Host asks this client for input. */
export async function clientAnswer(kind: 'menu' | 'command' | 'guard', data: any): Promise<any> {
  await clientQueue;
  const sc = clientScene;
  if (!sc) return null;
  if (kind === 'menu') {
    const f = clientParty.find((x) => x.id === data.fighter);
    if (!f) return { kind: 'defend' };
    battleUI.updateParty(clientParty, f.id);
    const darkness = false;
    return battleUI.menu({
      fighter: f, party: clientParty, enemies: clientEnemies, boss: !!(sc as any)._boss, teamUnlocked: clientTeam,
      skillCost: (id: string) => (darkness ? Math.ceil(SKILLS[id].sp * 1.5) : SKILLS[id].sp), highlight: (id) => sc.highlight(id),
    });
  }
  if (kind === 'command') return sc.command(data as CommandSpec);
  if (kind === 'guard') return sc.guard(data);
  return null;
}
