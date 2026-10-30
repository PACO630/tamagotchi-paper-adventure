/** Thin promise wrapper around IndexedDB. Stores: saves (key: slot), backups (key: id). */

import { PROFILE } from './localPrefs';

const DB_NAME = PROFILE ? `TamagotchiPaperAdventure_${PROFILE}` : 'TamagotchiPaperAdventure';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryFallback: Map<string, Map<IDBValidKey, unknown>> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  dbPromise.catch(() => {
    // Private mode on some browsers: keep the game playable with an in-memory store.
    memoryFallback = new Map();
  });
  return dbPromise;
}

function mem(store: string) {
  if (!memoryFallback) memoryFallback = new Map();
  let m = memoryFallback.get(store);
  if (!m) memoryFallback.set(store, (m = new Map()));
  return m;
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  let db: IDBDatabase;
  try {
    db = await open();
  } catch {
    throw new Error('NO_IDB');
  }
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    let result: T;
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  async isPersistentAvailable(): Promise<boolean> {
    try { await open(); return true; } catch { return false; }
  },
  async get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    try {
      return await tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
    } catch (e) {
      if ((e as Error).message === 'NO_IDB') return structuredClone(mem(store).get(key)) as T | undefined;
      throw e;
    }
  },
  async getAll<T>(store: string): Promise<T[]> {
    try {
      return (await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)) ?? [];
    } catch (e) {
      if ((e as Error).message === 'NO_IDB') return [...mem(store).values()].map((v) => structuredClone(v)) as T[];
      throw e;
    }
  },
  async put(store: string, value: Record<string, any>): Promise<void> {
    try {
      await tx(store, 'readwrite', (s) => s.put(value));
    } catch (e) {
      if ((e as Error).message === 'NO_IDB') {
        const key = value.slot ?? value.id ?? value.key;
        mem(store).set(key, structuredClone(value));
        return;
      }
      throw e;
    }
  },
  async delete(store: string, key: IDBValidKey): Promise<void> {
    try {
      await tx(store, 'readwrite', (s) => s.delete(key));
    } catch (e) {
      if ((e as Error).message === 'NO_IDB') { mem(store).delete(key); return; }
      throw e;
    }
  },
};
