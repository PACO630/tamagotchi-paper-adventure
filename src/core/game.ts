import type Phaser from 'phaser';
import { CHARACTERS, statsAt, skillsAt } from '../data/characters';
import { QUESTS } from '../data/quests';
import type { CharId, Stats } from '../data/types';
import type { RosterEntry } from '../net/protocol';
import { applyAction, cond, deriveQuestCompletions, type GameAction } from '../systems/actions';
import { effectiveStats, gainExp } from '../systems/progression';
import type { SaveData } from '../systems/saveSchema';
import { saves } from '../systems/saveManager';
import { bus } from './events';

export interface PartyMember {
  key: string;
  charId: CharId;
  name: string;
  level: number;
  stats: Stats;
  hp: number;
  sp: number;
  skills: string[];
  badges: string[];
  controller: string; // 'local' or a roster key
}

export interface NetBridge {
  isHost: boolean;
  localKey: string;
  roster: RosterEntry[];
  requestAction(a: GameAction): void;
  broadcastAction(a: GameAction): void;
}

/** Global game runtime: the active state, mode and authoritative dispatch. */
class GameCore {
  mode: 'none' | 'single' | 'multi' = 'none';
  /** Shared world state. Single player: the save itself. Multiplayer: the host-owned session state. */
  state!: SaveData;
  /** The local player's own save (for EXP/levels). */
  local: SaveData | null = null;
  net: NetBridge | null = null;
  game!: Phaser.Game;
  playing = false;

  get isAuthority(): boolean {
    return this.mode !== 'multi' || !!this.net?.isHost;
  }

  get heroChar(): CharId {
    if (this.mode === 'multi' && this.net) {
      const host = this.net.roster.find((r) => r.isHost);
      return (host?.charId ?? 'mametchi') as CharId;
    }
    return 'mametchi';
  }

  get localChar(): CharId {
    if (this.mode === 'multi' && this.net) {
      return (this.net.roster.find((r) => r.key === this.net!.localKey)?.charId ?? 'mametchi') as CharId;
    }
    return 'mametchi';
  }

  startSingle(save: SaveData): void {
    this.mode = 'single';
    this.state = save;
    this.local = save;
    this.net = null;
    saves.enabled = true;
  }

  startMulti(sessionState: SaveData, local: SaveData | null, net: NetBridge): void {
    this.mode = 'multi';
    this.state = sessionState;
    this.local = local;
    this.net = net;
  }

  stop(): void {
    this.mode = 'none';
    this.net = null;
    this.playing = false;
  }

  cond(c?: string): boolean {
    return cond(this.state, c);
  }

  /** Request a state change. Authority applies + broadcasts; clients forward to the host. */
  dispatch(a: GameAction): void {
    if (this.mode === 'multi' && this.net && !this.net.isHost) {
      this.net.requestAction(a);
      return;
    }
    this.commit(a);
  }

  /** Authority-only: apply, broadcast, and derive follow-up actions (quest completion, rewards). */
  commit(a: GameAction): void {
    this.applyLocal(a);
    if (this.mode === 'multi' && this.net?.isHost) this.net.broadcastAction(a);
    if (a.a === 'questDone') {
      const exp = QUESTS[a.id]?.reward?.exp;
      if (exp) this.commit({ a: 'exp', n: exp });
    }
    for (const d of deriveQuestCompletions(this.state)) this.commit(d);
  }

  /** Apply an action (authority or replicated from host). */
  applyLocal(a: GameAction): void {
    applyAction(this.state, a, { local: this.local, multi: this.mode === 'multi' });
  }

  /** Grants EXP to the local player's save. */
  applyExp(n: number): void {
    if (!this.local) return;
    const bonus = this.local.equipment.badges.includes('b_learn') ? 1.5 : 1;
    const gained = gainExp(this.local, Math.floor(n * bonus));
    if (gained > 0) {
      bus.emit('autosave', 'levelup');
      bus.emit('stats:changed');
    }
  }

  /** Builds the battle/HUD party. */
  buildParty(): PartyMember[] {
    if (this.mode === 'multi' && this.net) {
      return this.net.roster
        .filter((r) => r.charId)
        .sort((a, b) => a.joinOrder - b.joinOrder)
        .map((r) => ({
          key: r.key, charId: r.charId as CharId, name: r.name, level: r.level,
          stats: { ...r.stats }, hp: r.hp, sp: r.sp, skills: r.skills.slice(), badges: r.badges.slice(),
          controller: r.key,
        }))
        .concat(this.followerMember());
    }
    const s = this.state;
    const heroStats = effectiveStats(s.playerStats, s.equipment.badges);
    const party: PartyMember[] = [{
      key: 'hero', charId: 'mametchi', name: CHARACTERS.mametchi.name, level: s.playerLevel,
      stats: heroStats, hp: Math.min(s.playerHP, heroStats.maxHP), sp: Math.min(s.playerSP, heroStats.maxSP),
      skills: s.skills.slice(), badges: s.equipment.badges.slice(), controller: 'local',
    }];
    const p = s.partners.active;
    if (p) party.push(this.partnerMember(p));
    return party;
  }

  /**
   * Multiplayer follower (跟班): an extra partner nobody plays, controlled by the host, so every
   * field ability is always available. Levels with the players (their average level).
   */
  private followerMember(): PartyMember[] {
    const p = this.state.partners.active as CharId | null;
    if (!p || !this.net || this.playerChars().includes(p)) return [];
    const ls = this.net.roster.filter((r) => r.charId).map((r) => r.level);
    const level = Math.max(1, Math.round(ls.reduce((a, b) => a + b, 0) / Math.max(1, ls.length)));
    const st = statsAt(p, level);
    return [{
      key: p, charId: p, name: CHARACTERS[p].name, level, stats: st,
      hp: Math.min(this.state.partners.hp[p] ?? st.maxHP, st.maxHP), sp: Math.min(this.state.partners.sp[p] ?? st.maxSP, st.maxSP),
      skills: skillsAt(p, level), badges: [], controller: this.net.isHost ? 'local' : this.net.roster.find((r) => r.isHost)?.key ?? 'local',
    }];
  }

  partnerMember(p: CharId): PartyMember {
    const s = this.state;
    const st = statsAt(p, s.playerLevel);
    return {
      key: p, charId: p, name: CHARACTERS[p].name, level: s.playerLevel, stats: st,
      hp: Math.min(s.partners.hp[p] ?? st.maxHP, st.maxHP), sp: Math.min(s.partners.sp[p] ?? st.maxSP, st.maxSP),
      skills: skillsAt(p, s.playerLevel), badges: [], controller: 'local',
    };
  }

  /** Multiplayer: characters the players picked (the follower and NPCs never use these). */
  playerChars(): CharId[] {
    if (this.mode !== 'multi' || !this.net) return [];
    return this.net.roster.filter((r) => r.charId).map((r) => r.charId as CharId);
  }

  /** Multiplayer: is this character already in the game as a player or as the follower? */
  charInParty(id: string): boolean {
    if (this.mode !== 'multi') return false;
    return this.playerChars().includes(id as CharId) || this.state?.partners.active === id;
  }

  /** Local player's own party member summary (for HUD in multiplayer). */
  localMemberKey(): string {
    return this.mode === 'multi' && this.net ? this.net.localKey : 'hero';
  }

  /** Text substitutions for story scripts. */
  fmt(text: string): string {
    const hero = CHARACTERS[this.heroChar].name;
    const player = this.local?.playerName ?? this.state?.playerName ?? '';
    return text.replace(/\{hero\}/g, hero).replace(/\{player\}/g, player);
  }
}

export const G = new GameCore();
