/**
 * Multiplayer session over WebRTC DataChannels (PeerJS broker for signaling only).
 * Star topology with a host-authoritative game state:
 *  - host sequences every GameAction and broadcasts it; clients apply in order (gap → snapshot)
 *  - periodic state hashes detect desync → snapshot
 *  - heartbeats detect disconnects; players can rejoin with the same playerId
 *  - if the host drops, the earliest-joined connected player takes over (host migration)
 */
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { MAX_PLAYERS, PEER_PREFIX } from '../core/config';
import { bus } from '../core/events';
import { G, type NetBridge } from '../core/game';
import { hashString, roomCode, uid } from '../core/util';
import { CHARACTERS, skillsAt, statsAt } from '../data/characters';
import { CHAPTERS } from '../data/chapters';
import { ITEMS } from '../data/items';
import type { CharId } from '../data/types';
import { battleNet, clientAnswer, clientBattleEvent } from '../battle/battleRunner';
import { buildLine } from '../systems/story';
import { invCount, type GameAction } from '../systems/actions';
import { effectiveStats } from '../systems/progression';
import { createNewSave, type SaveData } from '../systems/saveSchema';
import { settings } from '../systems/settings';
import { dialogue } from '../ui/dialogueBox';
import { worldNet } from '../world/worldNet';
import { connectTo, Envelopes, friendlyPeerError, openPeer } from './peerLink';
import { PROTOCOL_VERSION, type Envelope, type NetMsg, type PosUpdate, type RosterEntry } from './protocol';

type Status = 'idle' | 'connecting' | 'lobby' | 'game' | 'reconnecting' | 'closed';

const HEARTBEAT_MS = 2000;
const TIMEOUT_MS = 9000;

class Session {
  status: Status = 'idle';
  peer: Peer | null = null;
  isHost = false;
  room = '';
  localKey = '';
  roster: RosterEntry[] = [];
  phase: 'lobby' | 'game' = 'lobby';
  chapter = 1;
  private env = new Envelopes();
  private conns = new Map<string, DataConnection>(); // host: peerId -> conn
  private hostConn: DataConnection | null = null;
  private lastSeen = new Map<string, number>();
  private hbTimer: number | null = null;
  private seq = 0;
  private lastApplied = 0;
  private pending = new Map<number, GameAction>();
  private asks = new Map<string, { resolve: (v: any) => void; key: string; timer: number }>();
  private hostLastSeen = 0;
  private extraRoomPeer: Peer | null = null;
  private migrating = false;

  get bridge(): NetBridge {
    const self = this;
    return {
      get isHost() { return self.isHost; },
      get localKey() { return self.localKey; },
      get roster() { return self.roster; },
      requestAction: (a) => self.sendToHost({ t: 'req', action: a }),
      broadcastAction: (a) => self.broadcastAction(a),
    } as NetBridge;
  }

  me(): RosterEntry | undefined {
    return this.roster.find((r) => r.key === this.localKey);
  }

  /* ======================= setup ======================= */

  private localEntry(): RosterEntry {
    const s = G.local;
    const level = s?.playerLevel ?? 1;
    return {
      key: this.localKey, peerId: this.peer?.id ?? '', name: s?.playerName ?? '玩家', charId: null, level,
      stats: statsAt('mametchi', level), hp: 1, sp: 0, skills: [], badges: s?.equipment.badges.slice() ?? [],
      connected: true, isHost: this.isHost, joinOrder: 0,
    };
  }

  /** Recomputes a roster entry's stats for its chosen character. */
  private applyCharStats(r: RosterEntry, keepVitals = false): void {
    if (!r.charId) return;
    const st = effectiveStats(statsAt(r.charId, r.level), r.badges);
    r.stats = st;
    r.skills = skillsAt(r.charId, r.level);
    if (!keepVitals) { r.hp = st.maxHP; r.sp = st.maxSP; }
    else { r.hp = Math.min(r.hp, st.maxHP); r.sp = Math.min(r.sp, st.maxSP); }
  }

  async createRoom(): Promise<string> {
    this.reset();
    this.status = 'connecting';
    this.isHost = true;
    this.localKey = G.local?.playerId ?? 'host_' + uid(6);
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = roomCode();
      try {
        this.peer = await openPeer(PEER_PREFIX + code);
        this.room = code;
        break;
      } catch (e: any) {
        if (e?.type !== 'unavailable-id') { this.status = 'idle'; throw new Error(friendlyPeerError(e)); }
      }
    }
    if (!this.peer) { this.status = 'idle'; throw new Error('無法建立房間，請再試一次。'); }
    this.wirePeer();
    const me = this.localEntry();
    me.isHost = true;
    me.joinOrder = 0;
    // the host always plays the hero, Mametchi (guests pick the other characters)
    me.charId = 'mametchi';
    this.applyCharStats(me);
    this.roster = [me];
    this.phase = 'lobby';
    this.status = 'lobby';
    this.startHeartbeat();
    this.emitRoster();
    return this.room;
  }

  async joinRoom(code: string): Promise<void> {
    this.reset();
    const room = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(room)) throw new Error('房間代碼是 6 個英文字母或數字。');
    this.status = 'connecting';
    this.isHost = false;
    this.room = room;
    this.localKey = G.local?.playerId ?? 'p_' + uid(8);
    try {
      this.peer = await openPeer(`${PEER_PREFIX}${room}-${uid(5)}`);
      this.wirePeer();
      const conn = await connectTo(this.peer, PEER_PREFIX + room);
      this.attachHostConn(conn);
      await this.awaitWelcome();
      this.status = this.phase === 'game' ? 'game' : 'lobby';
      this.startHeartbeat();
    } catch (e: any) {
      this.leave(true);
      throw new Error(e instanceof Error ? e.message : e?.type === 'timeout' ? '連線逾時，房主可能不在線上或網路受到限制。' : friendlyPeerError(e));
    }
  }

  private awaitWelcome(): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { off1(); off2(); reject(new Error('連線逾時（沒有收到房主回應）。')); }, 10000);
      const off1 = bus.on('net:welcome', () => { clearTimeout(t); off1(); off2(); resolve(); });
      const off2 = bus.on('net:rejected', (reason: string) => { clearTimeout(t); off1(); off2(); reject(new Error(reason)); });
      this.sendHello();
    });
  }

  private sendHello(): void {
    const s = G.local;
    const level = s?.playerLevel ?? 1;
    this.sendToHost({
      t: 'hello', v: PROTOCOL_VERSION, key: this.localKey, name: s?.playerName ?? '玩家', level,
      stats: statsAt('mametchi', level), hp: 0, sp: 0, skills: [], badges: s?.equipment.badges.slice() ?? [],
    });
  }

  private wirePeer(): void {
    const peer = this.peer!;
    peer.on('connection', (conn) => this.onIncoming(conn));
    peer.on('disconnected', () => { if (this.status !== 'closed') try { peer.reconnect(); } catch { /* ignore */ } });
    peer.on('error', (e: any) => {
      if (e?.type === 'peer-unavailable') return; // handled by connect attempts
      console.warn('peer error', e);
      bus.emit('net:status', friendlyPeerError(e));
    });
  }

  /* ======================= connections ======================= */

  private onIncoming(conn: DataConnection): void {
    if (!this.isHost) { conn.close(); return; }
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      this.lastSeen.set(conn.peer, Date.now());
    });
    conn.on('data', (d) => this.onData(d as Envelope, conn));
    conn.on('close', () => this.onPeerGone(conn.peer));
    conn.on('error', () => this.onPeerGone(conn.peer));
  }

  private attachHostConn(conn: DataConnection): void {
    this.hostConn = conn;
    this.hostLastSeen = Date.now();
    conn.on('data', (d) => this.onData(d as Envelope, conn));
    conn.on('close', () => { if (this.hostConn === conn) this.onHostLost(); });
    conn.on('error', () => { if (this.hostConn === conn) this.onHostLost(); });
  }

  private send(conn: DataConnection | null | undefined, m: NetMsg): void {
    if (!conn || !conn.open) return;
    try { conn.send(this.env.wrap(m)); } catch (e) { console.warn('send failed', e); }
  }

  sendToHost(m: NetMsg): void {
    if (this.isHost) { this.handle({ ...(m as any), from: 'local' } as Envelope, null); return; }
    this.send(this.hostConn, m);
  }

  private broadcast(m: NetMsg, except?: string): void {
    if (!this.isHost) return;
    const e = this.env.wrap(m);
    for (const [pid, c] of this.conns) if (pid !== except && c.open) { try { c.send(e); } catch { /* ignore */ } }
  }

  private connOf(key: string): DataConnection | undefined {
    const r = this.roster.find((x) => x.key === key);
    return r ? this.conns.get(r.peerId) : undefined;
  }

  private onData(e: Envelope, conn: DataConnection): void {
    if (!this.env.accept(e)) return; // duplicate packet
    if (this.isHost) this.lastSeen.set(conn.peer, Date.now());
    else this.hostLastSeen = Date.now();
    this.handle(e, conn);
  }

  /* ======================= message handling ======================= */

  private handle(m: Envelope, conn: DataConnection | null): void {
    switch (m.t) {
      // ---------- host side ----------
      case 'hello': {
        if (!this.isHost || !conn) return;
        if (m.v !== PROTOCOL_VERSION) { this.send(conn, { t: 'reject', reason: '遊戲版本不同，請兩邊都重新整理網頁。' }); return; }
        let r = this.roster.find((x) => x.key === m.key);
        if (!r) {
          if (this.phase === 'game') { this.send(conn, { t: 'reject', reason: '遊戲已經開始了，無法加入新的玩家。' }); return; }
          if (this.roster.length >= MAX_PLAYERS) { this.send(conn, { t: 'reject', reason: `房間已滿（最多 ${MAX_PLAYERS} 人）。` }); return; }
          r = { key: m.key, peerId: conn.peer, name: String(m.name).slice(0, 12), charId: null, level: Math.max(1, Math.min(30, m.level | 0)), stats: m.stats, hp: 1, sp: 0, skills: [], badges: (m.badges ?? []).filter((b: string) => ITEMS[b]?.kind === 'badge').slice(0, 3), connected: true, isHost: false, joinOrder: Math.max(...this.roster.map((x) => x.joinOrder)) + 1 };
          this.roster.push(r);
        } else {
          // rejoin: same playerId, new connection
          const old = this.conns.get(r.peerId);
          if (old && old !== conn) { this.conns.delete(r.peerId); try { old.close(); } catch { /* ignore */ } }
          r.peerId = conn.peer;
          r.connected = true;
          bus.emit('toast', `${r.name} 重新連線了！`, 'good');
        }
        this.send(conn, { t: 'welcome', roster: this.roster, phase: this.phase, hostKey: this.localKey, room: this.room, chapter: this.chapter });
        if (this.phase === 'game') this.send(conn, { t: 'start', chapter: this.chapter, seq: this.seq, state: G.state });
        this.emitRoster();
        break;
      }
      case 'pick': {
        if (!this.isHost) return;
        const r = this.rosterByPeer(conn) ?? (m.from === 'local' ? this.me() : undefined);
        if (!r || this.phase !== 'lobby') return;
        if (m.charId && this.roster.some((x) => x.charId === m.charId && x.key !== r.key)) { this.emitRoster(); return; }
        // the host stays Mametchi; nobody else can take him
        if (r.isHost ? m.charId !== 'mametchi' : m.charId === 'mametchi') { this.emitRoster(); return; }
        if (m.charId && !CHARACTERS[m.charId]) return;
        r.charId = m.charId;
        this.applyCharStats(r);
        this.emitRoster();
        break;
      }
      case 'leave': {
        if (!this.isHost) return;
        const r = this.rosterByPeer(conn);
        if (!r) return;
        if (this.phase === 'lobby') this.roster = this.roster.filter((x) => x !== r);
        else r.connected = false;
        if (conn) { this.conns.delete(conn.peer); try { conn.close(); } catch { /* ignore */ } }
        bus.emit('toast', `${r.name} 離開了房間。`, 'warn');
        this.emitRoster();
        break;
      }
      case 'ping': this.send(conn, { t: 'pong', ts: m.ts }); break;
      case 'pong': break;
      case 'pos': {
        const p = m.p as PosUpdate;
        if (this.isHost) {
          const r = this.rosterByPeer(conn);
          if (!r) return;
          p.key = r.key;
          this.updateRemote(p);
          this.broadcast({ t: 'pos', p }, conn?.peer);
        } else this.updateRemote(p);
        break;
      }
      case 'req': {
        if (!this.isHost) return;
        // clients may only request harmless actions directly; everything else goes through interactions
        if (m.action?.a === 'equip') G.commit(m.action);
        break;
      }
      case 'needSnap': if (this.isHost) this.send(conn, { t: 'snap', seq: this.seq, state: G.state }); break;
      case 'stats': {
        if (!this.isHost) return;
        const r = this.rosterByPeer(conn) ?? this.roster.find((x) => x.key === m.key);
        if (!r) return;
        r.level = Math.max(1, Math.min(30, m.level | 0));
        r.badges = (m.badges ?? []).filter((b: string) => ITEMS[b]?.kind === 'badge').slice(0, 3);
        this.applyCharStats(r, true);
        this.emitRoster();
        break;
      }
      case 'field': {
        if (this.isHost) this.hostField(m.kind, m.data, conn);
        else this.clientField(m.kind, m.data);
        break;
      }
      case 'bans': {
        const a = this.asks.get(m.token);
        if (a) { clearTimeout(a.timer); this.asks.delete(m.token); a.resolve(m.result); }
        break;
      }
      // ---------- client side ----------
      case 'welcome':
        this.roster = m.roster;
        this.phase = m.phase;
        this.chapter = m.chapter;
        bus.emit('net:welcome');
        this.emitRoster(false);
        break;
      case 'reject':
        bus.emit('net:rejected', m.reason);
        break;
      case 'roster':
        this.roster = m.roster;
        this.phase = m.phase;
        this.chapter = m.chapter;
        this.emitRoster(false);
        break;
      case 'chapter': this.chapter = m.chapter; bus.emit('net:roster'); break;
      case 'dissolve':
        bus.emit('toast', '房主解散了房間。', 'warn');
        this.leave(true);
        bus.emit('net:dissolved');
        break;
      case 'start':
        this.seq = this.lastApplied = m.seq;
        this.pending.clear();
        this.phase = 'game';
        this.status = 'game';
        this.chapter = m.chapter;
        bus.emit('net:start', m.state);
        break;
      case 'act': this.onAct(m.seq, m.action); break;
      case 'snap': this.applySnapshot(m.seq, m.state); break;
      case 'hash':
        if (m.seq === this.lastApplied && m.h !== stateHash(G.state)) {
          console.warn('state desync detected, requesting snapshot');
          this.sendToHost({ t: 'needSnap', have: this.lastApplied });
        }
        break;
      case 'dlg': this.clientDialogue(m.kind, m.data); break;
      case 'bev': clientBattleEvent(m.ev); break;
      case 'bask':
        void clientAnswer(m.kind as any, m.data).then((result) => this.sendToHost({ t: 'bans', token: m.token, result }));
        break;
      case 'newHost': this.followNewHost(m.hostKey, m.peerId); break;
    }
  }

  private rosterByPeer(conn: DataConnection | null): RosterEntry | undefined {
    if (!conn) return this.me();
    return this.roster.find((x) => x.peerId === conn.peer);
  }

  private emitRoster(broadcast = true): void {
    if (this.isHost && broadcast) this.broadcast({ t: 'roster', roster: this.roster, phase: this.phase, hostKey: this.localKey, chapter: this.chapter });
    for (const r of this.roster) {
      const rp = worldNet.remotes.get(r.key);
      if (rp) { rp.connected = r.connected; rp.name = r.name; rp.charId = r.charId ?? 'mametchi'; }
    }
    bus.emit('net:roster', this.roster);
  }

  /* ======================= lobby actions ======================= */

  pickChar(c: CharId | null): void {
    if (this.isHost) this.handle({ t: 'pick', charId: c, mid: '', from: 'local' } as Envelope, null);
    else this.sendToHost({ t: 'pick', charId: c });
  }

  setChapter(n: number): void {
    if (!this.isHost) return;
    this.chapter = n;
    this.broadcast({ t: 'chapter', chapter: n });
    bus.emit('net:roster');
  }

  canStart(): string | null {
    const active = this.roster.filter((r) => r.connected);
    if (active.length < 2) return '至少需要 2 位玩家才能開始（最多 4 人）。';
    if (active.some((r) => !r.charId)) return '還有玩家沒有選擇角色。';
    return null;
  }

  /** Host: create the shared session state and start the game for everyone. */
  startGame(): void {
    if (!this.isHost) return;
    const err = this.canStart();
    if (err) throw new Error(err);
    this.roster = this.roster.filter((r) => r.connected);
    const state = createNewSave(0 as any, this.localKey, G.local?.playerName ?? '房主', settings.current);
    state.slot = 1;
    state.currentChapter = this.chapter;
    state.currentMap = `ch${this.chapter}`;
    state.unlockedAreas = CHAPTERS.slice(0, this.chapter).map((c) => c.id);
    state.inventory = [{ id: 'apple', qty: 4 }, { id: 'onigiri', qty: 2 }, { id: 'juice', qty: 2 }, { id: 'star_sensor', qty: 1 }];
    for (let i = 1; i < this.chapter; i++) {
      state.inventory.push({ id: `shard${i}`, qty: 1 });
      state.storyFlags[`clear:ch${i}`] = true;
    }
    state.coins = 30 * this.chapter;
    // the follower (跟班) works like single player: partners who joined in earlier chapters are
    // already along; later ones join through the story. Players' own characters never follow.
    const taken = new Set(this.roster.map((r) => r.charId));
    const joined = CHAPTERS.slice(0, this.chapter - 1).map((c) => c.partner).filter((p): p is CharId => !!p);
    for (const p of joined) state.storyFlags[`joined:${p}`] = true;
    state.partners.unlocked = joined.filter((p) => p !== 'mametchi');
    state.partners.active = [...state.partners.unlocked].reverse().find((p) => !taken.has(p)) ?? null;
    for (const r of this.roster) this.applyCharStats(r);
    this.phase = 'game';
    this.status = 'game';
    this.seq = 0;
    this.broadcast({ t: 'start', chapter: this.chapter, seq: 0, state });
    this.emitRoster();
    bus.emit('net:start', state);
  }

  dissolve(): void {
    if (this.isHost) this.broadcast({ t: 'dissolve' });
    setTimeout(() => this.leave(true), 150);
  }

  leave(silent = false): void {
    if (!this.isHost && this.hostConn?.open && !silent) this.send(this.hostConn, { t: 'leave' });
    if (this.isHost && !silent && this.phase === 'lobby') this.broadcast({ t: 'dissolve' });
    setTimeout(() => this.reset(), silent ? 0 : 120);
  }

  private reset(): void {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = null;
    for (const c of this.conns.values()) { try { c.close(); } catch { /* ignore */ } }
    this.conns.clear();
    try { this.hostConn?.close(); } catch { /* ignore */ }
    this.hostConn = null;
    try { this.peer?.destroy(); } catch { /* ignore */ }
    try { this.extraRoomPeer?.destroy(); } catch { /* ignore */ }
    this.extraRoomPeer = null;
    this.peer = null;
    this.roster = [];
    this.status = 'idle';
    this.phase = 'lobby';
    this.isHost = false;
    this.pending.clear();
    for (const a of this.asks.values()) { clearTimeout(a.timer); a.resolve(null); }
    this.asks.clear();
    this.migrating = false;
    worldNet.active = false;
    worldNet.remotes.clear();
  }

  /* ======================= replication ======================= */

  private broadcastAction(a: GameAction): void {
    this.seq++;
    this.lastApplied = this.seq;
    this.broadcast({ t: 'act', seq: this.seq, action: a });
    if (this.seq % 8 === 0) this.broadcast({ t: 'hash', seq: this.seq, h: stateHash(G.state) });
  }

  private onAct(seq: number, a: GameAction): void {
    if (seq <= this.lastApplied) return; // duplicate / old
    this.pending.set(seq, a);
    while (this.pending.has(this.lastApplied + 1)) {
      const next = this.pending.get(this.lastApplied + 1)!;
      this.pending.delete(this.lastApplied + 1);
      this.lastApplied++;
      G.applyLocal(next);
    }
    if (this.pending.size > 0) this.sendToHost({ t: 'needSnap', have: this.lastApplied });
  }

  private applySnapshot(seq: number, state: SaveData): void {
    if (!G.state) return;
    Object.assign(G.state, state);
    this.lastApplied = seq;
    for (const k of [...this.pending.keys()]) if (k <= seq) this.pending.delete(k);
    bus.emit('state:changed', { a: 'snapshot' });
    bus.emit('hud:dirty');
  }

  /* ======================= world sync ======================= */

  sendPos(p: PosUpdate): void {
    if (this.isHost) {
      p.key = this.localKey;
      this.broadcast({ t: 'pos', p });
    } else this.send(this.hostConn, { t: 'pos', p });
  }

  private updateRemote(p: PosUpdate): void {
    if (p.key === this.localKey) return;
    const r = this.roster.find((x) => x.key === p.key);
    worldNet.remotes.set(p.key, { ...p, name: r?.name ?? '?', charId: r?.charId ?? 'mametchi', connected: r?.connected ?? true, recv: Date.now() });
  }

  private hostField(kind: string, data: any, conn: DataConnection | null): void {
    const r = this.rosterByPeer(conn);
    if (!r) return;
    const world = G.game.scene.getScene('World') as any;
    if (kind === 'interact' && world?.interact) {
      void world.interact(data.kind, data.id, r.key, data.extra);
    } else if (kind === 'useItem') {
      const it = ITEMS[data.item];
      if (!it?.fieldUse || invCount(G.state, data.item) <= 0) return;
      const targets = it.target === 'allAllies' ? this.roster : this.roster.filter((x) => x.key === (data.target || r.key));
      for (const t of targets) { t.hp = Math.min(t.stats.maxHP, t.hp + (it.hp ?? 0)); t.sp = Math.min(t.stats.maxSP, t.sp + (it.sp ?? 0)); }
      G.commit({ a: 'take', item: data.item, qty: 1 });
      this.emitRoster();
    }
  }

  private clientField(kind: string, data: any): void {
    const world = G.game.scene.getScene('World') as any;
    world?.applyRemoteFx?.(kind, data);
  }

  requestInteract(kind: string, id: string, extra?: any): void {
    this.sendToHost({ t: 'field', kind: 'interact', data: { kind, id, extra } });
  }

  useItem(item: string, target: string): void {
    if (this.isHost) this.hostField('useItem', { item, target }, null);
    else this.sendToHost({ t: 'field', kind: 'useItem', data: { item, target } });
  }

  broadcastField(kind: string, data: any): void {
    this.broadcast({ t: 'field', kind, data });
  }

  broadcastDialogue(kind: 'line' | 'adv' | 'choice' | 'pick' | 'end' | 'skip', data?: any): void {
    this.broadcast({ t: 'dlg', kind, data });
  }

  private clientDialogue(kind: string, data: any): void {
    const world = G.game.scene.getScene('World') as any;
    dialogue.canAdvance = false;
    switch (kind) {
      case 'line': void dialogue.say(buildLine(data.who, data.text, data.face, world?.chapter ?? null)); break;
      case 'adv': dialogue.externalAdvance(); break;
      case 'choice': void dialogue.choose(data.prompt, data.options, false); break;
      case 'pick': dialogue.externalChoice?.(data.idx); break;
      case 'skip': dialogue.externalSkip(); break;
      case 'end': dialogue.hide(); dialogue.canAdvance = true; break;
    }
  }

  /* ======================= battle bridge ======================= */

  private installBattleNet(): void {
    battleNet.broadcast = (ev) => this.broadcast({ t: 'bev', ev });
    battleNet.ask = (key, kind, data) => new Promise((resolve) => {
      const r = this.roster.find((x) => x.key === key);
      const conn = this.connOf(key);
      if (!r || !r.connected || !conn) { resolve(null); return; }
      const token = uid(10);
      const timer = window.setTimeout(() => { this.asks.delete(token); resolve(null); }, kind === 'menu' ? 60000 : 15000);
      this.asks.set(token, { resolve, key, timer });
      this.send(conn, { t: 'bask', token, kind, data });
    });
  }

  /** Called when entering the game: hook world + battle bridges. */
  attachGame(): void {
    worldNet.active = true;
    worldNet.sendPos = (p) => this.sendPos(p);
    worldNet.requestInteract = (k, id, extra) => this.requestInteract(k, id, extra);
    worldNet.broadcastField = (k, d) => this.broadcastField(k, d);
    worldNet.broadcastDialogue = (k, d) => this.broadcastDialogue(k, d);
    this.installBattleNet();
  }

  /** Local level/badges changed → tell the host. */
  pushLocalStats(): void {
    const s = G.local;
    if (!s) return;
    const r = this.me();
    const msg: NetMsg = { t: 'stats', key: this.localKey, level: s.playerLevel, stats: s.playerStats, hp: 0, sp: 0, skills: [], badges: s.equipment.badges.slice() };
    if (this.isHost && r) { r.level = s.playerLevel; r.badges = s.equipment.badges.slice(); this.applyCharStats(r, true); this.emitRoster(); }
    else this.sendToHost(msg);
  }

  /* ======================= heartbeat / failure handling ======================= */

  private startHeartbeat(): void {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = window.setInterval(() => {
      const now = Date.now();
      if (this.isHost) {
        this.broadcast({ t: 'ping', ts: now });
        let changed = false;
        for (const r of this.roster) {
          if (r.key === this.localKey) continue;
          const seen = this.lastSeen.get(r.peerId) ?? 0;
          const alive = now - seen < TIMEOUT_MS && !!this.conns.get(r.peerId)?.open;
          if (r.connected !== alive) {
            r.connected = alive;
            changed = true;
            bus.emit('toast', alive ? `${r.name} 已連線` : `${r.name} 斷線了…`, alive ? 'good' : 'warn');
            if (!alive) for (const [tok, a] of this.asks) if (a.key === r.key) { clearTimeout(a.timer); this.asks.delete(tok); a.resolve(null); }
          }
        }
        if (changed) this.emitRoster();
      } else {
        this.send(this.hostConn, { t: 'ping', ts: now });
        if (this.status !== 'reconnecting' && now - this.hostLastSeen > TIMEOUT_MS) this.onHostLost();
      }
    }, HEARTBEAT_MS);
  }

  private onPeerGone(peerId: string): void {
    this.conns.delete(peerId);
    const r = this.roster.find((x) => x.peerId === peerId);
    if (r && r.connected) {
      r.connected = false;
      bus.emit('toast', `${r.name} 斷線了…`, 'warn');
      for (const [tok, a] of this.asks) if (a.key === r.key) { clearTimeout(a.timer); this.asks.delete(tok); a.resolve(null); }
      if (this.phase === 'lobby') this.roster = this.roster.filter((x) => x !== r);
      this.emitRoster();
    }
  }

  /** Host vanished: the earliest-joined connected player becomes host. */
  private onHostLost(): void {
    if (this.migrating || this.isHost || this.status === 'closed' || this.status === 'idle') return;
    if (this.phase === 'lobby') {
      bus.emit('toast', '和房主的連線中斷了。', 'warn');
      this.leave(true);
      bus.emit('net:dissolved');
      return;
    }
    this.migrating = true;
    this.status = 'reconnecting';
    bus.emit('net:status', '房主斷線了，正在交接房主權限…');
    const oldHost = this.roster.find((r) => r.isHost);
    if (oldHost) { oldHost.connected = false; oldHost.isHost = false; }
    const successor = this.roster.filter((r) => r.connected && r !== oldHost).sort((a, b) => a.joinOrder - b.joinOrder)[0];
    dialogue.hide();
    if (!successor) return;
    if (successor.key === this.localKey) void this.becomeHost();
    else setTimeout(() => this.followNewHost(successor.key, successor.peerId), 1500);
  }

  private async becomeHost(): Promise<void> {
    this.isHost = true;
    this.hostConn = null;
    for (const r of this.roster) r.isHost = r.key === this.localKey;
    this.seq = this.lastApplied;
    this.installBattleNet();
    this.migrating = false;
    this.status = 'game';
    bus.emit('toast', '你成為了新的房主！', 'good');
    bus.emit('net:becameHost');
    this.emitRoster();
    // best effort: also listen on the room code so new connections using the code find us
    setTimeout(async () => {
      try {
        this.extraRoomPeer = await openPeer(PEER_PREFIX + this.room, 8000);
        this.extraRoomPeer.on('connection', (c) => this.onIncoming(c));
      } catch { /* the broker may still hold the old id */ }
    }, 4000);
  }

  private async followNewHost(hostKey: string, peerId: string): Promise<void> {
    if (!this.peer) return;
    for (let i = 0; i < 5; i++) {
      try {
        const conn = await connectTo(this.peer, peerId, 8000);
        this.attachHostConn(conn);
        this.sendHello();
        for (const r of this.roster) r.isHost = r.key === hostKey;
        this.migrating = false;
        this.status = 'game';
        bus.emit('toast', '已連線到新的房主。', 'good');
        this.emitRoster(false);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.migrating = false;
    bus.emit('toast', '無法重新連線，返回主選單。', 'warn');
    this.leave(true);
    bus.emit('net:dissolved');
  }

  /** Manual rejoin for a client that lost connection (same room code + playerId). */
  async rejoin(): Promise<void> {
    if (!this.room) throw new Error('沒有房間可以重新加入。');
    await this.joinRoom(this.room);
  }
}

/** Compact hash of the parts of the state that matter for sync checks. */
export function stateHash(s: SaveData): string {
  const flags = Object.keys(s.storyFlags).sort().map((k) => `${k}=${s.storyFlags[k]}`).join('|');
  const inv = s.inventory.map((e) => `${e.id}:${e.qty}`).join(',');
  return hashString(`${flags}#${inv}#${s.activeQuests.map((q) => q.id).join(',')}#${s.completedQuests.join(',')}#${s.coins}#${s.currentChapter}`).toString(36);
}

export const session = new Session();
