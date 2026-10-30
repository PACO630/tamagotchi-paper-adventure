import type { CharId, StatusType, Trait } from '../data/types';

export interface Status { type: StatusType; turns: number; amount: number }

export interface Fighter {
  id: string;
  side: 'party' | 'enemy';
  name: string;
  charId?: CharId;
  enemyId?: string;
  hp: number;
  maxHP: number;
  sp: number;
  maxSP: number;
  atk: number;
  def: number;
  statuses: Status[];
  traits: Trait[];
  controller: string;
  skills: string[];
  badges: string[];
  defending: boolean;
  /** boss bookkeeping */
  phase: number;
  charging: boolean;
  shielded: boolean;
  counter: boolean;
  countdown: number;
  jumpHits: number;
  groundedTurns: number;
  scale: number;
}

export type Quality = 'great' | 'nice' | 'ok' | 'none';
export type GuardResult = 'perfect' | 'good' | 'fail';

export interface MenuChoice {
  kind: 'hammer' | 'jump' | 'skill' | 'item' | 'defend' | 'flee' | 'team';
  skill?: string;
  item?: string;
  target?: string;
}

export interface CommandSpec { cmd: 'timing' | 'mash' | 'sequence' | 'jump' | 'none'; actor: string; target?: string; hits?: number; hard: boolean; len?: number }

/** Visual steps the scene plays in order. */
export type FxStep =
  | { t: 'text'; text: string; ms?: number }
  | { t: 'anim'; who: string; anim: string }
  | { t: 'approach'; who: string; to: string; jump?: boolean }
  | { t: 'return'; who: string }
  | { t: 'hit'; dst: string; dmg: number; label?: string; crit?: boolean; guard?: GuardResult; hp: number }
  | { t: 'miss'; dst: string; text?: string }
  | { t: 'heal'; dst: string; hp?: number; sp?: number; hpNow: number; spNow: number }
  | { t: 'status'; dst: string; status: StatusType; on: boolean }
  | { t: 'fx'; name: string; at: string }
  | { t: 'die'; dst: string }
  | { t: 'revive'; dst: string; hp: number }
  | { t: 'spawn'; fighter: Fighter }
  | { t: 'shake' }
  | { t: 'sfx'; id: string }
  | { t: 'wait'; ms: number };

export interface BattleSetup {
  party: Fighter[];
  enemies: Fighter[];
  boss: boolean;
  music: string;
  themeId: string;
  first: 'party' | 'enemy' | null;
  firstKind?: 'hammer' | 'jump';
}

export interface BattleReward { exp: number; coins: number; items: { id: string; qty: number }[]; kills: Record<string, number> }

export interface BattleOutcome { result: 'win' | 'lose' | 'flee'; reward: BattleReward; party: { id: string; hp: number; sp: number }[] }
