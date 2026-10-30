import { GAME_ID, MAX_LEVEL, SAVE_VERSION } from '../core/config';
import { CHARACTERS, statsAt, skillsAt } from '../data/characters';
import { ITEMS } from '../data/items';
import type { CharId, Stats } from '../data/types';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  textSpeed: 'slow' | 'normal' | 'fast';
  touchControls: 'auto' | 'on' | 'off';
  quality: 'high' | 'low';
  screenShake: boolean;
  useTurn: boolean;
  turnUrl: string;
  turnUser: string;
  turnPass: string;
}

export interface InvEntry { id: string; qty: number }
export interface ActiveQuest { id: string; startedAt: number }

export interface SaveData {
  saveVersion: number;
  slot: number;
  playerId: string;
  playerName: string;
  createdAt: number;
  lastPlayedAt: number;
  savedAt: number;
  totalPlayTime: number;
  currentChapter: number;
  currentMap: string;
  position: { x: number; z: number };
  playerLevel: number;
  playerExp: number;
  playerHP: number;
  playerSP: number;
  playerStats: Stats;
  coins: number;
  inventory: InvEntry[];
  equipment: { badges: string[] };
  skills: string[];
  completedQuests: string[];
  activeQuests: ActiveQuest[];
  collectedItems: string[];
  unlockedAreas: string[];
  storyFlags: Record<string, boolean | number | string>;
  gameSettings: GameSettings;
  partners: { unlocked: CharId[]; active: CharId | null; hp: Record<string, number>; sp: Record<string, number> };
  stats: { battlesWon: number; enemiesDefeated: number; chestsOpened: number; perfectGuards: number };
  mpHighestChapter: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.55,
  sfxVolume: 0.8,
  muted: false,
  textSpeed: 'normal',
  touchControls: 'auto',
  quality: 'high',
  screenShake: true,
  useTurn: true,
  turnUrl: '',
  turnUser: '',
  turnPass: '',
};

export const BADGE_SLOTS = 3;

export function createNewSave(slot: number, playerId: string, playerName: string, settings: GameSettings): SaveData {
  const now = Date.now();
  const stats = statsAt('mametchi', 1);
  return {
    saveVersion: SAVE_VERSION,
    slot,
    playerId,
    playerName,
    createdAt: now,
    lastPlayedAt: now,
    savedAt: 0,
    totalPlayTime: 0,
    currentChapter: 1,
    currentMap: 'ch1',
    position: { x: -1, z: -1 },
    playerLevel: 1,
    playerExp: 0,
    playerHP: stats.maxHP,
    playerSP: stats.maxSP,
    playerStats: stats,
    coins: 10,
    inventory: [{ id: 'apple', qty: 3 }, { id: 'juice', qty: 1 }, { id: 'star_sensor', qty: 1 }],
    equipment: { badges: [] },
    skills: skillsAt('mametchi', 1),
    completedQuests: [],
    activeQuests: [],
    collectedItems: [],
    unlockedAreas: ['ch1'],
    storyFlags: {},
    gameSettings: { ...settings },
    partners: { unlocked: [], active: null, hp: {}, sp: {} },
    stats: { battlesWon: 0, enemiesDefeated: 0, chestsOpened: 0, perfectGuards: 0 },
    mpHighestChapter: 1,
  };
}

/* ---------------- Player name validation ---------------- */

const NAME_RE = /^[\p{Script=Han}A-Za-z0-9]+$/u;

export function validatePlayerName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = (raw ?? '').normalize('NFC').trim();
  if (!name) return { ok: false, error: '名稱不能是空白喔！' };
  const len = [...name].length;
  if (len > 12) return { ok: false, error: '名稱最多 12 個字。' };
  if (/[<>&"'`/\\]/.test(name) || /script/i.test(name)) return { ok: false, error: '名稱不能包含 HTML 或程式碼內容。' };
  if (!NAME_RE.test(name)) return { ok: false, error: '只能使用中文字、英文字母或數字（不能有空格或符號）。' };
  return { ok: true, name };
}

/* ---------------- Validation helpers ---------------- */

export class SaveValidationError extends Error {}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (msg: string): never => { throw new SaveValidationError(msg); };

function num(v: unknown, field: string, min: number, max: number, int = true): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`欄位「${field}」必須是數字。`);
  const n = v as number;
  if (n < min || n > max) fail(`欄位「${field}」的數值超出範圍（${min}～${max}）。`);
  return int ? Math.floor(n) : n;
}

function str(v: unknown, field: string, maxLen: number): string {
  if (typeof v !== 'string') fail(`欄位「${field}」必須是文字。`);
  const s = v as string;
  if (s.length > maxLen) fail(`欄位「${field}」太長了。`);
  return s;
}

function strArr(v: unknown, field: string, maxLen = 500): string[] {
  if (!Array.isArray(v)) fail(`欄位「${field}」必須是陣列。`);
  const arr = v as unknown[];
  if (arr.length > maxLen) fail(`欄位「${field}」的資料太多。`);
  return arr.map((x, i) => str(x, `${field}[${i}]`, 64));
}

const CHAR_SET = new Set(Object.keys(CHARACTERS));

/**
 * Strictly validates a (migrated) save object and returns a sanitized copy.
 * Never evaluates any content; unknown fields are dropped.
 */
export function validateSave(raw: unknown): SaveData {
  if (!isObj(raw)) fail('存檔資料格式錯誤。');
  const r = raw as Record<string, any>;
  if (r.saveVersion !== SAVE_VERSION) fail(`存檔版本 ${r.saveVersion} 不相容。`);
  const nameCheck = validatePlayerName(str(r.playerName, 'playerName', 64));
  if (!nameCheck.ok) fail(`玩家名稱無效：${nameCheck.error}`);

  const level = num(r.playerLevel, 'playerLevel', 1, MAX_LEVEL);
  const statsObj = isObj(r.playerStats) ? r.playerStats : fail('缺少 playerStats。');
  const playerStats: Stats = {
    maxHP: num(statsObj.maxHP, 'playerStats.maxHP', 1, 9999),
    maxSP: num(statsObj.maxSP, 'playerStats.maxSP', 0, 9999),
    atk: num(statsObj.atk, 'playerStats.atk', 0, 999),
    def: num(statsObj.def, 'playerStats.def', 0, 999),
  };

  if (!Array.isArray(r.inventory)) fail('欄位「inventory」必須是陣列。');
  if (r.inventory.length > 300) fail('背包資料太多。');
  const inventory: InvEntry[] = [];
  for (const [i, e] of (r.inventory as unknown[]).entries()) {
    if (!isObj(e)) fail(`背包第 ${i + 1} 項格式錯誤。`);
    const id = str((e as any).id, `inventory[${i}].id`, 64);
    const qty = num((e as any).qty, `inventory[${i}].qty`, 0, 999);
    if (!ITEMS[id]) continue; // unknown item from a future/older version: drop silently
    if (qty > 0) inventory.push({ id, qty });
  }

  const eq = isObj(r.equipment) ? r.equipment : fail('缺少 equipment。');
  const badges = strArr(eq.badges ?? [], 'equipment.badges', 10).filter((b) => ITEMS[b]?.kind === 'badge').slice(0, BADGE_SLOTS);

  if (!Array.isArray(r.activeQuests)) fail('欄位「activeQuests」必須是陣列。');
  const activeQuests: ActiveQuest[] = (r.activeQuests as unknown[]).slice(0, 100).map((q, i) => {
    if (!isObj(q)) fail(`activeQuests[${i}] 格式錯誤。`);
    return { id: str((q as any).id, `activeQuests[${i}].id`, 64), startedAt: num((q as any).startedAt ?? 0, 'startedAt', 0, 8.64e15) };
  });

  const flags: Record<string, boolean | number | string> = {};
  const rawFlags = isObj(r.storyFlags) ? r.storyFlags : fail('缺少 storyFlags。');
  const flagKeys = Object.keys(rawFlags);
  if (flagKeys.length > 2000) fail('劇情事件資料太多。');
  for (const k of flagKeys) {
    if (k.length > 64 || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const v = rawFlags[k];
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) flags[k] = v;
    else if (typeof v === 'string' && v.length <= 64) flags[k] = v;
  }

  const gs = isObj(r.gameSettings) ? r.gameSettings : {};
  const settings: GameSettings = { ...DEFAULT_SETTINGS };
  if (typeof gs.musicVolume === 'number') settings.musicVolume = Math.min(1, Math.max(0, gs.musicVolume));
  if (typeof gs.sfxVolume === 'number') settings.sfxVolume = Math.min(1, Math.max(0, gs.sfxVolume));
  if (typeof gs.muted === 'boolean') settings.muted = gs.muted;
  if (['slow', 'normal', 'fast'].includes(gs.textSpeed)) settings.textSpeed = gs.textSpeed;
  if (['auto', 'on', 'off'].includes(gs.touchControls)) settings.touchControls = gs.touchControls;
  if (['high', 'low'].includes(gs.quality)) settings.quality = gs.quality;
  if (typeof gs.screenShake === 'boolean') settings.screenShake = gs.screenShake;
  if (typeof gs.useTurn === 'boolean') settings.useTurn = gs.useTurn;
  for (const k of ['turnUrl', 'turnUser', 'turnPass'] as const) if (typeof gs[k] === 'string' && gs[k].length < 256) settings[k] = gs[k];

  const p = isObj(r.partners) ? r.partners : { unlocked: [], active: null, hp: {}, sp: {} };
  const unlocked = strArr(p.unlocked ?? [], 'partners.unlocked', 10).filter((c) => CHAR_SET.has(c) && c !== 'mametchi') as CharId[];
  const active = typeof p.active === 'string' && unlocked.includes(p.active as CharId) ? (p.active as CharId) : null;
  const numMap = (m: unknown) => {
    const out: Record<string, number> = {};
    if (isObj(m)) for (const k of Object.keys(m)) if (CHAR_SET.has(k) && typeof m[k] === 'number' && Number.isFinite(m[k])) out[k] = Math.max(0, Math.min(9999, Math.floor(m[k])));
    return out;
  };

  const st = isObj(r.stats) ? r.stats : {};
  const pos = isObj(r.position) ? r.position : { x: -1, z: -1 };

  return {
    saveVersion: SAVE_VERSION,
    slot: num(r.slot ?? 1, 'slot', 1, 3),
    playerId: str(r.playerId, 'playerId', 64),
    playerName: nameCheck.ok ? nameCheck.name : '',
    createdAt: num(r.createdAt, 'createdAt', 0, 8.64e15),
    lastPlayedAt: num(r.lastPlayedAt, 'lastPlayedAt', 0, 8.64e15),
    savedAt: num(r.savedAt ?? 0, 'savedAt', 0, 8.64e15),
    totalPlayTime: num(r.totalPlayTime, 'totalPlayTime', 0, 1e9),
    currentChapter: num(r.currentChapter, 'currentChapter', 1, 9),
    currentMap: str(r.currentMap, 'currentMap', 16),
    position: { x: num(pos.x ?? -1, 'position.x', -1, 100000, false), z: num(pos.z ?? -1, 'position.z', -1, 1000, false) },
    playerLevel: level,
    playerExp: num(r.playerExp, 'playerExp', 0, 1e7),
    playerHP: num(r.playerHP, 'playerHP', 0, 9999),
    playerSP: num(r.playerSP ?? playerStats.maxSP, 'playerSP', 0, 9999),
    playerStats,
    coins: num(r.coins ?? 0, 'coins', 0, 999999),
    inventory,
    equipment: { badges },
    skills: strArr(r.skills, 'skills', 50),
    completedQuests: strArr(r.completedQuests, 'completedQuests'),
    activeQuests,
    collectedItems: strArr(r.collectedItems, 'collectedItems'),
    unlockedAreas: strArr(r.unlockedAreas, 'unlockedAreas', 20),
    storyFlags: flags,
    gameSettings: settings,
    partners: { unlocked, active, hp: numMap(p.hp), sp: numMap(p.sp) },
    stats: {
      battlesWon: typeof st.battlesWon === 'number' ? Math.max(0, Math.floor(st.battlesWon)) : 0,
      enemiesDefeated: typeof st.enemiesDefeated === 'number' ? Math.max(0, Math.floor(st.enemiesDefeated)) : 0,
      chestsOpened: typeof st.chestsOpened === 'number' ? Math.max(0, Math.floor(st.chestsOpened)) : 0,
      perfectGuards: typeof st.perfectGuards === 'number' ? Math.max(0, Math.floor(st.perfectGuards)) : 0,
    },
    mpHighestChapter: typeof r.mpHighestChapter === 'number' ? Math.max(1, Math.min(8, Math.floor(r.mpHighestChapter))) : 1,
  };
}

/* ---------------- Migration ---------------- */

/**
 * Upgrades any older save layout to the current SAVE_VERSION.
 * v1 (prototype layout): { version:1, name, id, chapter, level, exp, hp, items:{id:qty}, flags, quests:{done,active} }
 */
export function migrateSave(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  let r: Record<string, any> = { ...raw };
  const version = typeof r.saveVersion === 'number' ? r.saveVersion : typeof r.version === 'number' ? r.version : 0;
  if (version > SAVE_VERSION) fail(`這個存檔來自較新版本（v${version}），請先更新遊戲。`);
  if (version < 1) fail('無法辨識的存檔版本。');

  if (version === 1) {
    const level = typeof r.level === 'number' ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(r.level))) : 1;
    const stats = statsAt('mametchi', level);
    const items = isObj(r.items) ? r.items : {};
    r = {
      saveVersion: 2,
      slot: 1,
      playerId: r.id,
      playerName: r.name,
      createdAt: r.createdAt ?? Date.now(),
      lastPlayedAt: r.lastPlayedAt ?? Date.now(),
      savedAt: 0,
      totalPlayTime: r.playTime ?? 0,
      currentChapter: r.chapter ?? 1,
      currentMap: `ch${r.chapter ?? 1}`,
      position: { x: -1, z: -1 },
      playerLevel: level,
      playerExp: r.exp ?? 0,
      playerHP: Math.min(stats.maxHP, r.hp ?? stats.maxHP),
      playerSP: stats.maxSP,
      playerStats: stats,
      coins: r.coins ?? 0,
      inventory: Object.entries(items).map(([id, qty]) => ({ id, qty })),
      equipment: { badges: [] },
      skills: skillsAt('mametchi', level),
      completedQuests: r.quests?.done ?? [],
      activeQuests: (r.quests?.active ?? []).map((id: string) => ({ id, startedAt: 0 })),
      collectedItems: [],
      unlockedAreas: Array.from({ length: r.chapter ?? 1 }, (_, i) => `ch${i + 1}`),
      storyFlags: r.flags ?? {},
      gameSettings: r.settings ?? {},
      partners: { unlocked: [], active: null, hp: {}, sp: {} },
      stats: {},
      mpHighestChapter: 1,
    };
  }
  return r;
}

/* ---------------- Export envelope ---------------- */

export interface ExportEnvelope {
  game: string;
  gameTitle: string;
  formatVersion: number;
  exportedAt: string;
  exportedAtMs: number;
  appVersion: string;
  checksum: string;
  player: { playerId: string; playerName: string };
  progress: {
    chapter: number;
    level: number;
    unlockedAreas: string[];
  };
  save: SaveData;
}

export function checksum(text: string): string {
  // FNV-1a over the serialized save, used to detect accidental corruption.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const EXPORT_GAME_ID = GAME_ID;
