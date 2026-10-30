/**
 * LocalStorage holds only small, simple values: identity, last slot, volumes,
 * graphics/control prefs and last-played time. Progress lives in IndexedDB.
 */
/** Optional ?profile=name keeps a separate local identity/save set (e.g. testing multiplayer on one PC). */
export const PROFILE = (() => {
  try {
    const p = new URLSearchParams(location.search).get('profile') ?? '';
    return /^[a-z0-9]{1,8}$/i.test(p) ? p : '';
  } catch { return ''; }
})();
const NS = PROFILE ? `tpa.${PROFILE}.` : 'tpa.';

const K = {
  name: NS + 'playerName',
  id: NS + 'playerId',
  slot: NS + 'lastSlot',
  music: NS + 'musicVolume',
  sfx: NS + 'sfxVolume',
  muted: NS + 'muted',
  graphics: NS + 'graphics',
  controls: NS + 'controls',
  lastPlayed: NS + 'lastPlayedAt',
  textSpeed: NS + 'textSpeed',
  shake: NS + 'screenShake',
} as const;

function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function set(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* storage full or disabled */ }
}
function del(k: string): void {
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}

export const prefs = {
  get playerName() { return get(K.name); },
  set playerName(v: string | null) { v === null ? del(K.name) : set(K.name, v); },
  get playerId() { return get(K.id); },
  set playerId(v: string | null) { v === null ? del(K.id) : set(K.id, v); },
  get lastSlot() { const n = Number(get(K.slot)); return n >= 1 && n <= 3 ? n : 1; },
  set lastSlot(v: number) { set(K.slot, String(v)); },
  get musicVolume() { const n = Number(get(K.music) ?? NaN); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null; },
  set musicVolume(v: number | null) { if (v !== null) set(K.music, String(v)); },
  get sfxVolume() { const n = Number(get(K.sfx) ?? NaN); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null; },
  set sfxVolume(v: number | null) { if (v !== null) set(K.sfx, String(v)); },
  get muted() { const v = get(K.muted); return v === null ? null : v === '1'; },
  set muted(v: boolean | null) { if (v !== null) set(K.muted, v ? '1' : '0'); },
  get graphics() { const v = get(K.graphics); return v === 'low' || v === 'high' ? v : null; },
  set graphics(v: 'low' | 'high' | null) { if (v) set(K.graphics, v); },
  get controls() { const v = get(K.controls); return v === 'on' || v === 'off' || v === 'auto' ? v : null; },
  set controls(v: 'on' | 'off' | 'auto' | null) { if (v) set(K.controls, v); },
  get textSpeed() { const v = get(K.textSpeed); return v === 'slow' || v === 'normal' || v === 'fast' ? v : null; },
  set textSpeed(v: 'slow' | 'normal' | 'fast' | null) { if (v) set(K.textSpeed, v); },
  get screenShake() { const v = get(K.shake); return v === null ? null : v === '1'; },
  set screenShake(v: boolean | null) { if (v !== null) set(K.shake, v ? '1' : '0'); },
  get lastPlayedAt() { return Number(get(K.lastPlayed) ?? 0) || 0; },
  set lastPlayedAt(v: number) { set(K.lastPlayed, String(v)); },
};
