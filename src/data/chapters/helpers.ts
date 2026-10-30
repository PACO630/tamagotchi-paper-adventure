import type { CharId, Expr, NpcLook, ScriptStep } from '../types';

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

/** Speakers that are not playable characters or map NPCs. */
export const SPEAKERS: Record<string, { name: string; look: CharId | NpcLook; dark?: boolean }> = {
  eternatchi: { name: '永恆吉', look: { color: '#ffffc0', accent: '#4000c0', ears: 'horn', hat: 'crown', size: 1.05 } },
  shadow: { name: '神秘的影子', look: { color: '#202030', accent: '#8000ff', ears: 'horn' }, dark: true },
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
