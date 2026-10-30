import { uid } from '../core/util';
import { prefs } from './localPrefs';
import { validatePlayerName } from './saveSchema';

/** Local, account-free player identity stored in LocalStorage. */
export const identity = {
  /** true only during the session in which the identity was first created */
  justCreated: false,
  get exists(): boolean {
    return !!prefs.playerName && !!prefs.playerId;
  },
  get name(): string {
    return prefs.playerName ?? '';
  },
  get id(): string {
    let id = prefs.playerId;
    if (!id) {
      id = 'p_' + uid(14);
      prefs.playerId = id;
    }
    return id;
  },
  create(rawName: string): { ok: true } | { ok: false; error: string } {
    const v = validatePlayerName(rawName);
    if (!v.ok) return v;
    prefs.playerName = v.name;
    void this.id; // ensure an id exists
    this.justCreated = true;
    return { ok: true };
  },
  rename(rawName: string): { ok: true; name: string } | { ok: false; error: string } {
    const v = validatePlayerName(rawName);
    if (!v.ok) return v;
    prefs.playerName = v.name;
    return { ok: true, name: v.name };
  },
  /** Adopt identity from an imported save so the device continues as that player. */
  adopt(id: string, name: string): void {
    prefs.playerId = id;
    prefs.playerName = name;
  },
};
