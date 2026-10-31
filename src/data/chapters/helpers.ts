import type { BookPage, CharId, Expr, NpcLook, ScriptStep } from '../types';

/** Dialogue line. */
export const L = (who: string, text: string, face?: Expr): ScriptStep => ({ who, text, face });
/** Narration. */
export const N = (text: string): ScriptStep => ({ who: 'narrator', text });
export const FLAG = (key: string, value: boolean | number | string = true): ScriptStep => ({ do: 'flag', key, value });
export const QS = (id: string): ScriptStep => ({ do: 'quest', start: id });
export const GIVE = (item: string, qty = 1): ScriptStep => ({ do: 'give', item, qty });
export const TAKE = (item: string, qty = 1): ScriptStep => ({ do: 'take', item, qty });
export const JOIN = (partner: CharId): ScriptStep => ({ do: 'join', partner });
export const SFX = (id: string): ScriptStep => ({ do: 'sfx', id });
export const EMOTE = (actor: string, emote: string): ScriptStep => ({ do: 'emote', actor, emote });
export const SHAKE = (ms = 500): ScriptStep => ({ do: 'shake', ms });
export const FLASH = (color = 0xffffff): ScriptStep => ({ do: 'flash', color });
export const WAIT = (ms: number): ScriptStep => ({ do: 'wait', ms });
export const MUSIC = (id: string): ScriptStep => ({ do: 'music', id });
export const IF = (c: string, then: ScriptStep[], els?: ScriptStep[]): ScriptStep => ({ if: c, then, else: els });

/* ---- staging helpers ---- */
export const CINE = (on = true): ScriptStep => ({ do: 'cinema', on });
export const PAN = (x: number, ms = 1200, nowait = false): ScriptStep => ({ do: 'pan', x, ms, nowait });
export const FOLLOW = (ms = 600): ScriptStep => ({ do: 'follow', ms });
export const ZOOM = (z: number, ms = 800): ScriptStep => ({ do: 'zoom', z, ms });
export const CAP = (text: string, ms = 2600): ScriptStep => ({ do: 'caption', text, ms });
export const BANNER = (title: string, sub?: string): ScriptStep => ({ do: 'banner', title, sub });
export const SPAWN = (actor: string, look: string | NpcLook, x: number, z = 130, opts: { dark?: boolean; dir?: 1 | -1; fx?: string } = {}): ScriptStep => ({ do: 'spawn', actor, look, x, z, ...opts });
export const DESPAWN = (actor: string, fx?: string): ScriptStep => ({ do: 'despawn', actor, fx });
/** Walk (waits until arrived). */
export const WALK = (actor: string, x: number, z?: number): ScriptStep => ({ do: 'walk', actor, x, z });
/** Run (waits until arrived). */
export const RUN = (actor: string, x: number, z?: number): ScriptStep => ({ do: 'walk', actor, x, z, run: true });
/** Walk without waiting (several actors moving together). */
export const WALKN = (actor: string, x: number, z?: number, run = false): ScriptStep => ({ do: 'walk', actor, x, z, run, nowait: true });
export const PLACE = (actor: string, x: number, z?: number): ScriptStep => ({ do: 'place', actor, x, z });
export const FACE = (actor: string, dir: 1 | -1): ScriptStep => ({ do: 'face', actor, dir });
export const JUMP = (actor: string): ScriptStep => ({ do: 'jump', actor });
export const ANIM = (actor: string, anim: string, ms = 900): ScriptStep => ({ do: 'anim', actor, anim, ms });
export const BOUNCE = (actor: string, n = 2): ScriptStep => ({ do: 'bounce', actor, n });
export const SHIVER = (actor: string, ms = 700): ScriptStep => ({ do: 'shiver', actor, ms });
export const FX = (name: string, actor?: string, x?: number): ScriptStep => ({ do: 'fx', name, actor, x });
/** All unlocked partners step out and stand next to the hero for a scene (single player). */
export const GATHER = (on = true): ScriptStep => ({ do: 'gather', on });
export const CARD = (title: string, sub?: string, opts: { enemy?: string; look?: string; color?: string } = {}): ScriptStep => ({ do: 'card', title, sub, ...opts });
export const BOOK = (...pages: BookPage[]): ScriptStep => ({ do: 'book', pages });
export const COLOR = (sat: number, ms = 1500, wave = false): ScriptStep => ({ do: 'color', sat, ms, wave });
export const CHASE = (id: string): ScriptStep => ({ do: 'chase', id });
export const GAME = (id: string): ScriptStep => ({ do: 'minigame', id });
export const INTERLUDE = (id: string): ScriptStep => ({ do: 'interlude', id });
/** A party member's line that only plays if that partner has joined (single player) — always in multiplayer. */
export const PL = (who: CharId, text: string, face?: Expr): ScriptStep => ({ if: `joined:${who}`, then: [{ who, text, face }] });

/** Speakers that are not playable characters or map NPCs. */
export const SPEAKERS: Record<string, { name: string; look: CharId | NpcLook; dark?: boolean }> = {
  eternatchi: { name: '永恆吉', look: { species: 'eternatchi', color: '#fffbe6', accent: '#5b35b5', size: 1.05 } },
  shadow: { name: '戴王冠的影子', look: { species: 'eternatchi', color: '#202030', accent: '#8000ff' }, dark: true },
  dahui: { name: '大灰', look: { species: 'dahui', color: '#aeb0bc', accent: '#5a5c6e' } },
  xiaohui: { name: '小灰', look: { species: 'xiaohui', color: '#cfd0d8', accent: '#7a5aa0' } },
  lumi: { name: '小光', look: { species: 'lumi', color: '#fff6a8', accent: '#ffd84a' } },
  young_eter: { name: '年輕的永恆吉', look: { species: 'young_eter', color: '#fffbe6', accent: '#5b35b5' } },
  dark_mametchi: { name: '黑暗麻每吉', look: 'mametchi', dark: true },
  guardian_voice: { name: '星之心的聲音', look: { species: 'lumi', color: '#fff6a8', accent: '#ff80c0', hat: 'flower', size: 0.9 } },
  villager: { name: '村民', look: { species: 'nikatchi', color: '#ffe561', accent: '#804000' } },
};

/** Villager look presets. */
export const LOOKS = {
  baker: { species: 'tarakotchi', color: '#ffb98a', accent: '#ffffff', hat: 'chef' } as NpcLook,
  kid: { species: 'youngmametchi', color: '#fff3a0', accent: '#4aa3e6' } as NpcLook,
  guard: { species: 'hashizotchi', color: '#f068a8', accent: '#ff3a3a', hat: 'helmet' } as NpcLook,
  granny: { species: 'furawatchi', color: '#ffa6d4', accent: '#8080ff', glasses: true } as NpcLook,
  farmer: { species: 'ringotchi', color: '#e5383b', accent: '#5bbf4a' } as NpcLook,
  sailor: { species: 'debatchi', color: '#ffe23a', accent: '#2f6ad8', hat: 'cap' } as NpcLook,
  ghost: { species: 'drotchi', color: '#ffffff', accent: '#3f9cff' } as NpcLook,
  mermaid: { species: 'ichigotchi', color: '#ff4d5e', accent: '#ff80ff', hat: 'flower' } as NpcLook,
  robot: { species: 'robotchi', color: '#c2c6d0', accent: '#ff4a4a' } as NpcLook,
  sage: { species: 'wooltchi', color: '#ffffff', accent: '#7d58d8', mustache: true } as NpcLook,
  light: { species: 'lumi', color: '#fff6a8', accent: '#ffd84a', size: 0.7 } as NpcLook,
  king: { species: 'nikatchi', color: '#ffe561', accent: '#ff0000', hat: 'crown' } as NpcLook,
  cloudling: { species: 'wooltchi', color: '#ffffff', accent: '#80c0ff' } as NpcLook,
  /* extra villagers so every town has the whole Tamagotchi crowd */
  fire: { species: 'hinotamatchi', color: '#ff5536', accent: '#ffb02e' } as NpcLook,
  smallMimi: { species: 'youngmimitchi', color: '#ffffff', accent: '#5db7ee' } as NpcLook,
};
