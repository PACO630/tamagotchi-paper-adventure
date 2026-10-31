/**
 * Turn-based battle rules (Paper-RPG style action commands). Runs only on the authority
 * (single player, or the multiplayer host). Everything visual goes through BattleIO.
 */
import { G, type PartyMember } from '../core/game';
import { weightedPick } from '../core/util';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import type { CharId, EnemyMove, SkillDef, StatusSpec, StatusType } from '../data/types';
import { badgeBonus } from '../systems/progression';
import type { BattleOutcome, BattleReward, BattleSetup, CommandSpec, Fighter, FxStep, GuardResult, MenuChoice, Quality } from './battleTypes';

export interface BattleIO {
  menu(f: Fighter, core: BattleCore): Promise<MenuChoice>;
  command(controller: string, spec: CommandSpec): Promise<Quality | number>;
  guard(controller: string, spec: { attacker: string; target: string; hard: boolean; badges: string[] }): Promise<GuardResult>;
  play(steps: FxStep[]): Promise<void>;
  sync(core: BattleCore): void;
}

const Q_MULT: Record<Quality, number> = { great: 1.5, nice: 1.25, ok: 1, none: 0.8 };
const Q_LABEL: Record<Quality, string> = { great: 'Great!', nice: 'Nice!', ok: '', none: '' };

let uidCounter = 0;

export function fighterFromMember(m: PartyMember): Fighter {
  return {
    id: 'p:' + m.key, side: 'party', name: m.name, charId: m.charId, hp: m.hp, maxHP: m.stats.maxHP, sp: m.sp, maxSP: m.stats.maxSP,
    atk: m.stats.atk, def: m.stats.def, statuses: [], traits: [], controller: m.controller, skills: m.skills, badges: m.badges,
    defending: false, phase: 0, charging: false, shielded: false, counter: false, countdown: 0, jumpHits: 0, groundedTurns: 0, scale: 1,
  };
}

export function fighterFromEnemy(enemyId: string): Fighter {
  const d = ENEMIES[enemyId];
  return {
    id: `e:${enemyId}:${++uidCounter}`, side: 'enemy', name: d.name, enemyId, hp: d.hp, maxHP: d.hp, sp: 0, maxSP: 0, atk: d.atk, def: d.def,
    statuses: [], traits: [...d.traits], controller: 'ai', skills: [], badges: [], defending: false, phase: 0, charging: false,
    shielded: false, counter: false, countdown: 0, jumpHits: 0, groundedTurns: 0, scale: d.art.size ?? 1,
  };
}

export class BattleCore {
  party: Fighter[];
  enemies: Fighter[];
  round = 0;
  ended = false;
  log: string[] = [];
  lastPartySkill: SkillDef | null = null;
  highTide = false;
  darkness = false;
  barrier = false;
  teamUnlocked = false;
  private killed: Record<string, number> = {};
  private fled = false;

  constructor(public setup: BattleSetup, private io: BattleIO) {
    this.party = setup.party;
    this.enemies = setup.enemies;
  }

  get all(): Fighter[] {
    return [...this.party, ...this.enemies];
  }

  byId(id: string): Fighter | undefined {
    return this.all.find((f) => f.id === id);
  }

  alive(side: 'party' | 'enemy'): Fighter[] {
    return (side === 'party' ? this.party : this.enemies).filter((f) => f.hp > 0);
  }

  has(f: Fighter, s: StatusType): boolean {
    return f.statuses.some((x) => x.type === s);
  }

  statusAmt(f: Fighter, s: StatusType): number {
    return f.statuses.filter((x) => x.type === s).reduce((a, b) => a + b.amount, 0);
  }

  atkOf(f: Fighter): number {
    let a = f.atk + this.statusAmt(f, 'atkUp') - this.statusAmt(f, 'atkDown');
    if (f.side === 'party' && this.highTide) a -= 1;
    if (f.side === 'enemy' && this.highTide) a += 2;
    return Math.max(0, a);
  }

  defOf(f: Fighter): number {
    let d = f.def + this.statusAmt(f, 'defUp') - this.statusAmt(f, 'defDown') + (f.defending ? 1 : 0);
    if (f.side === 'enemy' && f.enemyId === 'castle_knight' && this.enemies.some((e) => e.enemyId === 'mirror_decoy' && e.hp > 0)) d += 3;
    return Math.max(0, d);
  }

  isFlying(f: Fighter): boolean {
    return f.traits.includes('flying') && f.groundedTurns <= 0 && !this.has(f, 'dizzy');
  }

  /* ======================= main loop ======================= */

  async run(): Promise<BattleOutcome> {
    this.io.sync(this);
    const intro: FxStep[] = [{ t: 'text', text: this.setup.boss ? `${this.enemies[0].name} 出現了！` : `${this.enemies.map((e) => e.name).join('、')} 出現了！`, ms: 900 }];
    // bosses (and the grey brothers) have something to say before the fight
    for (const e of this.enemies) for (const l of ENEMIES[e.enemyId!]?.intro ?? []) intro.push({ t: 'talk', who: l.who, text: l.text, face: l.face, ms: 2300 });
    await this.io.play(intro);

    if (this.setup.first === 'party' && this.setup.firstKind) {
      const t = this.enemies[0];
      const hero = this.party[0];
      const dmg = Math.max(1, this.atkOf(hero) + (this.setup.firstKind === 'hammer' ? 1 : 0) - this.defOf(t));
      t.hp = Math.max(0, t.hp - dmg);
      await this.io.play([{ t: 'text', text: '先制攻擊！', ms: 600 }, { t: 'sfx', id: 'crit' }, { t: 'hit', dst: t.id, dmg, label: 'First Strike!', hp: t.hp }]);
      await this.checkDeaths();
    }

    let enemyFirst = this.setup.first === 'enemy';
    while (!this.ended) {
      this.round++;
      for (const f of this.all) { f.jumpHits = 0; }
      if (enemyFirst) {
        await this.io.play([{ t: 'text', text: '被偷襲了！', ms: 600 }]);
        await this.enemyPhase();
        enemyFirst = false;
        if (this.ended) break;
      }
      await this.partyPhase();
      if (this.ended) break;
      await this.enemyPhase();
    }
    return this.outcome();
  }

  private outcome(): BattleOutcome {
    const won = this.alive('enemy').length === 0 && !this.fled;
    const reward: BattleReward = { exp: 0, coins: 0, items: [], kills: this.killed };
    if (won) {
      const coinBadge = this.party.some((p) => p.badges.includes('b_coin'));
      for (const [eid, n] of Object.entries(this.killed)) {
        const d = ENEMIES[eid];
        reward.exp += d.exp * n;
        reward.coins += d.coins * n * (coinBadge ? 2 : 1);
        for (let i = 0; i < n; i++) for (const dr of d.drops ?? []) if (Math.random() < dr.chance) {
          const ex = reward.items.find((x) => x.id === dr.item);
          if (ex) ex.qty++; else reward.items.push({ id: dr.item, qty: 1 });
        }
      }
    }
    return {
      result: this.fled ? 'flee' : won ? 'win' : 'lose',
      reward,
      party: this.party.map((p) => ({ id: p.id, hp: Math.max(won || this.fled ? 1 : 0, p.hp), sp: p.sp })),
    };
  }

  private async partyPhase(): Promise<void> {
    // final boss darkness drains SP
    if (this.darkness) {
      for (const p of this.alive('party')) p.sp = Math.max(0, p.sp - 1);
    }
    for (const f of [...this.party]) {
      if (this.ended) return;
      if (f.hp <= 0) continue;
      f.defending = false;
      const skip = await this.startOfTurn(f);
      if (this.ended) return;
      if (skip || f.hp <= 0) continue;
      this.io.sync(this);
      const choice = await this.io.menu(f, this);
      await this.doPartyAction(f, choice);
      await this.checkDeaths();
      this.io.sync(this);
      if (this.fled) { this.ended = true; return; }
    }
  }

  private async enemyPhase(): Promise<void> {
    // tide toggles every 2 rounds when the abyss guardian is around
    if (this.enemies.some((e) => e.enemyId === 'abyss_guardian' && e.hp > 0) && this.round % 2 === 0) {
      this.highTide = !this.highTide;
      await this.io.play([{ t: 'text', text: this.highTide ? '漲潮了！我方攻擊力下降，守護者變強了！' : '退潮了！海水安靜下來。', ms: 1100 }, { t: 'shake' }]);
    }
    for (const e of [...this.enemies]) {
      if (this.ended) return;
      if (e.hp <= 0) continue;
      e.defending = false;
      const skip = await this.startOfTurn(e);
      if (this.ended) return;
      if (skip || e.hp <= 0) continue;
      await this.doEnemyAction(e);
      await this.checkDeaths();
      this.io.sync(this);
    }
  }

  /** Status ticks. Returns true if the fighter loses the turn. */
  private async startOfTurn(f: Fighter): Promise<boolean> {
    const steps: FxStep[] = [];
    let skip = false;
    for (const s of f.statuses) {
      if (s.type === 'poison' || s.type === 'burn') {
        f.hp = Math.max(f.side === 'party' ? 0 : 1, f.hp - s.amount);
        steps.push({ t: 'hit', dst: f.id, dmg: s.amount, label: s.type === 'poison' ? '中毒' : '燒傷', hp: f.hp });
      }
      if (s.type === 'regen') {
        f.hp = Math.min(f.maxHP, f.hp + s.amount);
        steps.push({ t: 'heal', dst: f.id, hp: s.amount, hpNow: f.hp, spNow: f.sp });
      }
      if (s.type === 'sleep' || s.type === 'dizzy' || s.type === 'stuck') skip = true;
    }
    if (f.groundedTurns > 0) {
      f.groundedTurns--;
      if (f.groundedTurns === 0) steps.push({ t: 'text', text: `${f.name} 又飛回空中了！`, ms: 700 });
    }
    // countdown mechanic (super robot)
    if (f.countdown > 0 && f.side === 'enemy') {
      f.countdown--;
      if (f.countdown === 0) {
        steps.push({ t: 'text', text: '自爆程序……發動！', ms: 800 }, { t: 'shake' }, { t: 'fx', name: 'explode', at: f.id });
        for (const p of this.alive('party')) {
          const dmg = Math.max(1, this.atkOf(f) + 4 - this.defOf(p));
          p.hp = Math.max(0, p.hp - dmg);
          steps.push({ t: 'hit', dst: p.id, dmg, hp: p.hp });
        }
        f.countdown = 3;
        steps.push({ t: 'text', text: '機器人過熱了，重新開始倒數！', ms: 800 });
        skip = true;
      } else {
        steps.push({ t: 'text', text: `自爆倒數：${f.countdown}`, ms: 700 });
      }
    }
    // final boss regen phase of the tree king
    if (f.enemyId === 'candy_tree_king' && f.phase >= 1) {
      f.hp = Math.min(f.maxHP, f.hp + 5);
      steps.push({ t: 'heal', dst: f.id, hp: 5, hpNow: f.hp, spNow: 0 });
    }
    // decrement statuses
    const expired: StatusType[] = [];
    f.statuses = f.statuses.filter((s) => {
      s.turns--;
      if (s.turns <= 0) { expired.push(s.type); return false; }
      return true;
    });
    for (const t of expired) steps.push({ t: 'status', dst: f.id, status: t, on: false });
    if (skip && f.hp > 0) steps.push({ t: 'text', text: `${f.name} 無法行動！`, ms: 650 });
    if (steps.length) await this.io.play(steps);
    await this.checkDeaths();
    return skip;
  }

  /* ======================= party actions ======================= */

  canUse(f: Fighter, choice: MenuChoice): string | null {
    if (choice.kind === 'skill') {
      const s = SKILLS[choice.skill!];
      if (!s) return '沒有這個技能';
      if (f.sp < this.skillCost(s)) return '技能點數不夠！';
    }
    if (choice.kind === 'flee' && this.setup.boss) return '這場戰鬥無法逃跑！';
    if (choice.kind === 'team' && !this.teamUnlocked) return '還不能使用';
    return null;
  }

  skillCost(s: SkillDef): number {
    return this.darkness ? Math.ceil(s.sp * 1.5) : s.sp;
  }

  private async doPartyAction(f: Fighter, c: MenuChoice): Promise<void> {
    const hard = this.darkness;
    if (c.kind === 'defend') {
      f.defending = true;
      f.sp = Math.min(f.maxSP, f.sp + 1);
      await this.io.play([{ t: 'anim', who: f.id, anim: 'defend' }, { t: 'text', text: `${f.name} 擺出防禦姿勢！（防禦+1，回復 1 技能點數）`, ms: 800 }]);
      return;
    }
    if (c.kind === 'flee') {
      const ok = Math.random() < 0.65;
      if (ok) {
        this.fled = true;
        await this.io.play([{ t: 'sfx', id: 'escape' }, { t: 'text', text: '成功逃跑了！', ms: 800 }]);
      } else {
        await this.io.play([{ t: 'text', text: '逃跑失敗！', ms: 800 }]);
      }
      return;
    }
    if (c.kind === 'item') return this.useItem(f, c.item!, c.target);
    const skill = c.kind === 'hammer' ? SKILLS.hammer : c.kind === 'jump' ? SKILLS.jump : c.kind === 'team' ? SKILLS.star_harmony : SKILLS[c.skill!];
    if (c.kind === 'skill') {
      f.sp -= this.skillCost(skill);
      this.lastPartySkill = skill;
    }
    await this.useSkill(f, skill, c.target, hard);
  }

  private targetsFor(f: Fighter, skill: SkillDef, target?: string): Fighter[] {
    switch (skill.target) {
      case 'enemy': { const t = this.byId(target ?? ''); return t && t.hp > 0 && t.side === 'enemy' ? [t] : this.alive('enemy').slice(0, 1); }
      case 'allEnemies': return this.alive('enemy');
      case 'ally': { const t = this.byId(target ?? ''); return t && t.side === 'party' ? [t] : [f]; }
      case 'allAllies': return this.alive('party');
      case 'self': return [f];
    }
  }

  private async useSkill(f: Fighter, skill: SkillDef, target: string | undefined, hard: boolean): Promise<void> {
    const targets = this.targetsFor(f, skill, target);
    if (!targets.length) return;
    const steps: FxStep[] = [];
    const first = targets[0];
    const physical = skill.id === 'hammer' || skill.id === 'jump';

    // command minigame (the acting player's device)
    let quality: Quality = 'ok';
    let bounces = 1;
    if (skill.command === 'jump') {
      const cap = skill.hits ?? 2;
      const r = await this.io.command(f.controller, { cmd: 'jump', actor: f.id, target: first.id, hits: cap, hard });
      bounces = Math.max(1, Math.min(cap, typeof r === 'number' ? r : 1));
    } else if (skill.command !== 'none') {
      const r = await this.io.command(f.controller, { cmd: skill.command, actor: f.id, target: first.id, hard, len: skill.kind === 'team' ? 6 : 4 });
      quality = (typeof r === 'string' ? r : 'ok') as Quality;
    }

    if (skill.kind === 'damage' || skill.kind === 'drain' || skill.kind === 'team') {
      if (skill.target === 'enemy' || physical) steps.push({ t: 'approach', who: f.id, to: first.id, jump: skill.command === 'jump' });
      steps.push({ t: 'anim', who: f.id, anim: skill.command === 'jump' ? 'jump' : 'attack' });
      steps.push({ t: 'fx', name: skill.fx, at: skill.target === 'allEnemies' ? 'enemies' : first.id });
      for (const t of targets) {
        const hits = skill.command === 'jump' ? bounces : skill.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          if (t.hp <= 0) break;
          // physical restrictions
          if (skill.id === 'hammer' && this.isFlying(t)) { steps.push({ t: 'miss', dst: t.id, text: '打不到天上的敵人！' }); break; }
          if (!skill.hitsFlying && skill.id !== 'hammer' && this.isFlying(t) && skill.target === 'enemy') { steps.push({ t: 'miss', dst: t.id, text: '打不到！' }); break; }
          if (skill.command === 'jump' && t.traits.includes('spiky') && !f.badges.includes('b_spike')) {
            const self = 1 + Math.floor(this.round / 4);
            f.hp = Math.max(0, f.hp - self);
            steps.push({ t: 'hit', dst: f.id, dmg: self, label: '好刺！', hp: f.hp });
            break;
          }
          if (t.traits.includes('fiery') && skill.command === 'jump' && Math.random() < 0.5) {
            f.hp = Math.max(0, f.hp - 1);
            steps.push({ t: 'hit', dst: f.id, dmg: 1, label: '好燙！', hp: f.hp });
          }
          if (physical && t.counter) {
            const dmg = Math.max(1, this.atkOf(t) - this.defOf(f));
            f.hp = Math.max(0, f.hp - dmg);
            steps.push({ t: 'text', text: '被反擊了！', ms: 600 }, { t: 'hit', dst: f.id, dmg, label: 'Counter!', hp: f.hp });
            t.counter = false;
            break;
          }
          if (t.traits.includes('ghost') && skill.id === 'hammer' && Math.random() < 0.5) { steps.push({ t: 'miss', dst: t.id, text: '穿過去了！' }); continue; }
          if (this.has(f, 'blind') && Math.random() < 0.5) { steps.push({ t: 'miss', dst: t.id, text: 'Miss' }); continue; }
          // barrier (final boss phase 3)
          if (t.enemyId === 'eternatchi' && this.barrier && skill.kind !== 'team') { steps.push({ t: 'miss', dst: t.id, text: '永恆之壁擋住了！' }); continue; }
          // icing shield (tree king): only the hammer breaks it
          if (t.shielded) {
            if (skill.id === 'hammer') {
              t.shielded = false;
              steps.push({ t: 'text', text: '糖霜護盾被敲碎了！', ms: 600 }, { t: 'sfx', id: 'break' });
            } else { steps.push({ t: 'miss', dst: t.id, text: '糖霜護盾擋住了！' }); continue; }
          }
          let dmg = this.calcDamage(f, t, skill, quality, h);
          if (skill.kind === 'team') {
            const sumAtk = this.alive('party').reduce((s, p) => s + this.atkOf(p), 0);
            dmg = Math.round((sumAtk + skill.power * this.alive('party').length) * Q_MULT[quality]);
          }
          if (t.statuses.some((s) => s.type === 'shield')) {
            t.statuses = t.statuses.filter((s) => s.type !== 'shield');
            steps.push({ t: 'miss', dst: t.id, text: '護盾擋下了！' }, { t: 'status', dst: t.id, status: 'shield', on: false });
            continue;
          }
          t.hp = Math.max(0, t.hp - dmg);
          const label = skill.command === 'jump' ? (h > 0 ? 'Nice!' : '') : Q_LABEL[quality];
          steps.push({ t: 'sfx', id: quality === 'great' ? 'crit' : physical && skill.id === 'jump' ? 'stomp' : 'hit' });
          steps.push({ t: 'hit', dst: t.id, dmg, label, crit: quality === 'great', hp: t.hp });
          // wake on hit
          if (this.has(t, 'sleep') && Math.random() < 0.5) { t.statuses = t.statuses.filter((s) => s.type !== 'sleep'); steps.push({ t: 'status', dst: t.id, status: 'sleep', on: false }); }
          if (skill.kind === 'drain' || (physical && f.badges.includes('b_vampire'))) {
            const heal = skill.kind === 'drain' ? Math.max(1, Math.floor(dmg / 2)) : 1;
            f.hp = Math.min(f.maxHP, f.hp + heal);
            steps.push({ t: 'heal', dst: f.id, hp: heal, hpNow: f.hp, spNow: f.sp });
          }
          if (skill.command === 'jump') t.jumpHits++;
          if (skill.status && t.hp > 0) this.tryStatus(t, skill.status, steps, quality);
        }
        // airborne dragon falls after 2 stomps in a round
        if (t.enemyId === 'storm_dragon' && t.jumpHits >= 2 && t.groundedTurns <= 0 && t.hp > 0) {
          t.groundedTurns = 2;
          steps.push({ t: 'text', text: `${t.name} 被踩得掉到地上了！鎚子現在打得到了！`, ms: 1000 }, { t: 'shake' });
        }
      }
      steps.push({ t: 'return', who: f.id });
    } else if (skill.kind === 'heal') {
      steps.push({ t: 'anim', who: f.id, anim: 'cast' }, { t: 'fx', name: skill.fx, at: targets[0].id });
      for (const t of targets) {
        if (t.hp <= 0) continue;
        let hp = Math.round(skill.power * Q_MULT[quality]);
        let sp = 0;
        if (skill.id === 'old_wisdom') { hp = 0; sp = Math.round(5 * Q_MULT[quality]); }
        t.hp = Math.min(t.maxHP, t.hp + hp);
        t.sp = Math.min(t.maxSP, t.sp + sp);
        steps.push({ t: 'sfx', id: 'heal' }, { t: 'heal', dst: t.id, hp: hp || undefined, sp: sp || undefined, hpNow: t.hp, spNow: t.sp });
        if (skill.status) this.tryStatus(t, skill.status, steps, quality);
      }
    } else {
      // buff / debuff
      steps.push({ t: 'anim', who: f.id, anim: 'cast' }, { t: 'fx', name: skill.fx, at: skill.target.includes('Enem') || skill.target === 'enemy' ? first.id : f.id });
      for (const t of targets) if (skill.status && t.hp > 0) this.tryStatus(t, skill.status, steps, quality);
    }
    await this.io.play(steps);
  }

  calcDamage(src: Fighter, dst: Fighter, skill: SkillDef, q: Quality, hitIdx = 0): number {
    const base = this.atkOf(src) + skill.power;
    const raw = Math.round(base * Q_MULT[q]) + (skill.command === 'jump' && hitIdx > 0 ? 0 : 0);
    const def = skill.pierce ? 0 : this.defOf(dst);
    return Math.max(1, raw - def);
  }

  private tryStatus(t: Fighter, s: StatusSpec, steps: FxStep[], q: Quality = 'ok'): void {
    const bonus = q === 'great' ? 0.2 : q === 'nice' ? 0.1 : 0;
    const resist = t.traits.includes('boss') && ['sleep', 'dizzy', 'stuck'].includes(s.type) ? 0.35 : 1;
    if (Math.random() > (s.chance + bonus) * resist) return;
    const ex = t.statuses.find((x) => x.type === s.type);
    if (ex) { ex.turns = Math.max(ex.turns, s.turns + 1); }
    else t.statuses.push({ type: s.type, turns: s.turns + 1, amount: s.amount ?? 1 });
    steps.push({ t: 'status', dst: t.id, status: s.type, on: true });
  }

  private async useItem(f: Fighter, itemId: string, target?: string): Promise<void> {
    const it = ITEMS[itemId];
    if (!it) return;
    G.dispatch({ a: 'take', item: itemId, qty: 1 });
    const steps: FxStep[] = [{ t: 'anim', who: f.id, anim: 'cast' }, { t: 'text', text: `${f.name} 使用了 ${it.name}！`, ms: 700 }];
    const tgt = this.byId(target ?? '') ?? f;
    let targets: Fighter[];
    switch (it.target) {
      case 'allAllies': targets = this.alive('party'); break;
      case 'allEnemies': targets = this.alive('enemy'); break;
      case 'enemy': targets = tgt.side === 'enemy' && tgt.hp > 0 ? [tgt] : this.alive('enemy').slice(0, 1); break;
      default: targets = [tgt.side === 'party' ? tgt : f];
    }
    for (const t of targets) {
      if (it.kind === 'revive') {
        if (t.hp > 0) { steps.push({ t: 'miss', dst: t.id, text: '沒有效果' }); continue; }
        t.hp = Math.max(1, Math.floor(t.maxHP * (it.hp ?? 50) / 100));
        steps.push({ t: 'sfx', id: 'heal' }, { t: 'revive', dst: t.id, hp: t.hp });
        continue;
      }
      if (t.hp <= 0) continue;
      if (it.damage) {
        steps.push({ t: 'fx', name: it.id === 'thunder_bomb' ? 'beam' : 'fire', at: t.id });
        if (t.enemyId === 'eternatchi' && this.barrier) { steps.push({ t: 'miss', dst: t.id, text: '永恆之壁擋住了！' }); continue; }
        t.hp = Math.max(0, t.hp - it.damage);
        steps.push({ t: 'sfx', id: 'hit' }, { t: 'hit', dst: t.id, dmg: it.damage, hp: t.hp });
      }
      if (it.hp) { t.hp = Math.min(t.maxHP, t.hp + it.hp); }
      if (it.sp) { t.sp = Math.min(t.maxSP, t.sp + it.sp); }
      if (it.hp || it.sp) steps.push({ t: 'sfx', id: 'heal' }, { t: 'heal', dst: t.id, hp: it.hp, sp: it.sp, hpNow: t.hp, spNow: t.sp });
      if (it.kind === 'cure') {
        const bad: StatusType[] = ['poison', 'burn', 'sleep', 'dizzy', 'stuck', 'atkDown', 'defDown', 'blind'];
        for (const s of t.statuses.filter((x) => bad.includes(x.type))) steps.push({ t: 'status', dst: t.id, status: s.type, on: false });
        t.statuses = t.statuses.filter((x) => !bad.includes(x.type));
      }
      if (it.status) this.tryStatus(t, it.status, steps);
    }
    await this.io.play(steps);
  }

  /* ======================= enemy AI ======================= */

  private async doEnemyAction(e: Fighter): Promise<void> {
    const def = ENEMIES[e.enemyId!];
    const targets = this.alive('party');
    if (!targets.length) return;

    // charged super attack
    if (e.charging) {
      e.charging = false;
      await this.enemyAttack(e, { id: 'super', name: '超級雷射', kind: 'attack', power: 6, target: 'all', weight: 1 });
      return;
    }
    e.counter = false;

    let moves = def.moves.filter((m) => !m.phase || m.phase.includes(e.phase));
    // smarter AI: heal when low, summon only when room, prefer weakest target
    if (this.alive('enemy').length >= 4) moves = moves.filter((m) => m.kind !== 'summon');
    if (e.hp > e.maxHP * 0.5) moves = moves.filter((m) => m.kind !== 'heal');
    if (def.mechanic === 'icing_shield' && e.shielded) moves = moves.filter((m) => m.id !== 'icing');
    if (!moves.length) moves = def.moves.filter((m) => m.kind === 'attack');
    if (!moves.length) moves = def.moves;
    let move = weightedPick(moves);
    if (def.mechanic === 'summoner' && this.alive('enemy').length < 2 && Math.random() < 0.6) move = def.moves.find((m) => m.kind === 'summon') ?? move;

    switch (move.kind) {
      case 'summon': {
        const steps: FxStep[] = [{ t: 'anim', who: e.id, anim: 'attack' }, { t: 'text', text: `${e.name} 使用了「${move.name}」！`, ms: 700 }];
        for (const sid of move.summon ?? []) {
          if (this.enemies.length >= 5) break;
          const nf = fighterFromEnemy(sid);
          this.enemies.push(nf);
          steps.push({ t: 'spawn', fighter: nf });
        }
        await this.io.play(steps);
        return;
      }
      case 'charge':
        e.charging = true;
        await this.io.play([{ t: 'anim', who: e.id, anim: 'attack' }, { t: 'fx', name: 'charge', at: e.id }, { t: 'text', text: move.msg ?? `${e.name} 正在蓄力！`, ms: 1200 }]);
        return;
      case 'buff': {
        const steps: FxStep[] = [{ t: 'anim', who: e.id, anim: 'attack' }];
        if (move.id === 'icing') { e.shielded = true; steps.push({ t: 'fx', name: 'shield', at: e.id }, { t: 'text', text: move.msg ?? '', ms: 1000 }); }
        else { this.tryStatus(e, { type: 'defUp', turns: 2, chance: 1, amount: 2 }, steps); steps.push({ t: 'text', text: `${e.name} 的防禦提升了！`, ms: 700 }); }
        await this.io.play(steps);
        return;
      }
      case 'heal': {
        const ally = this.alive('enemy').sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP)[0];
        ally.hp = Math.min(ally.maxHP, ally.hp + move.power);
        await this.io.play([{ t: 'anim', who: e.id, anim: 'attack' }, { t: 'text', text: `${e.name} 使用了「${move.name}」！`, ms: 600 }, { t: 'heal', dst: ally.id, hp: move.power, hpNow: ally.hp, spNow: 0 }]);
        return;
      }
      case 'special': {
        if (move.id === 'counter') {
          e.counter = true;
          await this.io.play([{ t: 'anim', who: e.id, anim: 'defend' }, { t: 'fx', name: 'shield', at: e.id }, { t: 'text', text: move.msg ?? '', ms: 1300 }]);
          return;
        }
        if (move.id === 'mimic') {
          const sk = this.lastPartySkill;
          if (!sk || sk.kind === 'buff' || sk.kind === 'debuff') {
            await this.enemyAttack(e, { id: 'dark_hammer', name: '模仿：黑暗鎚', kind: 'attack', power: 2, target: 'one', weight: 1 });
          } else if (sk.kind === 'heal') {
            e.hp = Math.min(e.maxHP, e.hp + sk.power * 2);
            await this.io.play([{ t: 'text', text: `${e.name} 模仿了「${sk.name}」！`, ms: 800 }, { t: 'heal', dst: e.id, hp: sk.power * 2, hpNow: e.hp, spNow: 0 }]);
          } else {
            await this.enemyAttack(e, { id: 'mimic_' + sk.id, name: `模仿：${sk.name}`, kind: 'attack', power: Math.max(1, sk.power), target: sk.target === 'allEnemies' ? 'all' : 'one', weight: 1, status: sk.status });
          }
          return;
        }
        await this.enemyAttack(e, move);
        return;
      }
      default:
        await this.enemyAttack(e, move);
    }
  }

  private async enemyAttack(e: Fighter, move: EnemyMove): Promise<void> {
    const alive = this.alive('party');
    const blind = this.has(e, 'blind');
    let targets: Fighter[];
    if (move.target === 'all') targets = alive;
    else {
      // prefer targets with low HP 40% of the time
      targets = [Math.random() < 0.4 ? alive.slice().sort((a, b) => a.hp - b.hp)[0] : alive[Math.floor(Math.random() * alive.length)]];
    }
    const hits = move.hits ?? 1;
    await this.io.play([{ t: 'text', text: `${e.name}：「${move.name}」！`, ms: 650 }]);
    for (const t of targets) {
      for (let h = 0; h < hits; h++) {
        if (t.hp <= 0) break;
        const steps: FxStep[] = [];
        // the targeted player's device runs the guard command
        const guard = await this.io.guard(t.controller, { attacker: e.id, target: t.id, hard: this.darkness, badges: t.badges });
        steps.push({ t: 'approach', who: e.id, to: t.id }, { t: 'anim', who: e.id, anim: 'attack' });
        if (blind && Math.random() < 0.5) {
          steps.push({ t: 'miss', dst: t.id, text: 'Miss' }, { t: 'return', who: e.id });
          await this.io.play(steps);
          continue;
        }
        if (move.kind !== 'status' || move.power > 0) {
          let dmg = Math.max(1, this.atkOf(e) + move.power - this.defOf(t));
          if (t.statuses.some((s) => s.type === 'shield')) {
            t.statuses = t.statuses.filter((s) => s.type !== 'shield');
            steps.push({ t: 'miss', dst: t.id, text: '護盾擋下了！' }, { t: 'status', dst: t.id, status: 'shield', on: false });
            dmg = 0;
          } else {
            if (guard === 'perfect') dmg = 0;
            else if (guard === 'good') dmg = Math.max(0, dmg - Math.max(1, Math.ceil(dmg * 0.5)));
            t.hp = Math.max(0, t.hp - dmg);
            steps.push({ t: 'sfx', id: guard === 'perfect' ? 'perfect' : guard === 'good' ? 'guard' : 'hurt' });
            steps.push({ t: 'hit', dst: t.id, dmg, guard, hp: t.hp, label: guard === 'perfect' ? 'Perfect!' : guard === 'good' ? 'Guard!' : '' });
            if (guard === 'perfect' && G.local) G.local.stats.perfectGuards++;
          }
          if (move.kind === 'drain' && dmg > 0) {
            e.hp = Math.min(e.maxHP, e.hp + dmg);
            steps.push({ t: 'heal', dst: e.id, hp: dmg, hpNow: e.hp, spNow: 0 });
          }
        }
        if (move.status && guard !== 'perfect' && t.hp > 0) this.tryStatus(t, move.status, steps);
        if (move.kind === 'status' && move.power === 0 && guard === 'perfect') steps.push({ t: 'miss', dst: t.id, text: '完全擋下！' });
        steps.push({ t: 'return', who: e.id });
        await this.io.play(steps);
        this.io.sync(this);
      }
    }
  }

  /* ======================= deaths & phases ======================= */

  private async checkDeaths(): Promise<void> {
    const steps: FxStep[] = [];
    for (const e of this.enemies) {
      const def = ENEMIES[e.enemyId!];
      // boss phases
      if (def.phases && e.hp > 0) {
        while (e.phase < def.phases.length && e.hp <= e.maxHP * def.phases[e.phase].hpBelow) {
          const ph = def.phases[e.phase];
          e.phase++;
          steps.push({ t: 'shake' }, { t: 'fx', name: 'phase', at: e.id });
          for (const l of ph.talk ?? []) steps.push({ t: 'talk', who: l.who, text: l.text, face: l.face, ms: 2300 });
          steps.push({ t: 'text', text: ph.msg, ms: 1600 });
          if (ph.atk !== undefined) e.atk = ph.atk;
          if (ph.def !== undefined) e.def = ph.def;
          if (ph.addTraits) e.traits.push(...ph.addTraits);
          if (ph.removeTraits) e.traits = e.traits.filter((t) => !ph.removeTraits!.includes(t));
          if (ph.mechanic === 'countdown') e.countdown = 4;
          if (ph.mechanic === 'decoys') {
            for (let i = 0; i < 2; i++) { const d = fighterFromEnemy('mirror_decoy'); this.enemies.push(d); steps.push({ t: 'spawn', fighter: d }); }
          }
          if (ph.mechanic === 'darkness') { this.darkness = true; steps.push({ t: 'fx', name: 'darkness', at: e.id }, { t: 'text', text: '黑暗籠罩了戰場！按鍵的時機變難了，技能消耗增加，每回合流失技能點數！', ms: 1800 }); }
          if (ph.mechanic === 'barrier') await this.finalBarrier(e, steps);
        }
      }
      if (e.hp <= 0 && !e.traits.includes('__dead' as any)) {
        (e.traits as string[]).push('__dead');
        this.killed[e.enemyId!] = (this.killed[e.enemyId!] ?? 0) + 1;
        steps.push({ t: 'sfx', id: 'enemyDie' }, { t: 'die', dst: e.id });
      }
    }
    for (const p of this.party) {
      if (p.hp <= 0 && !p.statuses.some((s) => (s.type as string) === '__ko')) {
        p.statuses = [{ type: '__ko' as any, turns: 999, amount: 0 }];
        steps.push({ t: 'die', dst: p.id });
      } else if (p.hp > 0) {
        p.statuses = p.statuses.filter((s) => (s.type as string) !== '__ko');
      }
    }
    if (steps.length) await this.io.play(steps);
    // mirror decoys vanish together with the knight
    if (this.enemies.find((x) => x.enemyId === 'castle_knight')?.hp === 0) for (const d of this.enemies) if (d.enemyId === 'mirror_decoy') d.hp = 0;
    this.enemies = this.enemies.filter((e) => e.hp > 0 || !(e.traits as string[]).includes('__dead') || true);
    if (this.alive('enemy').length === 0 || this.alive('party').length === 0) this.ended = true;
  }

  /** Final battle phase 3: every partner joins and the team finisher unlocks. */
  private async finalBarrier(boss: Fighter, steps: FxStep[]): Promise<void> {
    this.barrier = true;
    this.teamUnlocked = true;
    steps.push({ t: 'fx', name: 'barrier', at: boss.id });
    if (G.mode === 'single') {
      const present = new Set(this.party.map((p) => p.charId));
      const reinforcements = (G.state.partners.unlocked as CharId[]).filter((c) => !present.has(c));
      const roomFor = Math.max(0, 4 - this.party.length);
      for (const c of reinforcements.slice(0, roomFor)) {
        const m = G.partnerMember(c);
        const f = fighterFromMember(m);
        f.hp = f.maxHP;
        this.party.push(f);
        steps.push({ t: 'spawn', fighter: f });
      }
      const joined = reinforcements.slice(0, roomFor);
      const cheering = reinforcements.slice(roomFor);
      if (joined.length) steps.push({ t: 'text', text: `「我們也來了！」${joined.map((c) => CHARACTERS[c].name).join('、')} 加入戰鬥！`, ms: 1600 });
      if (cheering.length) steps.push({ t: 'text', text: `${cheering.map((c) => CHARACTERS[c].name).join('、')} 在旁邊用力加油！`, ms: 1400 });
    }
    steps.push({ t: 'text', text: '星之心碎片發出光芒……解鎖了合體技「星之心合奏」！', ms: 1800 });
    for (const p of this.party) {
      p.hp = Math.max(p.hp, Math.ceil(p.maxHP / 2));
      p.sp = p.maxSP;
    }
    steps.push({ t: 'text', text: '全員 HP 與技能點數回復了！', ms: 900 });
    void badgeBonus;
  }
}
