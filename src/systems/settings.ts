import { bus } from '../core/events';
import { PROFILE, prefs } from './localPrefs';
import { DEFAULT_SETTINGS, type GameSettings } from './saveSchema';

const NET_KEY = PROFILE ? `tpa.${PROFILE}.netSettings` : 'tpa.netSettings';

function loadNet(): Partial<GameSettings> {
  try {
    const raw = localStorage.getItem(NET_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    const out: Partial<GameSettings> = {};
    if (typeof o.useTurn === 'boolean') out.useTurn = o.useTurn;
    for (const k of ['turnUrl', 'turnUser', 'turnPass'] as const) if (typeof o[k] === 'string' && o[k].length < 256) out[k] = o[k];
    return out;
  } catch { return {}; }
}

/** Live game settings. Mirrored to LocalStorage (simple prefs) and into the active save. */
export const settings = {
  current: { ...DEFAULT_SETTINGS } as GameSettings,

  load(): GameSettings {
    const c = { ...DEFAULT_SETTINGS, ...loadNet() };
    if (prefs.musicVolume !== null) c.musicVolume = prefs.musicVolume;
    if (prefs.sfxVolume !== null) c.sfxVolume = prefs.sfxVolume;
    if (prefs.muted !== null) c.muted = prefs.muted;
    if (prefs.graphics) c.quality = prefs.graphics;
    if (prefs.controls) c.touchControls = prefs.controls;
    if (prefs.textSpeed) c.textSpeed = prefs.textSpeed;
    if (prefs.screenShake !== null) c.screenShake = prefs.screenShake;
    this.current = c;
    return c;
  },

  update(patch: Partial<GameSettings>): void {
    Object.assign(this.current, patch);
    const c = this.current;
    prefs.musicVolume = c.musicVolume;
    prefs.sfxVolume = c.sfxVolume;
    prefs.muted = c.muted;
    prefs.graphics = c.quality;
    prefs.controls = c.touchControls;
    prefs.textSpeed = c.textSpeed;
    prefs.screenShake = c.screenShake;
    try {
      localStorage.setItem(NET_KEY, JSON.stringify({ useTurn: c.useTurn, turnUrl: c.turnUrl, turnUser: c.turnUser, turnPass: c.turnPass }));
    } catch { /* ignore */ }
    bus.emit('settings:changed', c);
  },
};
