/**
 * Illustrations for the controls tutorial, drawn in the game's MS Paint doodle style:
 * paper keycaps (WASD, Space, Enter…), a landscape phone with the touch layout, timing rings.
 */
import { hashString } from '../core/util';
import { FONT } from '../core/config';
import { basePose, renderFrame, type Pose } from './characterArt';
import { uiIconCanvas, type UiIconName } from './uiIcons';
import type { CharId } from '../data/types';
import { Doodle } from './paint';

const W = 560, H = 280;
const INK = '#000000';

export type TutorialPic =
  | 'pc-move' | 'pc-action' | 'pc-talk' | 'pc-battle' | 'pc-menu'
  | 'mb-move' | 'mb-action' | 'mb-talk' | 'mb-battle' | 'mb-menu';

const cache = new Map<string, string>();

/** A doodle-style keycap; label is drawn later (crisp) by `labels`. */
function key(d: Doodle, x: number, y: number, w: number, h: number, hot = false) {
  d.shape([[x + 4, y + h + 6], [x + w + 4, y + h + 6], [x + w + 4, y + 10], [x + 4, y + 10]], '#808080', 0, 0);
  d.shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], hot ? '#ffff80' : '#ffffff', 3, 1);
  d.line([[x + 6, y + h - 8], [x + w - 6, y + h - 7]], 2, '#c0c0c0', { broken: 0 });
}

interface Label { text: string; x: number; y: number; size: number; color?: string; outline?: boolean }

function finishPic(d: Doodle, labels: Label[], sprites: { char: CharId; pose: Partial<Pose>; x: number; y: number; s: number }[], icons: { name: UiIconName; x: number; y: number; s: number }[]): string {
  const doodle = d.finish(0);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fffdf6';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e9dcc0';
  for (let y = 31; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.imageSmoothingEnabled = false;
  g.drawImage(doodle, 0, 0);
  for (const s of sprites) {
    const f = renderFrame({ charId: s.char }, basePose(s.pose), `tut:${s.char}:${JSON.stringify(s.pose)}`);
    g.drawImage(f, s.x - 64 * s.s, s.y - 124 * s.s, 128 * s.s, 128 * s.s);
  }
  for (const ic of icons) g.drawImage(uiIconCanvas(ic.name), ic.x - 24 * ic.s, ic.y - 24 * ic.s, 48 * ic.s, 48 * ic.s);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const l of labels) {
    g.font = `700 ${l.size}px ${FONT}`;
    if (l.outline) { g.lineJoin = 'round'; g.lineWidth = Math.max(3, l.size / 6); g.strokeStyle = '#2a1a0a'; g.strokeText(l.text, l.x, l.y); }
    g.fillStyle = l.color ?? '#2a1a0a';
    g.fillText(l.text, l.x, l.y);
  }
  return c.toDataURL();
}

/** Landscape phone with the touch layout; `hot` highlights one control group. */
function phone(d: Doodle, hot: 'stick' | 'ab' | 'ok' | 'menu' | 'none', labels: Label[], icons: { name: UiIconName; x: number; y: number; s: number }[]) {
  const x = 70, y = 26, w = 420, h = 220;
  d.shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#404040', 4, 0);
  d.shape([[x + 16, y + 14], [x + w - 16, y + 14], [x + w - 16, y + h - 14], [x + 16, y + h - 14]], '#80ffff', 2, 0);
  // ground strip on the screen
  d.shape([[x + 16, y + 140], [x + w - 16, y + 140], [x + w - 16, y + h - 14], [x + 16, y + h - 14]], '#80ff80', 0, 0);
  if (hot === 'stick') d.shape([[x + 16, y + 70], [x + 210, y + 70], [x + 210, y + h - 14], [x + 16, y + h - 14]], '#ffff80', 0, 0);
  // joystick
  d.line(d.wobbleEllipse(x + 78, y + 152, 36, 36, 0.05), 3, hot === 'stick' ? '#ff0000' : '#808080', { closed: true });
  d.blob(x + 78, y + 152, 15, 15, '#ffffff', 3);
  // buttons
  d.blob(x + w - 52, y + 150, 24, 24, hot === 'ab' ? '#ffff00' : '#ffff80', 3);
  d.blob(x + w - 104, y + 176, 20, 20, hot === 'ab' ? '#ff00ff' : '#ff80c0', 3);
  d.blob(x + w - 108, y + 120, 16, 16, hot === 'ok' ? '#ffff00' : '#ffffff', 3);
  labels.push({ text: 'A', x: x + w - 52, y: y + 150, size: 20 }, { text: 'B', x: x + w - 104, y: y + 176, size: 18 }, { text: 'OK', x: x + w - 108, y: y + 120, size: 12 });
  // top bar: item slots + menu
  for (let i = 0; i < 3; i++) d.shape([[x + 170 + i * 30, y + 22], [x + 194 + i * 30, y + 22], [x + 194 + i * 30, y + 46], [x + 170 + i * 30, y + 46]], hot === 'menu' ? '#ffff80' : '#ffffff', 2, 0);
  d.shape([[x + w - 52, y + 22], [x + w - 26, y + 22], [x + w - 26, y + 48], [x + w - 52, y + 48]], hot === 'menu' ? '#ffff00' : '#ffd040', 2, 0);
  icons.push({ name: 'menu', x: x + w - 39, y: y + 35, s: 0.4 }, { name: 'bag', x: x + 182, y: y + 34, s: 0.4 });
}

function ring(d: Doodle, cx: number, cy: number, r: number, color: string) {
  d.line(d.wobbleEllipse(cx, cy, r, r, 0.03, 40), 4, color, { closed: true, broken: 0 });
}

export function tutorialPic(p: TutorialPic): string {
  const hit = cache.get(p);
  if (hit) return hit;
  const d = new Doodle(W, H, hashString('tut' + p));
  d.shake = 0.7;
  const labels: Label[] = [];
  const sprites: { char: CharId; pose: Partial<Pose>; x: number; y: number; s: number }[] = [];
  const icons: { name: UiIconName; x: number; y: number; s: number }[] = [];
  const K = (x: number, y: number, w: number, h: number, text: string, hot = false, size = 26) => { key(d, x, y, w, h, hot); labels.push({ text, x: x + w / 2, y: y + h / 2 - 2, size }); };
  switch (p) {
    case 'pc-move':
      K(96, 40, 62, 58, 'W', true); K(28, 104, 62, 58, 'A', true); K(96, 104, 62, 58, 'S', true); K(164, 104, 62, 58, 'D', true);
      K(364, 40, 56, 52, '↑'); K(300, 98, 56, 52, '←'); K(364, 98, 56, 52, '↓'); K(428, 98, 56, 52, '→');
      K(28, 196, 120, 50, 'Shift', false, 22);
      labels.push({ text: '移動', x: 128, y: 24, size: 20, color: '#d0562a' }, { text: '或方向鍵', x: 392, y: 24, size: 18, color: '#7a6450' }, { text: '按住＝奔跑', x: 220, y: 222, size: 20, color: '#d0562a' });
      sprites.push({ char: 'mametchi', pose: { facing: 'side', footL: -8, footR: 8, liftR: 4, bob: 2 }, x: 450, y: 262, s: 0.9 });
      break;
    case 'pc-action':
      K(30, 70, 230, 56, 'Space', true, 24);
      K(300, 70, 64, 56, 'J', true); K(420, 70, 64, 56, 'X', true);
      labels.push({ text: '跳躍', x: 145, y: 46, size: 22, color: '#d0562a' }, { text: '鎚子攻擊', x: 392, y: 46, size: 22, color: '#d0562a' }, { text: '或', x: 392, y: 98, size: 16, color: '#7a6450' });
      d.blob(145, 262, 34, 7, '#c0c0c0', 0);
      for (const [x1, y1] of [[110, 238], [180, 238]]) d.line([[x1, y1], [x1 + (x1 < 145 ? -10 : 10), y1 + 12]], 3, '#808080');
      sprites.push({ char: 'mametchi', pose: { facing: 'side', sx: 0.93, sy: 1.08, armL: 2.4, armR: -2.4, expr: 'happy' }, x: 145, y: 236, s: 0.95 });
      sprites.push({ char: 'mametchi', pose: { facing: 'side', hammer: 0.35, lean: 7, expr: 'angry' }, x: 392, y: 270, s: 0.95 });
      break;
    case 'pc-talk':
      K(40, 90, 150, 60, 'Enter', true, 24); K(210, 90, 64, 60, 'E', true);
      labels.push({ text: '調查・對話・確認', x: 158, y: 60, size: 22, color: '#d0562a' }, { text: '靠近角色或寶箱，出現對話泡泡時按下', x: 160, y: 190, size: 16, color: '#7a6450' });
      d.blob(430, 70, 40, 30, '#ffffff', 3);
      labels.push({ text: '…', x: 430, y: 66, size: 30, color: '#e8203a' });
      sprites.push({ char: 'kuchipatchi', pose: { facing: 'front', expr: 'happy' }, x: 430, y: 262, s: 1.1 });
      break;
    case 'pc-battle':
      ring(d, 120, 120, 92, '#ffd040'); ring(d, 120, 120, 60, '#ffd040'); ring(d, 120, 120, 30, '#ffffff');
      d.blob(120, 120, 26, 26, null, 4);
      K(250, 90, 150, 60, 'Enter', true, 24);
      labels.push({ text: '光圈縮到中間的瞬間按下！', x: 280, y: 36, size: 20, color: '#d0562a' }, { text: '鎚子＝傷害提升　防禦＝減少傷害', x: 330, y: 190, size: 16, color: '#7a6450' }, { text: 'Perfect!', x: 120, y: 236, size: 24, color: '#ffd23a', outline: true });
      sprites.push({ char: 'mametchi', pose: { facing: 'side', expr: 'determined' }, x: 480, y: 270, s: 0.8 });
      break;
    case 'pc-menu':
      K(60, 90, 100, 60, 'Esc', true, 24); K(320, 90, 70, 60, 'Q', true);
      labels.push({ text: '選單（背包・任務・存檔）', x: 110, y: 60, size: 18, color: '#d0562a' }, { text: '快速使用道具', x: 355, y: 60, size: 18, color: '#d0562a' });
      icons.push({ name: 'bag', x: 110, y: 210, s: 1.3 }, { name: 'scroll', x: 180, y: 210, s: 1.1 }, { name: 'floppy', x: 40, y: 210, s: 1.1 }, { name: 'heart', x: 355, y: 210, s: 1.3 });
      break;
    case 'mb-move':
      phone(d, 'stick', labels, icons);
      labels.push({ text: '按住左半邊拖曳＝移動', x: 200, y: 268, size: 18, color: '#d0562a' });
      icons.push({ name: 'run', x: 260, y: 150, s: 0.9 });
      break;
    case 'mb-action':
      phone(d, 'ab', labels, icons);
      labels.push({ text: 'A＝跳躍　B＝鎚子攻擊', x: 280, y: 268, size: 18, color: '#d0562a' });
      break;
    case 'mb-talk':
      phone(d, 'ok', labels, icons);
      labels.push({ text: '按 OK 或直接點角色頭上的泡泡＝對話', x: 280, y: 268, size: 17, color: '#d0562a' });
      d.blob(250, 110, 26, 20, '#ffffff', 3);
      labels.push({ text: '…', x: 250, y: 106, size: 24, color: '#e8203a' });
      break;
    case 'mb-battle':
      ring(d, 150, 130, 90, '#ffd040'); ring(d, 150, 130, 56, '#ffd040'); ring(d, 150, 130, 28, '#ffffff');
      d.blob(150, 130, 24, 24, null, 4);
      // finger tapping
      d.shape([[330, 70], [352, 70], [356, 160], [326, 160]], '#ffe0c0', 3, 0);
      d.blob(341, 166, 30, 26, '#ffe0c0', 3);
      for (const r of [16, 28]) d.line(d.wobbleEllipse(341, 62, r, r * 0.6, 0.05), 2, '#ff8040', { closed: true });
      labels.push({ text: '光圈縮到中間時，點一下畫面！', x: 280, y: 236, size: 20, color: '#d0562a' }, { text: '指令選單直接點選', x: 450, y: 120, size: 16, color: '#7a6450' });
      break;
    case 'mb-menu':
      phone(d, 'menu', labels, icons);
      labels.push({ text: '右上角＝選單　上方＝快速道具', x: 280, y: 268, size: 18, color: '#d0562a' });
      break;
  }
  const url = finishPic(d, labels, sprites, icons);
  cache.set(p, url);
  return url;
}
