import { AUTOSAVE_INTERVAL_MS, SAVE_SLOTS } from '../core/config';
import { bus } from '../core/events';
import { deepClone } from '../core/util';
import { db } from './db';
import { identity } from './identity';
import { prefs } from './localPrefs';
import { createNewSave, migrateSave, validateSave, type SaveData } from './saveSchema';
import { settings } from './settings';

type BeforeSaveHook = (save: SaveData) => void;

/** Owns the active save slot, writes to IndexedDB, and runs autosave. */
class SaveManager {
  current: SaveData | null = null;
  private hooks: BeforeSaveHook[] = [];
  private timer: number | null = null;
  private pending: number | null = null;
  private saving = false;
  private lastWrite = 0;
  /** Set false in multiplayer client sessions where the world state is not ours. */
  enabled = true;

  onBeforeSave(fn: BeforeSaveHook): () => void {
    this.hooks.push(fn);
    return () => { this.hooks = this.hooks.filter((h) => h !== fn); };
  }

  async listSlots(): Promise<(SaveData | null)[]> {
    const out: (SaveData | null)[] = [];
    for (let s = 1; s <= SAVE_SLOTS; s++) out.push(await this.readSlot(s));
    return out;
  }

  async readSlot(slot: number): Promise<SaveData | null> {
    try {
      const raw = await db.get<SaveData>('saves', slot);
      if (!raw) return null;
      return validateSave(migrateSave(raw));
    } catch (e) {
      console.warn('slot unreadable', slot, e);
      return null;
    }
  }

  async newGame(slot: number): Promise<SaveData> {
    const save = createNewSave(slot, identity.id, identity.name, settings.current);
    this.current = save;
    prefs.lastSlot = slot;
    await this.write('new');
    return save;
  }

  async load(slot: number): Promise<SaveData | null> {
    const s = await this.readSlot(slot);
    if (!s) return null;
    // the device identity name wins (renames apply to every slot)
    if (identity.exists && s.playerId === identity.id) s.playerName = identity.name;
    this.current = s;
    prefs.lastSlot = slot;
    return s;
  }

  /** Writes the current save. Returns true on success. */
  async write(reason: string, silent = false): Promise<boolean> {
    if (!this.current || !this.enabled) return false;
    if (this.saving) { this.requestAutosave(reason); return false; }
    this.saving = true;
    try {
      for (const h of this.hooks) h(this.current);
      const now = Date.now();
      this.current.lastPlayedAt = now;
      this.current.savedAt = now;
      this.current.gameSettings = { ...settings.current };
      await db.put('saves', deepClone(this.current));
      prefs.lastPlayedAt = now;
      prefs.lastSlot = this.current.slot;
      this.lastWrite = now;
      if (!silent) bus.emit('save:done', reason);
      return true;
    } catch (e) {
      console.error('save failed', e);
      bus.emit('save:error', e);
      return false;
    } finally {
      this.saving = false;
    }
  }

  /** Debounced autosave used by gameplay events (quest done, boss, level up...). */
  requestAutosave(reason: string): void {
    if (!this.current || !this.enabled) return;
    if (this.pending) clearTimeout(this.pending);
    this.pending = window.setTimeout(() => {
      this.pending = null;
      void this.write(reason);
    }, 600);
  }

  startAutosaveTimer(): void {
    this.stopAutosaveTimer();
    this.timer = window.setInterval(() => {
      if (Date.now() - this.lastWrite > AUTOSAVE_INTERVAL_MS * 0.8) void this.write('interval');
    }, AUTOSAVE_INTERVAL_MS);
  }

  stopAutosaveTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async resetSlot(slot: number): Promise<void> {
    await db.delete('saves', slot);
    if (this.current?.slot === slot) this.current = null;
  }

  async renameEverywhere(name: string): Promise<void> {
    const slots = await this.listSlots();
    for (const s of slots) {
      if (!s) continue;
      s.playerName = name;
      await db.put('saves', s);
    }
    if (this.current) this.current.playerName = name;
  }

  async backup(slot: number, tag: string): Promise<string | null> {
    const raw = await db.get<SaveData>('saves', slot);
    if (!raw) return null;
    const id = `${tag}-${slot}-${Date.now()}`;
    await db.put('backups', { id, slot, createdAt: Date.now(), data: raw });
    // keep only the 5 most recent backups
    const all = await db.getAll<{ id: string; createdAt: number }>('backups');
    all.sort((a, b) => b.createdAt - a.createdAt);
    for (const old of all.slice(5)) await db.delete('backups', old.id);
    return id;
  }

  async restoreBackup(id: string): Promise<boolean> {
    const b = await db.get<{ id: string; slot: number; data: SaveData }>('backups', id);
    if (!b) return false;
    await db.put('saves', b.data);
    return true;
  }

  /** Writes a validated save object directly into a slot. */
  async writeRaw(save: SaveData): Promise<void> {
    await db.put('saves', deepClone(save));
  }

  installLifecycleSaves(isPlaying: () => boolean): void {
    const flush = () => { if (isPlaying()) void this.write('leave', true); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }
}

export const saves = new SaveManager();
