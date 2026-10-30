/** PeerJS wrapper: peer lifecycle, ICE config, envelopes with de-duplication. */
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { uid } from '../core/util';
import { settings } from '../systems/settings';
import type { Envelope, NetMsg } from './protocol';

export function iceServers(): RTCIceServer[] {
  const s = settings.current;
  const list: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];
  if (s.useTurn) {
    // Public relay (best effort) used only when direct P2P fails.
    list.push({ urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' });
  }
  if (s.turnUrl) list.push({ urls: s.turnUrl, username: s.turnUser || undefined, credential: s.turnPass || undefined });
  return list;
}

export function peerOptions(): PeerOptions {
  return { debug: 1, config: { iceServers: iceServers() } };
}

export function friendlyPeerError(err: any): string {
  switch (err?.type) {
    case 'peer-unavailable': return '找不到這個房間，請確認房間代碼是否正確，或房主是否還在線上。';
    case 'unavailable-id': return '房間代碼已被使用。';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return '無法連線到配對伺服器，請檢查網路後再試一次。';
    case 'browser-incompatible': return '這個瀏覽器不支援 WebRTC 連線。';
    case 'webrtc': return 'WebRTC 連線失敗（可能是網路防火牆阻擋），可以在設定中開啟 TURN 中繼。';
    default: return `連線發生錯誤：${err?.type ?? err?.message ?? '未知錯誤'}`;
  }
}

/** Creates a Peer with the given id and resolves once registered with the broker. */
export function openPeer(id: string, timeoutMs = 12000): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(id, peerOptions());
    const timer = setTimeout(() => { peer.destroy(); reject({ type: 'network' }); }, timeoutMs);
    peer.once('open', () => { clearTimeout(timer); resolve(peer); });
    peer.once('error', (e) => { clearTimeout(timer); peer.destroy(); reject(e); });
  });
}

export function connectTo(peer: Peer, id: string, timeoutMs = 12000): Promise<DataConnection> {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(id, { reliable: true, serialization: 'json' });
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; conn.close(); reject({ type: 'timeout', message: '連線逾時' }); } }, timeoutMs);
    const onErr = (e: any) => { if (!done) { done = true; clearTimeout(timer); reject(e); } };
    conn.once('open', () => { if (!done) { done = true; clearTimeout(timer); resolve(conn); } });
    conn.once('error', onErr);
    peer.once('error', onErr);
  });
}

/** Message envelopes + duplicate filtering. */
export class Envelopes {
  private counter = 0;
  private seen = new Set<string>();
  private order: string[] = [];
  readonly self = uid(6);

  wrap(m: NetMsg): Envelope {
    return { ...m, mid: `${this.self}:${++this.counter}`, from: this.self } as Envelope;
  }

  /** Returns false when this envelope was already processed. */
  accept(e: Envelope): boolean {
    if (!e || typeof e !== 'object' || typeof (e as any).t !== 'string') return false;
    if (!e.mid) return true;
    if (this.seen.has(e.mid)) return false;
    this.seen.add(e.mid);
    this.order.push(e.mid);
    if (this.order.length > 800) this.seen.delete(this.order.shift()!);
    return true;
  }
}
