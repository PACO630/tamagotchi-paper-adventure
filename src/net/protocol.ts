import type { CharId, Stats } from '../data/types';
import type { GameAction } from '../systems/actions';
import type { SaveData } from '../systems/saveSchema';

export const PROTOCOL_VERSION = 4;

export interface RosterEntry {
  key: string;          // stable playerId (survives reconnects)
  peerId: string;       // current PeerJS id
  name: string;
  charId: CharId | null;
  level: number;
  stats: Stats;
  hp: number;
  sp: number;
  skills: string[];
  badges: string[];
  connected: boolean;
  isHost: boolean;
  joinOrder: number;
}

export interface PosUpdate { key: string; x: number; z: number; y: number; f: number; a: string; t: number }

export type NetMsg =
  | { t: 'hello'; v: number; build?: string; key: string; name: string; level: number; stats: Stats; hp: number; sp: number; skills: string[]; badges: string[] }
  | { t: 'welcome'; roster: RosterEntry[]; phase: 'lobby' | 'game'; hostKey: string; room: string; chapter: number }
  | { t: 'reject'; reason: string }
  | { t: 'roster'; roster: RosterEntry[]; phase: 'lobby' | 'game'; hostKey: string; chapter: number }
  | { t: 'pick'; charId: CharId | null }
  | { t: 'chapter'; chapter: number }
  | { t: 'start'; chapter: number; seq: number; state: SaveData }
  | { t: 'dissolve' }
  | { t: 'leave' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'pos'; p: PosUpdate }
  | { t: 'req'; action: GameAction }
  | { t: 'act'; seq: number; action: GameAction }
  | { t: 'snap'; seq: number; state: SaveData }
  | { t: 'needSnap'; have: number }
  | { t: 'hash'; seq: number; h: string }
  | { t: 'dlg'; kind: 'line' | 'adv' | 'choice' | 'pick' | 'end' | 'skip'; data?: any }
  | { t: 'bstart'; data: any }
  | { t: 'bev'; ev: any }
  | { t: 'bask'; token: string; kind: 'menu' | 'guard' | 'command'; data: any }
  | { t: 'bans'; token: string; result: any }
  | { t: 'stats'; key: string; level: number; stats: Stats; hp: number; sp: number; skills: string[]; badges: string[] }
  | { t: 'field'; kind: string; data: any }
  | { t: 'newHost'; hostKey: string; peerId: string };

export type Envelope = NetMsg & { mid: string; from: string };
