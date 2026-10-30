/** Small MS Paint item icons (48x48) — used by the DOM UI (data URLs) and Phaser (textures). */
import { hashString } from '../core/util';
import type { IconSpec } from '../data/types';
import { Doodle, type Pt } from './paint';

const cache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

function starPts(cx: number, cy: number, r1: number, r2: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function drawIcon(spec: IconSpec, key: string): HTMLCanvasElement {
  const ck = key + spec.shape + spec.color;
  const hit = cache.get(ck);
  if (hit) return hit;
  const d = new Doodle(48, 48, hashString(ck));
  const c = spec.color, a = spec.accent ?? '#ffffff';
  const W = 2;
  switch (spec.shape) {
    case 'heart': d.shape([[24, 40], [8, 22], [10, 12], [18, 10], [24, 17], [30, 10], [38, 12], [40, 22]], c, W); break;
    case 'star': d.shape(starPts(24, 25, 18, 8), c, W); break;
    case 'shard': d.shape([[24, 4], [36, 20], [28, 44], [14, 34], [12, 16]], c, W); d.line([[20, 12], [18, 26]], 2, a); break;
    case 'bottle': d.shape([[19, 6], [29, 6], [29, 14], [36, 22], [35, 42], [13, 42], [12, 22], [19, 14]], c, W); d.blob(24, 30, 6, 5, a, 1); break;
    case 'candy': d.shape([[8, 16], [14, 24], [8, 32]], a, W); d.shape([[40, 16], [34, 24], [40, 32]], a, W); d.blob(24, 24, 11, 10, c, W); break;
    case 'mushroom': d.blob(24, 34, 7, 9, '#ffffc0', W); d.blob(24, 20, 17, 11, c, W); d.dot(18, 18, 3, a); d.dot(29, 15, 3, a); break;
    case 'leaf': d.shape([[8, 40], [14, 16], [38, 8], [34, 30]], c, W); d.line([[10, 38], [32, 14]], 2); break;
    case 'gem': d.shape([[14, 12], [34, 12], [42, 22], [24, 42], [6, 22]], c, W); d.line([[10, 22], [38, 22]], 1); break;
    case 'badge': d.blob(24, 24, 17, 17, c, W); d.shape(starPts(24, 24, 10, 4), a === '#ffffff' && c === '#ffffff' ? '#ff80c0' : a, 1); d.line([[16, 40], [14, 46]], 3, '#ff0000'); d.line([[32, 40], [34, 46]], 3, '#0000ff'); break;
    case 'key': d.blob(15, 16, 9, 9, c, W); d.line([[22, 22], [40, 40]], 4, c); d.line([[34, 34], [38, 30]], 3, c); d.line([[38, 38], [42, 34]], 3, c); break;
    case 'scroll': d.shape([[10, 10], [38, 8], [38, 40], [10, 42]], c, W); for (let i = 0; i < 4; i++) d.line([[15, 16 + i * 6], [33, 15 + i * 6]], 1, a); break;
    case 'book': d.shape([[8, 10], [40, 8], [40, 40], [8, 42]], c, W); d.line([[24, 9], [24, 41]], 2); break;
    case 'sticker': d.shape([[8, 8], [40, 6], [42, 40], [10, 42]], '#ffffff', W); d.blob(24, 24, 11, 11, c, 2); d.dot(20, 22, 2); d.dot(28, 21, 2); d.line([[19, 28], [24, 31], [30, 27]], 2); break;
    case 'bomb': d.blob(22, 28, 15, 14, c, W); d.line([[30, 16], [36, 8]], 3, '#804000'); d.shape(starPts(38, 7, 6, 3), a, 1); break;
    case 'cake': d.shape([[8, 22], [40, 20], [40, 40], [8, 40]], c, W); d.line([[8, 28], [40, 27]], 3, '#ffffff'); d.blob(24, 15, 5, 5, a, W); break;
    case 'cookie': d.blob(24, 24, 17, 16, c, W); d.dot(18, 20, 2.5, a); d.dot(29, 26, 2.5, a); d.dot(21, 31, 2, a); break;
    case 'apple': d.blob(24, 27, 15, 14, c, W); d.line([[24, 13], [26, 6]], 3, '#804000'); d.shape([[26, 9], [36, 6], [32, 13]], '#00a000', 1); break;
    case 'feather': d.shape([[10, 42], [30, 6], [38, 14], [16, 40]], c, W); d.line([[10, 42], [34, 10]], 1); break;
    case 'gear': {
      const pts: Pt[] = [];
      for (let i = 0; i < 16; i++) { const ang = (i / 16) * Math.PI * 2; const r = i % 2 ? 13 : 18; pts.push([24 + Math.cos(ang) * r, 24 + Math.sin(ang) * r]); }
      d.shape(pts, c, W);
      d.blob(24, 24, 5, 5, a, W);
      break;
    }
    case 'shell': d.shape([[8, 36], [24, 8], [40, 36]], c, W); for (let i = 0; i < 3; i++) d.line([[24, 10], [14 + i * 10, 36]], 1); break;
    case 'ring': d.line(d.wobbleEllipse(24, 24, 15, 15, 0.08), 5, c, { closed: true }); d.dot(24, 10, 4, a); break;
  }
  const out = d.finish(2);
  cache.set(ck, out);
  return out;
}

export function iconURL(spec: IconSpec, key: string): string {
  const k = key + spec.shape + spec.color;
  let u = urlCache.get(k);
  if (!u) {
    u = drawIcon(spec, key).toDataURL();
    urlCache.set(k, u);
  }
  return u;
}
