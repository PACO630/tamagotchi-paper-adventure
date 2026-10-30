/** Bridge between the world scene and the multiplayer session (no-ops in single player). */
import type { PosUpdate } from '../net/protocol';

export interface RemoteAvatar extends PosUpdate { name: string; charId: string; connected: boolean; recv: number }

export const worldNet = {
  active: false,
  remotes: new Map<string, RemoteAvatar>(),
  sendPos: (_p: PosUpdate): void => {},
  /** client → host: interaction with a world object */
  requestInteract: (_kind: string, _id: string, _extra?: any): void => {},
  /** host → clients: visual effects / chapter flow */
  broadcastField: (_kind: string, _data: any): void => {},
  broadcastDialogue: (_kind: 'line' | 'adv' | 'choice' | 'pick' | 'end' | 'skip', _data?: any): void => {},
};
