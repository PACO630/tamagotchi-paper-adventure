type Handler = (...args: any[]) => void;

/** Minimal event bus shared by systems, scenes and UI. */
export class Emitter {
  private map = new Map<string, Set<Handler>>();

  on(evt: string, fn: Handler): () => void {
    let set = this.map.get(evt);
    if (!set) this.map.set(evt, (set = new Set()));
    set.add(fn);
    return () => this.off(evt, fn);
  }

  once(evt: string, fn: Handler): () => void {
    const wrap: Handler = (...a) => { this.off(evt, wrap); fn(...a); };
    return this.on(evt, wrap);
  }

  off(evt: string, fn: Handler): void {
    this.map.get(evt)?.delete(fn);
  }

  emit(evt: string, ...args: any[]): void {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(...args); } catch (e) { console.error(`[event ${evt}]`, e); }
    }
  }
}

/** Global bus. Event names used across the game:
 *  save:done, save:error, quest:started, quest:completed, item:gained, levelup,
 *  flag:set, chapter:complete, boss:defeated, area:unlocked, state:changed,
 *  settings:changed, hud:dirty, net:*, toast
 */
export const bus = new Emitter();
