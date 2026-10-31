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
  eternatchi: { name: '永恆吉', look: { color: '#ffffc0', accent: '#4000c0', ears: 'horn', hat: 'crown', size: 1.05 } },
  shadow: { name: '戴王冠的影子', look: { color: '#202030', accent: '#8000ff', ears: 'horn', hat: 'crown' }, dark: true },
  dahui: { name: '大灰', look: { color: '#a8a8b4', accent: '#5a5a6a', ears: 'round', hat: 'cap', size: 1.15 } },
  xiaohui: { name: '小灰', look: { color: '#c4c4cc', accent: '#7a5aa0', ears: 'pointy', glasses: true, size: 0.82 } },
  lumi: { name: '小光', look: { color: '#fff6a0', accent: '#ffb0d8', ears: 'none', size: 0.7 } },
  young_eter: { name: '年輕的永恆吉', look: { color: '#ffffc0', accent: '#4000c0', ears: 'horn', hat: 'crown' } },
  dark_mametchi: { name: '黑暗麻美吉', look: 'mametchi', dark: true },
  guardian_voice: { name: '星之心的聲音', look: { color: '#fff6a0', accent: '#ff80c0', ears: 'none', hat: 'flower' } },
  villager: { name: '村民', look: { color: '#ffc080', accent: '#804000', ears: 'round' } },
};

/** Villager look presets. */
export const LOOKS = {
  baker: { color: '#ffe0a0', accent: '#ffffff', ears: 'round', hat: 'chef' } as NpcLook,
  kid: { color: '#80ff80', accent: '#ff8040', ears: 'antenna', size: 0.85 } as NpcLook,
  guard: { color: '#c0a080', accent: '#ff0000', ears: 'pointy', hat: 'helmet' } as NpcLook,
  granny: { color: '#ffc0e0', accent: '#8080ff', ears: 'bunny', glasses: true } as NpcLook,
  farmer: { color: '#ffff80', accent: '#008000', ears: 'leaf', hat: 'cap' } as NpcLook,
  sailor: { color: '#80c0ff', accent: '#0000ff', ears: 'round', hat: 'cap', mustache: true } as NpcLook,
  ghost: { color: '#ffffff', accent: '#c0c0ff', ears: 'none', hat: 'none' } as NpcLook,
  mermaid: { color: '#80ffc0', accent: '#ff80ff', ears: 'cat', hat: 'flower' } as NpcLook,
  robot: { color: '#c0c0c0', accent: '#ff8040', ears: 'antenna' } as NpcLook,
  sage: { color: '#c0a0ff', accent: '#ffd700', ears: 'horn', hat: 'hood', mustache: true } as NpcLook,
  light: { color: '#ffffa0', accent: '#ffffff', ears: 'none', size: 0.7 } as NpcLook,
  king: { color: '#ffc080', accent: '#ff0000', ears: 'round', hat: 'crown', mustache: true } as NpcLook,
  cloudling: { color: '#e0f0ff', accent: '#80c0ff', ears: 'round', hat: 'bow' } as NpcLook,
};
