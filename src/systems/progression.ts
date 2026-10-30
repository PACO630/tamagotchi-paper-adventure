import { MAX_LEVEL } from '../core/config';
import { bus } from '../core/events';
import { expToNext, skillsAt, statsAt } from '../data/characters';
import { ITEMS } from '../data/items';
import type { CharId, Stats } from '../data/types';
import type { SaveData } from './saveSchema';

/** Applies EXP to a save (Mametchi + partners share the level). Returns number of levels gained. */
export function gainExp(save: SaveData, amount: number): number {
  if (amount <= 0) return 0;
  save.playerExp += Math.floor(amount);
  let gained = 0;
  while (save.playerLevel < MAX_LEVEL && save.playerExp >= expToNext(save.playerLevel)) {
    save.playerExp -= expToNext(save.playerLevel);
    save.playerLevel++;
    gained++;
  }
  if (save.playerLevel >= MAX_LEVEL) save.playerExp = 0;
  if (gained > 0) {
    const before = save.skills.slice();
    save.playerStats = statsAt('mametchi', save.playerLevel);
    save.skills = skillsAt('mametchi', save.playerLevel);
    const eff = effectiveStats(save.playerStats, save.equipment.badges);
    save.playerHP = eff.maxHP;
    save.playerSP = eff.maxSP;
    // partners are fully restored as well
    for (const p of save.partners.unlocked) {
      const ps = statsAt(p, save.playerLevel);
      save.partners.hp[p] = ps.maxHP;
      save.partners.sp[p] = ps.maxSP;
    }
    const newSkills = save.skills.filter((s) => !before.includes(s));
    bus.emit('levelup', { level: save.playerLevel, newSkills });
  }
  return gained;
}

export function badgeBonus(badges: string[]): Stats & { specials: Set<string> } {
  const out = { maxHP: 0, maxSP: 0, atk: 0, def: 0, specials: new Set<string>() };
  for (const b of badges) {
    const d = ITEMS[b]?.badge;
    if (!d) continue;
    out.maxHP += d.maxHP ?? 0;
    out.maxSP += d.maxSP ?? 0;
    out.atk += d.atk ?? 0;
    out.def += d.def ?? 0;
    if (d.special) out.specials.add(d.special);
  }
  return out;
}

export function effectiveStats(base: Stats, badges: string[]): Stats {
  const b = badgeBonus(badges);
  return {
    maxHP: base.maxHP + b.maxHP,
    maxSP: base.maxSP + b.maxSP,
    atk: Math.max(0, base.atk + b.atk),
    def: Math.max(0, base.def + b.def),
  };
}

export function partnerStats(id: CharId, level: number): Stats {
  return statsAt(id, level);
}

export function levelProgress(save: SaveData): { cur: number; need: number } {
  return { cur: save.playerExp, need: expToNext(save.playerLevel) };
}
