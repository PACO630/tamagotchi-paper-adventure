/**
 * UI icon set drawn in the same MS Paint doodle style as the characters (no emoji anywhere).
 * DOM: uiIcon(name) → <img class="ico">.  Phaser: ensureUiIconTexture(scene, name) → texture key.
 */
import type Phaser from 'phaser';
import { hashString } from '../core/util';
import { Doodle, type Pt } from './paint';

export type UiIconName =
  | 'play' | 'plus' | 'person' | 'people' | 'notebook' | 'gear' | 'folder' | 'question' | 'film' | 'coin'
  | 'menu' | 'fullscreen' | 'bag' | 'clipboard' | 'sparkle' | 'scroll' | 'map' | 'friends' | 'floppy' | 'house'
  | 'hammer' | 'shoe' | 'shield' | 'run' | 'star' | 'upload' | 'download' | 'pencil' | 'trash' | 'phone'
  | 'crown' | 'speaker' | 'chat' | 'gamepad' | 'globe' | 'check' | 'back' | 'close' | 'lightning' | 'counter'
  | 'up' | 'down' | 'left' | 'right' | 'more' | 'shard' | 'heart' | 'skull' | 'fire' | 'zzz' | 'spiral'
  | 'chain' | 'atkUp' | 'atkDown' | 'defUp' | 'defDown' | 'regen' | 'diamond' | 'blind' | 'wing' | 'spike'
  | 'boss' | 'note' | 'camera' | 'share' | 'addSquare' | 'dots' | 'rotate';

const S = 48;
const canvasCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

function star(cx: number, cy: number, r1: number, r2: number, n = 5): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function arrow(d: Doodle, dir: 'up' | 'down' | 'left' | 'right', color: string, cx = 24, cy = 24, s = 1) {
  const base: Pt[] = [[0, -16], [14, 0], [6, 0], [6, 16], [-6, 16], [-6, 0], [-14, 0]];
  const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
  const pts = base.map(([x, y]) => [cx + (x * Math.cos(rot) - y * Math.sin(rot)) * s, cy + (x * Math.sin(rot) + y * Math.cos(rot)) * s] as Pt);
  d.shape(pts, color, 2);
}

function sword(d: Doodle) {
  d.shape([[22, 6], [28, 6], [28, 30], [22, 30]], '#c0c0c0', 2);
  d.shape([[14, 30], [36, 30], [36, 35], [14, 35]], '#ffd700', 2);
  d.shape([[22, 35], [28, 35], [28, 44], [22, 44]], '#804000', 2);
}

function shieldShape(d: Doodle, color: string) {
  d.shape([[10, 8], [38, 8], [38, 24], [24, 42], [10, 24]], color, 2);
  d.line([[24, 10], [24, 38]], 2, '#ffffff');
}

const DRAW: Record<UiIconName, (d: Doodle) => void> = {
  play: (d) => d.shape([[14, 8], [40, 24], [14, 40]], '#ffb800', 3),
  plus: (d) => { d.shape([[19, 6], [29, 6], [29, 19], [42, 19], [42, 29], [29, 29], [29, 42], [19, 42], [19, 29], [6, 29], [6, 19], [19, 19]], '#00c060', 2); },
  person: (d) => { d.blob(24, 15, 9, 9, '#ffff80', 2); d.shape([[10, 42], [14, 28], [34, 28], [38, 42]], '#ff8040', 2); },
  people: (d) => { d.blob(16, 16, 7, 7, '#ffff80', 2); d.shape([[4, 40], [7, 28], [25, 28], [28, 40]], '#8080ff', 2); d.blob(33, 18, 7, 7, '#ffc0e0', 2); d.shape([[21, 42], [24, 30], [42, 30], [45, 42]], '#ff8040', 2); },
  notebook: (d) => { d.shape([[10, 6], [38, 6], [38, 42], [10, 42]], '#ffd060', 2); for (let y = 12; y < 40; y += 8) d.dot(10, y, 2); d.line([[16, 16], [32, 16]], 2); d.line([[16, 24], [30, 24]], 2); },
  gear: (d) => { d.shape(star(24, 24, 19, 13, 8), '#c0c0c0', 2); d.blob(24, 24, 6, 6, '#ffffff', 2); },
  folder: (d) => { d.shape([[6, 12], [18, 12], [22, 16], [42, 16], [42, 40], [6, 40]], '#ffc040', 2); d.line([[6, 22], [42, 22]], 2); },
  question: (d) => { d.blob(24, 24, 19, 19, '#80c0ff', 2); d.text('?', 15, 35, 28, '#ffffff'); },
  film: (d) => { d.shape([[6, 18], [42, 18], [42, 42], [6, 42]], '#404040', 2); d.shape([[6, 8], [40, 4], [42, 14], [8, 18]], '#ffffff', 2); d.line([[16, 7], [19, 16]], 2); d.line([[28, 5], [31, 14]], 2); },
  coin: (d) => { d.blob(24, 24, 18, 18, '#ffd700', 3); d.line([[24, 12], [24, 36]], 3, '#c08000'); d.blob(24, 24, 10, 10, null, 2); },
  menu: (d) => { for (const y of [12, 24, 36]) d.line([[9, y], [39, y + 1]], 5); },
  fullscreen: (d) => { d.line([[6, 16], [6, 6], [16, 6]], 4); d.line([[32, 6], [42, 6], [42, 16]], 4); d.line([[6, 32], [6, 42], [16, 42]], 4); d.line([[32, 42], [42, 42], [42, 32]], 4); },
  bag: (d) => { d.line([[16, 16], [18, 6], [30, 6], [32, 16]], 3); d.shape([[8, 16], [40, 16], [42, 42], [6, 42]], '#ff8040', 2); d.shape([[16, 24], [32, 24], [32, 32], [16, 32]], '#ffff80', 2); },
  clipboard: (d) => { d.shape([[9, 8], [39, 8], [39, 44], [9, 44]], '#c08040', 2); d.shape([[13, 13], [35, 13], [35, 40], [13, 40]], '#ffffff', 1); d.shape([[18, 4], [30, 4], [30, 11], [18, 11]], '#c0c0c0', 2); d.line([[17, 22], [31, 22]], 2); d.line([[17, 30], [29, 30]], 2); },
  sparkle: (d) => { d.shape(star(22, 24, 18, 5, 4), '#ffff00', 2); d.shape(star(38, 10, 7, 2, 4), '#ffffff', 1); },
  scroll: (d) => { d.shape([[8, 10], [40, 8], [40, 40], [8, 42]], '#ffffc0', 2); d.blob(8, 10, 4, 4, '#c08040', 2); d.blob(40, 40, 4, 4, '#c08040', 2); d.line([[14, 20], [34, 19]], 2); d.line([[14, 28], [32, 27]], 2); },
  map: (d) => { d.shape([[4, 10], [16, 6], [32, 10], [44, 6], [44, 38], [32, 42], [16, 38], [4, 42]], '#c0ffc0', 2); d.line([[16, 6], [16, 38]], 1); d.line([[32, 10], [32, 42]], 1); d.text('x', 30, 28, 14, '#ff0000'); },
  friends: (d) => { d.shape([[24, 42], [8, 26], [8, 14], [16, 10], [24, 16], [32, 10], [40, 14], [40, 26]], '#ff80c0', 2); d.dot(18, 22, 2); d.dot(30, 22, 2); },
  floppy: (d) => { d.shape([[6, 6], [36, 6], [42, 12], [42, 42], [6, 42]], '#4080ff', 2); d.shape([[14, 6], [32, 6], [32, 18], [14, 18]], '#c0c0c0', 2); d.shape([[12, 26], [36, 26], [36, 42], [12, 42]], '#ffffff', 2); },
  house: (d) => { d.shape([[6, 22], [24, 6], [42, 22]], '#ff4040', 2); d.shape([[10, 22], [38, 22], [38, 42], [10, 42]], '#ffffc0', 2); d.shape([[20, 30], [28, 30], [28, 42], [20, 42]], '#804000', 1); },
  hammer: (d) => { d.line([[14, 40], [30, 20]], 6, '#804000', { broken: 0 }); d.shape([[22, 8], [40, 22], [34, 30], [16, 16]], '#ff8040', 2); },
  shoe: (d) => { d.shape([[8, 14], [20, 14], [22, 26], [40, 30], [42, 40], [6, 40]], '#ff4040', 2); d.line([[6, 36], [42, 36]], 2, '#ffffff'); },
  shield: (d) => shieldShape(d, '#4080ff'),
  run: (d) => { d.blob(30, 12, 6, 6, '#ffff80', 2); d.line([[28, 18], [22, 30], [12, 34]], 3); d.line([[22, 30], [30, 40]], 3); d.line([[26, 22], [36, 26]], 3); for (const y of [16, 24, 32]) d.line([[2, y], [10, y]], 2, '#808080'); },
  star: (d) => d.shape(star(24, 25, 20, 9), '#ffff00', 3),
  upload: (d) => { arrow(d, 'up', '#00c060', 24, 20, 0.85); d.line([[6, 36], [6, 42], [42, 42], [42, 36]], 4); },
  download: (d) => { arrow(d, 'down', '#4080ff', 24, 20, 0.85); d.line([[6, 36], [6, 42], [42, 42], [42, 36]], 4); },
  pencil: (d) => { d.shape([[10, 32], [32, 10], [38, 16], [16, 38]], '#ffd040', 2); d.shape([[10, 32], [16, 38], [6, 42]], '#ffc080', 2); d.shape([[32, 10], [36, 6], [42, 12], [38, 16]], '#ff80c0', 2); },
  trash: (d) => { d.shape([[8, 12], [40, 12], [40, 16], [8, 16]], '#808080', 2); d.shape([[18, 6], [30, 6], [30, 12], [18, 12]], '#808080', 2); d.shape([[11, 16], [37, 16], [34, 42], [14, 42]], '#c0c0c0', 2); for (const x of [19, 24, 29]) d.line([[x, 21], [x, 37]], 2); },
  phone: (d) => { d.shape([[14, 4], [34, 4], [34, 44], [14, 44]], '#404040', 2); d.shape([[17, 9], [31, 9], [31, 36], [17, 36]], '#80ffff', 1); d.dot(24, 40, 2, '#ffffff'); },
  crown: (d) => d.shape([[6, 38], [6, 14], [16, 26], [24, 8], [32, 26], [42, 14], [42, 38]], '#ffd700', 2),
  speaker: (d) => { d.shape([[6, 18], [14, 18], [26, 8], [26, 40], [14, 30], [6, 30]], '#808080', 2); d.line([[32, 16], [36, 24], [32, 32]], 3); d.line([[38, 10], [44, 24], [38, 38]], 3); },
  chat: (d) => { d.shape([[6, 8], [42, 8], [42, 32], [20, 32], [10, 42], [12, 32], [6, 32]], '#ffffff', 2); for (const x of [16, 24, 32]) d.dot(x, 20, 2.5); },
  gamepad: (d) => { d.shape([[6, 18], [42, 18], [44, 36], [34, 38], [28, 30], [20, 30], [14, 38], [4, 36]], '#8080ff', 2); d.line([[12, 24], [20, 24]], 3); d.line([[16, 20], [16, 28]], 3); d.dot(32, 23, 2.5, '#ff0000'); d.dot(37, 27, 2.5, '#ffff00'); },
  globe: (d) => { d.blob(24, 24, 19, 19, '#80c0ff', 2); d.shape([[14, 14], [24, 10], [26, 20], [16, 26]], '#00c060', 1); d.shape([[28, 28], [38, 26], [34, 38]], '#00c060', 1); },
  check: (d) => d.line([[8, 24], [20, 38], [42, 10]], 6, '#00a040'),
  back: (d) => { d.line([[36, 40], [40, 24], [30, 14], [14, 14]], 5); d.shape([[16, 4], [4, 14], [16, 24]], '#000000', 0); },
  close: (d) => { d.line([[10, 10], [38, 38]], 6, '#ff0000'); d.line([[38, 10], [10, 38]], 6, '#ff0000'); },
  lightning: (d) => d.shape([[28, 4], [10, 26], [22, 26], [16, 44], [38, 18], [26, 18]], '#ffff00', 2),
  counter: (d) => { d.line(d.wobbleEllipse(24, 24, 15, 15, 0.05).slice(0, 28), 4, '#ff4040'); d.shape([[34, 6], [44, 16], [32, 18]], '#ff4040', 1); },
  up: (d) => arrow(d, 'up', '#ffffff'),
  down: (d) => arrow(d, 'down', '#ffffff'),
  left: (d) => arrow(d, 'left', '#ffffff'),
  right: (d) => arrow(d, 'right', '#ffffff'),
  more: (d) => d.shape([[10, 14], [38, 14], [24, 36]], '#ff8040', 2),
  shard: (d) => d.shape([[24, 4], [38, 20], [30, 44], [12, 34], [12, 16]], '#ff80c0', 2),
  heart: (d) => d.shape([[24, 42], [6, 22], [8, 10], [18, 8], [24, 16], [30, 8], [40, 10], [42, 22]], '#ff4060', 2),
  skull: (d) => { d.blob(24, 20, 16, 15, '#c080ff', 2); d.shape([[16, 32], [32, 32], [30, 42], [18, 42]], '#c080ff', 2); d.blob(18, 20, 4, 5, '#000000', 0); d.blob(31, 20, 4, 5, '#000000', 0); },
  fire: (d) => { d.shape([[24, 4], [38, 24], [36, 40], [12, 40], [10, 24], [18, 16], [20, 26]], '#ff4000', 2); d.shape([[24, 22], [30, 32], [28, 38], [20, 38], [18, 32]], '#ffff00', 1); },
  zzz: (d) => { d.text('Z', 6, 40, 26, '#4080ff'); d.text('z', 26, 24, 18, '#4080ff'); d.text('z', 36, 12, 12, '#4080ff'); },
  spiral: (d) => { const pts: Pt[] = []; for (let t = 0; t < 14; t += 0.3) pts.push([24 + Math.cos(t) * t * 1.4, 24 + Math.sin(t) * t * 1.4]); d.line(pts, 3, '#ff00ff'); },
  chain: (d) => { d.line(d.wobbleEllipse(16, 30, 9, 6, 0.05), 4, '#808080', { closed: true }); d.line(d.wobbleEllipse(32, 18, 9, 6, 0.05), 4, '#808080', { closed: true }); },
  atkUp: (d) => { sword(d); arrow(d, 'up', '#00e060', 38, 16, 0.5); },
  atkDown: (d) => { sword(d); arrow(d, 'down', '#ff2020', 38, 32, 0.5); },
  defUp: (d) => { shieldShape(d, '#4080ff'); arrow(d, 'up', '#00e060', 38, 14, 0.5); },
  defDown: (d) => { shieldShape(d, '#4080ff'); arrow(d, 'down', '#ff2020', 38, 32, 0.5); },
  regen: (d) => { DRAW.heart(d); d.shape([[34, 4], [40, 4], [40, 10], [46, 10], [46, 16], [40, 16], [40, 22], [34, 22], [34, 16], [28, 16], [28, 10], [34, 10]], '#00e060', 1); },
  diamond: (d) => d.shape([[24, 4], [42, 24], [24, 44], [6, 24]], '#80c0ff', 2),
  blind: (d) => { d.shape([[4, 24], [24, 12], [44, 24], [24, 36]], '#ffffff', 2); d.blob(24, 24, 6, 6, '#000000', 0); d.line([[8, 40], [40, 8]], 4, '#ff0000'); },
  wing: (d) => d.shape([[6, 30], [20, 10], [42, 6], [34, 18], [42, 22], [30, 30], [36, 38], [16, 38]], '#ffffff', 2),
  spike: (d) => { for (const x of [10, 24, 38]) d.shape([[x - 7, 40], [x, 8], [x + 7, 40]], '#c0c0c0', 2); },
  boss: (d) => { d.blob(24, 26, 17, 16, '#ff4040', 2); d.shape([[10, 14], [8, 2], [18, 12]], '#ffffff', 2); d.shape([[38, 14], [40, 2], [30, 12]], '#ffffff', 2); d.line([[14, 22], [21, 26]], 3); d.line([[34, 22], [27, 26]], 3); },
  note: (d) => { d.line([[32, 8], [32, 34]], 4); d.blob(26, 36, 7, 5, '#000000', 0); d.line([[32, 8], [42, 14]], 4); },
  share: (d) => { d.line([[14, 18], [8, 18], [8, 44], [40, 44], [40, 18], [34, 18]], 4, '#0080ff'); d.line([[24, 32], [24, 6]], 4, '#0080ff'); d.line([[16, 13], [24, 5], [32, 13]], 4, '#0080ff'); },
  addSquare: (d) => { d.shape([[6, 6], [42, 6], [42, 42], [6, 42]], '#ffffff', 3); d.line([[24, 14], [24, 34]], 4); d.line([[14, 24], [34, 24]], 4); },
  dots: (d) => { for (const y of [10, 24, 38]) d.dot(24, y, 4.5); },
  rotate: (d) => { d.shape([[16, 6], [32, 6], [32, 42], [16, 42]], '#404040', 2); d.shape([[19, 10], [29, 10], [29, 36], [19, 36]], '#80ffff', 1); d.line([[38, 14], [44, 24], [38, 34]], 3, '#ff8040'); d.shape([[36, 30], [44, 36], [34, 38]], '#ff8040', 1); },
  camera: (d) => { d.shape([[4, 14], [16, 14], [20, 8], [30, 8], [34, 14], [44, 14], [44, 40], [4, 40]], '#808080', 2); d.blob(24, 27, 9, 9, '#80c0ff', 2); },
};

export function uiIconCanvas(name: UiIconName): HTMLCanvasElement {
  let c = canvasCache.get(name);
  if (!c) {
    const d = new Doodle(S, S, hashString('ui:' + name));
    DRAW[name](d);
    c = d.finish(2);
    canvasCache.set(name, c);
  }
  return c;
}

export function uiIconURL(name: UiIconName): string {
  let u = urlCache.get(name);
  if (!u) { u = uiIconCanvas(name).toDataURL(); urlCache.set(name, u); }
  return u;
}

/** <img class="ico"> for DOM UI. */
export function uiIcon(name: UiIconName, cls = ''): HTMLImageElement {
  const img = document.createElement('img');
  img.className = `ico${cls ? ' ' + cls : ''}`;
  img.src = uiIconURL(name);
  img.alt = '';
  img.draggable = false;
  return img;
}

/** Phaser texture for the same icon. */
export function ensureUiIconTexture(scene: Phaser.Scene, name: UiIconName): string {
  const key = `ui:${name}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, uiIconCanvas(name));
  return key;
}
