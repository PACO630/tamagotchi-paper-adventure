/** Inventory helpers: field item use, equipment, categorisation. */
import { bus } from '../core/events';
import { G } from '../core/game';
import { ITEMS } from '../data/items';
import type { ItemKind } from '../data/types';
import { invCount } from './actions';
import { audio } from './audio';
import { BADGE_SLOTS } from './saveSchema';

export const CATEGORY: Record<string, ItemKind[]> = {
  消耗品: ['heal', 'sp', 'buff', 'battle', 'revive', 'cure'],
  徽章: ['badge'],
  重要道具: ['key'],
  收藏品: ['collectible'],
};

export function itemsOf(kinds: ItemKind[]) {
  return G.state.inventory.filter((e) => kinds.includes(ITEMS[e.id]?.kind)).map((e) => ({ ...e, def: ITEMS[e.id] }));
}

export function quickItems(): string[] {
  return G.state.inventory.filter((e) => ITEMS[e.id]?.fieldUse).slice(0, 3).map((e) => e.id);
}

/** Uses a field-usable item on a party member (single player) or asks the host (multiplayer). */
export function useFieldItem(itemId: string, targetKey: string): string | null {
  const it = ITEMS[itemId];
  if (!it || !it.fieldUse) return '這個道具不能在這裡使用。';
  if (invCount(G.state, itemId) <= 0) return '道具不夠了。';
  if (G.mode === 'multi') {
    bus.emit('net:useItem', itemId, targetKey);
    audio.sfx('heal');
    return null;
  }
  const party = G.buildParty();
  const targets = it.target === 'allAllies' ? party : party.filter((m) => m.key === targetKey);
  if (!targets.length) return '沒有目標。';
  const full = targets.every((m) => m.hp >= m.stats.maxHP && m.sp >= m.stats.maxSP);
  if (full && it.kind !== 'cure') return '已經是滿的了！';
  const hp: Record<string, number> = {}, sp: Record<string, number> = {};
  for (const m of targets) {
    hp[m.key] = Math.min(m.stats.maxHP, m.hp + (it.hp ?? 0));
    sp[m.key] = Math.min(m.stats.maxSP, m.sp + (it.sp ?? 0));
  }
  G.dispatch({ a: 'take', item: itemId, qty: 1 });
  G.dispatch({ a: 'partyVitals', hp, sp });
  audio.sfx('heal');
  bus.emit('hud:dirty');
  return null;
}

export function toggleBadge(id: string): string | null {
  const eq = G.state.equipment.badges;
  if (eq.includes(id)) { G.dispatch({ a: 'equip', badge: id, on: false }); return null; }
  if (eq.length >= BADGE_SLOTS) return `最多只能裝備 ${BADGE_SLOTS} 個徽章。`;
  G.dispatch({ a: 'equip', badge: id, on: true });
  return null;
}
