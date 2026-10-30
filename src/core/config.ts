declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/** Logical game resolution (scaled to fit the screen). */
export const GAME_W = 1280;
export const GAME_H = 720;

/** 2.5D field: x runs along the map, z is depth (0 = back edge, DEPTH = front edge). */
export const DEPTH = 240;
export const GROUND_TOP = 440;
export const GROUND_BOTTOM = 690;
export const Z_TO_Y = (GROUND_BOTTOM - GROUND_TOP) / DEPTH;

export const GAME_ID = 'TamagotchiPaperAdventure';
export const GAME_TITLE = '拓麻歌子紙片大冒險';
export const SAVE_VERSION = 2;
export const SAVE_SLOTS = 3;
export const MAX_IMPORT_BYTES = 1024 * 1024; // 1 MB
export const AUTOSAVE_INTERVAL_MS = 90_000;
export const MAX_LEVEL = 30;
export const MAX_PLAYERS = 4;

export const PEER_PREFIX = 'tpa-room-';

/**
 * Game font: the rounded sans used for the character name tags (PingFang TC on Apple devices).
 * Other systems get the matching web font Noto Sans TC (SIL OFL) so every device looks the same.
 */
export const FONT_FAMILY = 'Noto Sans TC';
export const FONT = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
