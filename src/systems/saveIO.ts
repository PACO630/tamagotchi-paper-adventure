import { APP_VERSION, GAME_ID, GAME_TITLE, MAX_IMPORT_BYTES, SAVE_VERSION } from '../core/config';
import { identity } from './identity';
import { saves } from './saveManager';
import {
  checksum, migrateSave, SaveValidationError, validateSave,
  type ExportEnvelope, type SaveData,
} from './saveSchema';

/* ======================== Export ======================== */

export function buildExport(save: SaveData): ExportEnvelope {
  const clean = validateSave(JSON.parse(JSON.stringify(save)));
  const body = JSON.stringify(clean);
  const now = new Date();
  return {
    game: GAME_ID,
    gameTitle: GAME_TITLE,
    formatVersion: SAVE_VERSION,
    exportedAt: now.toISOString(),
    exportedAtMs: now.getTime(),
    appVersion: APP_VERSION,
    checksum: checksum(body),
    player: { playerId: clean.playerId, playerName: clean.playerName },
    progress: { chapter: clean.currentChapter, level: clean.playerLevel, unlockedAreas: clean.unlockedAreas },
    save: clean,
  };
}

export function exportFileName(name: string, date = new Date()): string {
  const safe = name.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, '') || 'Player';
  const p = (n: number) => String(n).padStart(2, '0');
  return `Tamagotchi_Paper_Adventure_Save_${safe}_${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}.json`;
}

/** Saves the current progress first, then downloads it as a JSON file. */
export async function exportCurrentSave(fallbackSlot?: number): Promise<string> {
  const slot = saves.current?.slot ?? fallbackSlot;
  if (saves.current && saves.enabled) await saves.write('export', true);
  const save = slot ? await saves.readSlot(slot) : null;
  if (!save) throw new Error('目前沒有可以匯出的存檔。');
  const env = buildExport(save);
  const json = JSON.stringify(env, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const name = exportFileName(save.playerName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}

/* ======================== Import ======================== */

export interface ImportPreview {
  save: SaveData;
  exportedAt: number;
  playerName: string;
  chapter: number;
  level: number;
  lastPlayedAt: number;
  migratedFrom: number | null;
}

export class ImportError extends Error {}

export async function readImportFile(file: File): Promise<ImportPreview> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(`檔案太大（${Math.ceil(file.size / 1024)} KB），存檔最多 ${MAX_IMPORT_BYTES / 1024} KB。`);
  if (file.size === 0) throw new ImportError('檔案是空的。');
  const text = await file.text();
  return parseImportText(text);
}

export function parseImportText(text: string): ImportPreview {
  let data: any;
  try {
    data = JSON.parse(text); // JSON only — never evaluated as code
  } catch {
    throw new ImportError('這不是有效的 JSON 檔案。');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new ImportError('JSON 內容格式錯誤。');
  if (data.game !== GAME_ID) throw new ImportError('這不是《拓麻歌子紙片大冒險》的存檔。');
  if (typeof data.formatVersion !== 'number') throw new ImportError('缺少存檔格式版本。');
  if (data.formatVersion > SAVE_VERSION) throw new ImportError(`存檔格式 v${data.formatVersion} 比遊戲新（v${SAVE_VERSION}），請先更新遊戲。`);
  if (data.formatVersion < 1) throw new ImportError('存檔格式版本不相容。');
  if (typeof data.save !== 'object' || data.save === null) throw new ImportError('缺少存檔資料欄位 save。');
  for (const f of ['playerId', 'playerName']) {
    if (!(f in data.save) && !(data.formatVersion === 1)) throw new ImportError(`缺少必要欄位：${f}`);
  }

  // integrity check (only possible for the current format, where the body is canonical)
  if (data.formatVersion === SAVE_VERSION && typeof data.checksum === 'string') {
    let canonical: string;
    try { canonical = JSON.stringify(validateSave(data.save)); } catch (e) {
      throw new ImportError(e instanceof SaveValidationError ? `存檔資料不完整：${e.message}` : '存檔資料不完整。');
    }
    if (checksum(canonical) !== data.checksum) throw new ImportError('存檔完整性驗證失敗（檔案可能被修改或損壞）。');
  }

  let save: SaveData;
  const migratedFrom = data.formatVersion < SAVE_VERSION ? data.formatVersion : null;
  try {
    save = validateSave(migrateSave(data.save));
  } catch (e) {
    throw new ImportError(e instanceof SaveValidationError || e instanceof Error ? `存檔驗證失敗：${e.message}` : '存檔驗證失敗。');
  }
  return {
    save,
    exportedAt: typeof data.exportedAtMs === 'number' ? data.exportedAtMs : Date.parse(data.exportedAt) || 0,
    playerName: save.playerName,
    chapter: save.currentChapter,
    level: save.playerLevel,
    lastPlayedAt: save.lastPlayedAt,
    migratedFrom,
  };
}

/**
 * Applies an import into a slot: backs up the existing slot, writes, verifies by reading back,
 * and restores the backup on any failure. Player data is never cleared on failure.
 */
export async function applyImport(preview: ImportPreview, slot: number): Promise<SaveData> {
  const backupId = await saves.backup(slot, 'pre-import');
  const incoming: SaveData = { ...preview.save, slot };
  try {
    await saves.writeRaw(incoming);
    const verify = await saves.readSlot(slot);
    if (!verify || verify.playerId !== incoming.playerId || verify.playerLevel !== incoming.playerLevel) {
      throw new Error('寫入後驗證失敗');
    }
    identity.adopt(verify.playerId, verify.playerName);
    await saves.load(slot);
    return verify;
  } catch (e) {
    if (backupId) await saves.restoreBackup(backupId);
    else await saves.resetSlot(slot); // slot was empty before: leave it empty
    throw new ImportError(`匯入失敗，已恢復原本的存檔。（${(e as Error).message}）`);
  }
}
