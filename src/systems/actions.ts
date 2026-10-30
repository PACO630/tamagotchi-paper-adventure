import { bus } from '../core/events';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import type { CharId } from '../data/types';
import { statsAt } from '../data/characters';
import type { SaveData } from './saveSchema';
import { BADGE_SLOTS } from './saveSchema';

/**
 * Every change to the (shared) game state is a serializable action. Single player applies them
 * directly; in multiplayer the host sequences them and every peer applies them in the same order.
 */
export type GameAction =
  | { a: 'flag'; k: string; v: boolean | number | string }
  | { a: 'give'; item: string; qty: number; silent?: boolean }
  | { a: 'take'; item: string; qty: number }
  | { a: 'coins'; n: number }
  | { a: 'chest'; id: string; items: { id: string; qty: number }[]; coins: number }
  | { a: 'questStart'; id: string }
  | { a: 'questDone'; id: string }
  | { a: 'join'; partner: CharId }
  | { a: 'setPartner'; partner: CharId | null }
  | { a: 'kill'; enemy: string; n: number }
  | { a: 'chapter'; n: number }
  | { a: 'equip'; badge: string; on: boolean }
  | { a: 'exp'; n: number }
  | { a: 'battleWon' }
  | { a: 'partyVitals'; hp: Record<string, number>; sp: Record<string, number> };

export function invCount(state: SaveData, id: string): number {
  return state.inventory.find((e) => e.id === id)?.qty ?? 0;
}

function addItem(state: SaveData, id: string, qty: number): void {
  if (!ITEMS[id] || qty === 0) return;
  const e = state.inventory.find((x) => x.id === id);
  const max = ITEMS[id].kind === 'key' || ITEMS[id].kind === 'collectible' || ITEMS[id].kind === 'badge' ? 1 : 99;
  if (e) e.qty = Math.max(0, Math.min(max, e.qty + qty));
  else if (qty > 0) state.inventory.push({ id, qty: Math.min(max, qty) });
  state.inventory = state.inventory.filter((x) => x.qty > 0);
  if (qty > 0 && ITEMS[id].kind === 'collectible' && !state.collectedItems.includes(id)) state.collectedItems.push(id);
}

/** Evaluates a condition string against state: "a&!b&quest:q1&done:q2&item:x&chapter>=3". */
export function cond(state: SaveData, c: string | undefined): boolean {
  if (!c) return true;
  return c.split('&').every((raw) => {
    const term = raw.trim();
    if (!term) return true;
    const neg = term.startsWith('!');
    const t = neg ? term.slice(1) : term;
    let v: boolean;
    if (t.startsWith('quest:')) v = state.activeQuests.some((q) => q.id === t.slice(6));
    else if (t.startsWith('done:')) v = state.completedQuests.includes(t.slice(5));
    else if (t.startsWith('item:')) v = invCount(state, t.slice(5)) > 0;
    else if (t.startsWith('partner:')) v = state.partners.unlocked.includes(t.slice(8) as CharId);
    else if (t.includes('=')) {
      const [k, val] = t.split('=');
      v = String(state.storyFlags[k] ?? '') === val;
    } else v = !!state.storyFlags[t];
    return neg ? !v : v;
  });
}

/** Apply one action to state. Emits UI events. Must be deterministic. */
export function applyAction(state: SaveData, act: GameAction, ctx: { local: SaveData | null; multi: boolean }): void {
  switch (act.a) {
    case 'flag':
      state.storyFlags[act.k] = act.v;
      bus.emit('flag:set', act.k, act.v);
      break;
    case 'give':
      addItem(state, act.item, act.qty);
      if (!act.silent) bus.emit('item:gained', act.item, act.qty);
      if (ITEMS[act.item]?.kind === 'key') bus.emit('autosave', 'key-item');
      break;
    case 'take':
      addItem(state, act.item, -act.qty);
      break;
    case 'coins':
      state.coins = Math.max(0, Math.min(999999, state.coins + act.n));
      break;
    case 'chest':
      state.storyFlags[`chest:${act.id}`] = true;
      for (const it of act.items) {
        addItem(state, it.id, it.qty);
        bus.emit('item:gained', it.id, it.qty);
      }
      if (act.coins) {
        state.coins += act.coins;
        bus.emit('coins:gained', act.coins);
      }
      state.stats.chestsOpened++;
      bus.emit('chest:opened', act.id);
      break;
    case 'questStart':
      if (!state.activeQuests.some((q) => q.id === act.id) && !state.completedQuests.includes(act.id) && QUESTS[act.id]) {
        state.activeQuests.push({ id: act.id, startedAt: Date.now() });
        bus.emit('quest:started', act.id);
      }
      break;
    case 'questDone': {
      const q = QUESTS[act.id];
      if (!q || state.completedQuests.includes(act.id)) break;
      state.activeQuests = state.activeQuests.filter((x) => x.id !== act.id);
      state.completedQuests.push(act.id);
      if (q.takeItems && q.objective.kind === 'collect') addItem(state, q.objective.item, -q.objective.count);
      if (q.reward?.coins) state.coins += q.reward.coins;
      for (const it of q.reward?.items ?? []) addItem(state, it.id, it.qty);
      bus.emit('quest:completed', act.id);
      bus.emit('autosave', 'quest');
      break;
    }
    case 'join':
      if (!ctx.multi && !state.partners.unlocked.includes(act.partner) && act.partner !== 'mametchi') {
        state.partners.unlocked.push(act.partner);
        const st = statsAt(act.partner, state.playerLevel);
        state.partners.hp[act.partner] = st.maxHP;
        state.partners.sp[act.partner] = st.maxSP;
        state.partners.active = act.partner;
      }
      state.storyFlags[`joined:${act.partner}`] = true;
      bus.emit('partner:joined', act.partner);
      break;
    case 'setPartner':
      if (act.partner === null || state.partners.unlocked.includes(act.partner)) state.partners.active = act.partner;
      bus.emit('partner:changed', act.partner);
      break;
    case 'kill': {
      const k = `kill:${act.enemy}`;
      state.storyFlags[k] = (Number(state.storyFlags[k]) || 0) + act.n;
      state.stats.enemiesDefeated += act.n;
      break;
    }
    case 'battleWon':
      state.stats.battlesWon++;
      break;
    case 'chapter':
      state.currentChapter = act.n;
      state.currentMap = `ch${act.n}`;
      state.position = { x: -1, z: -1 };
      if (!state.unlockedAreas.includes(`ch${act.n}`)) {
        state.unlockedAreas.push(`ch${act.n}`);
        bus.emit('area:unlocked', act.n);
      }
      bus.emit('autosave', 'chapter');
      break;
    case 'equip': {
      const b = state.equipment.badges;
      if (act.on) {
        if (!b.includes(act.badge) && b.length < BADGE_SLOTS && invCount(state, act.badge) > 0) b.push(act.badge);
      } else state.equipment.badges = b.filter((x) => x !== act.badge);
      bus.emit('equip:changed');
      break;
    }
    case 'exp':
      // EXP always goes to the local player's own save (in multiplayer each peer levels its own character).
      if (ctx.local) bus.emit('exp:apply', act.n);
      break;
    case 'partyVitals':
      if (!ctx.multi) {
        if (act.hp.hero !== undefined) state.playerHP = act.hp.hero;
        if (act.sp.hero !== undefined) state.playerSP = act.sp.hero;
        for (const k of Object.keys(act.hp)) if (k !== 'hero') state.partners.hp[k] = act.hp[k];
        for (const k of Object.keys(act.sp)) if (k !== 'hero') state.partners.sp[k] = act.sp[k];
      }
      break;
  }
  bus.emit('state:changed', act);
}

/** Returns quest-complete actions that became true for the current state. */
export function deriveQuestCompletions(state: SaveData): GameAction[] {
  const out: GameAction[] = [];
  for (const aq of state.activeQuests) {
    const q = QUESTS[aq.id];
    if (!q) continue;
    const o = q.objective;
    let done = false;
    if (o.kind === 'flag') done = !!state.storyFlags[o.flag];
    else if (o.kind === 'flags') done = o.flags.every((f) => !!state.storyFlags[f]);
    else if (o.kind === 'collect') done = invCount(state, o.item) >= o.count;
    else if (o.kind === 'defeat') done = (Number(state.storyFlags[`kill:${o.enemy}`]) || 0) >= o.count;
    if (done) out.push({ a: 'questDone', id: q.id });
  }
  return out;
}
