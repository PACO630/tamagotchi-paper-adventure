/** Enemies, also as clumsy MS Paint doodles. Each body type is drawn into a 128x128 box. */
import type { EnemyArt } from '../data/types';
import { Doodle, type Pt } from './paint';
import { basePose, drawCharacter } from './characterArt';
import { hashString } from '../core/util';

export type EnemyFrame = 'idle0' | 'idle1' | 'attack' | 'hurt';

function eyes(d: Doodle, x: number, y: number, gap: number, mood: 'angry' | 'hurt' | 'normal', col = '#000000', size = 4) {
  if (mood === 'hurt') {
    d.line([[x - gap - 4, y - 3], [x - gap + 3, y], [x - gap - 4, y + 3]], 2);
    d.line([[x + gap + 4, y - 3], [x + gap - 3, y], [x + gap + 4, y + 3]], 2);
    return;
  }
  d.blob(x - gap, y, size + 2, size + 3, '#ffffff', 2);
  d.blob(x + gap, y + 1, size + 1, size + 2, '#ffffff', 2);
  d.dot(x - gap + 1, y + 1, size * 0.55, col);
  d.dot(x + gap - 1, y + 1, size * 0.5, col);
  if (mood === 'angry') {
    d.line([[x - gap - 7, y - 9], [x - gap + 5, y - 5]], 3);
    d.line([[x + gap - 5, y - 5], [x + gap + 7, y - 10]], 3);
  }
}

function mouth(d: Doodle, x: number, y: number, mood: 'angry' | 'hurt' | 'normal') {
  if (mood === 'hurt') d.blob(x, y, 4, 5, '#800000', 2);
  else if (mood === 'angry') d.line([[x - 8, y], [x - 4, y - 3], [x, y], [x + 4, y - 3], [x + 8, y]], 2);
  else d.line([[x - 6, y + 2], [x, y - 1], [x + 6, y + 2]], 2);
}

function spikes(d: Doodle, cx: number, cy: number, r: number, n: number, col: string, from = 0, to = Math.PI * 2) {
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * (i + 0.5)) / n;
    const b1: Pt = [cx + Math.cos(a - 0.18) * r, cy + Math.sin(a - 0.18) * r];
    const b2: Pt = [cx + Math.cos(a + 0.18) * r, cy + Math.sin(a + 0.18) * r];
    const tip: Pt = [cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12)];
    d.shape([b1, tip, b2], col, 2, 1);
  }
}

export function drawEnemy(d: Doodle, art: EnemyArt, frame: EnemyFrame, spiky: boolean): void {
  const mood = frame === 'hurt' ? 'hurt' : frame === 'attack' ? 'angry' : 'normal';
  const bob = frame === 'idle1' ? 3 : 0;
  const lunge = frame === 'attack' ? -8 : 0;
  const c = art.color, a = art.accent;
  const ctx = d.ctx;
  ctx.save();
  if (frame === 'hurt') { ctx.translate(64, 120); ctx.scale(1.12, 0.88); ctx.translate(-64, -120); }

  if (art.mimic) {
    drawCharacter(d, { charId: art.mimic, dark: true }, basePose({
      facing: 'front', expr: mood === 'hurt' ? 'hurt' : 'angry', bob, lean: lunge,
    }));
    ctx.restore();
    return;
  }
  const cx = 64 + lunge, cy = 80 - bob;
  switch (art.body) {
    case 'blob': {
      d.blob(cx, cy + 14, 36, 26, c, 3, 0.12);
      d.spray(cx - 14, cy + 4, 7, a, 30);
      d.spray(cx + 18, cy + 18, 5, a, 22);
      eyes(d, cx, cy + 8, 11, mood);
      mouth(d, cx, cy + 24, mood);
      break;
    }
    case 'mushroom': {
      d.blob(cx, cy + 22, 18, 18, '#ffffc0', 3);
      d.blob(cx, cy - 4, 40, 22, c, 3, 0.1);
      for (const [x, y] of [[-20, -8], [4, -16], [22, -2]]) d.blob(cx + x, cy + y, 6, 5, a, 2);
      eyes(d, cx, cy + 20, 7, mood, '#000000', 3);
      mouth(d, cx, cy + 32, mood);
      break;
    }
    case 'bug': {
      d.blob(cx - 18, cy - 4, 14, 18, '#ffffff', 2, 0.2);
      d.blob(cx + 18, cy - 6, 14, 18, '#ffffff', 2, 0.2);
      d.blob(cx, cy + 10, 26, 22, c, 3);
      d.scribble(cx - 18, cy + 10, 36, 6, a, 6);
      d.line([[cx - 6, cy - 8], [cx - 14, cy - 28]], 2);
      d.line([[cx + 6, cy - 8], [cx + 16, cy - 28]], 2);
      eyes(d, cx, cy + 4, 9, mood);
      if (spiky) spikes(d, cx, cy + 10, 24, 5, '#c0c0c0', Math.PI * 1.1, Math.PI * 1.9);
      break;
    }
    case 'bird': {
      const flap = frame === 'idle1' ? -10 : 6;
      d.shape([[cx - 18, cy + 4], [cx - 48, cy + flap - 8], [cx - 30, cy + 16]], a, 3);
      d.shape([[cx + 18, cy + 4], [cx + 48, cy + flap - 10], [cx + 30, cy + 16]], a, 3);
      d.blob(cx, cy + 6, 26, 24, c, 3);
      d.shape([[cx - 5, cy + 12], [cx + 5, cy + 12], [cx, cy + 22]], '#ffff00', 2);
      eyes(d, cx, cy, 10, mood);
      break;
    }
    case 'candy': {
      if (spiky) spikes(d, cx, cy + 6, 28, 9, '#ffffff');
      d.line([[cx, cy + 34], [cx + 2, cy + 46]], 6, '#ffffff', { broken: 0 });
      const pts = d.blob(cx, cy + 6, 30, 30, c, 3);
      void pts;
      for (let i = 0; i < 3; i++) d.line(d.wobbleEllipse(cx + 2, cy + 6, 22 - i * 7, 22 - i * 7, 0.1, 18).slice(0, 12), 3, a);
      eyes(d, cx, cy + 2, 10, mood);
      mouth(d, cx, cy + 18, mood);
      break;
    }
    case 'tree': {
      d.shape([[cx - 16, cy + 44], [cx - 10, cy - 6], [cx + 12, cy - 6], [cx + 18, cy + 44]], a, 3);
      d.blob(cx, cy - 26, 50, 32, c, 3, 0.14);
      for (const [x, y, col] of [[-26, -30, '#ffffff'], [6, -44, '#ffff00'], [26, -22, '#00ffff'], [-6, -18, '#ff0000']] as [number, number, string][]) d.blob(cx + x, cy + y, 6, 6, col, 2);
      eyes(d, cx + 1, cy + 12, 7, mood, '#ff0000', 3);
      mouth(d, cx, cy + 28, mood);
      d.line([[cx - 46, cy - 10], [cx - 58, cy + 10]], 4, a);
      d.line([[cx + 46, cy - 12], [cx + 58, cy + 8]], 4, a);
      break;
    }
    case 'cloud': {
      for (const [x, y, r] of [[-22, 8, 18], [20, 6, 20], [0, -6, 24], [0, 14, 22]] as number[][]) d.blob(cx + x, cy + y, r, r * 0.85, c, 3, 0.1);
      eyes(d, cx, cy + 4, 10, mood);
      mouth(d, cx, cy + 18, mood);
      d.shape([[cx + 10, cy + 30], [cx + 2, cy + 42], [cx + 10, cy + 42], [cx + 4, cy + 54]], a, 2);
      break;
    }
    case 'dragon': {
      d.shape([[cx + 16, cy + 18], [cx + 52, cy + 40], [cx + 58, cy + 28], [cx + 30, cy + 6]], c, 3);
      d.shape([[cx - 6, cy - 10], [cx - 40, cy - 42], [cx - 16, cy - 30], [cx - 24, cy - 52], [cx + 6, cy - 18]], a, 3);
      d.blob(cx + 8, cy + 14, 30, 22, c, 3);
      d.blob(cx - 18, cy - 4, 22, 18, c, 3);
      d.shape([[cx - 28, cy - 18], [cx - 34, cy - 36], [cx - 20, cy - 22]], '#ffffff', 2);
      d.shape([[cx - 12, cy - 20], [cx - 8, cy - 38], [cx - 4, cy - 20]], '#ffffff', 2);
      eyes(d, cx - 18, cy - 8, 7, mood, '#ff0000', 3);
      mouth(d, cx - 22, cy + 6, mood);
      d.spray(cx + 10, cy + 20, 10, a, 40);
      break;
    }
    case 'robot': {
      if (spiky) spikes(d, cx, cy - 22, 10, 3, '#c0c0c0', Math.PI * 1.15, Math.PI * 1.85);
      d.shape([[cx - 30, cy - 22], [cx + 28, cy - 24], [cx + 32, cy + 34], [cx - 28, cy + 36]], c, 3, 2);
      d.shape([[cx - 18, cy - 14], [cx + 18, cy - 15], [cx + 18, cy + 4], [cx - 18, cy + 5]], '#000000', 2, 1);
      if (mood === 'hurt') { d.line([[cx - 12, cy - 9], [cx - 4, cy - 1]], 2, '#00ff00'); d.line([[cx + 4, cy - 9], [cx + 12, cy - 1]], 2, '#00ff00'); }
      else { d.dot(cx - 9, cy - 5, 3.5, mood === 'angry' ? '#ff0000' : '#00ff00'); d.dot(cx + 9, cy - 6, 3, mood === 'angry' ? '#ff0000' : '#00ff00'); }
      for (const [x, y] of [[-22, 14], [22, 14], [-22, 28], [22, 28]]) d.dot(cx + x, cy + y, 2.5, a);
      d.line([[cx, cy - 24], [cx + 3, cy - 38]], 2);
      d.blob(cx + 3, cy - 40, 4, 4, a, 2);
      d.blob(cx - 18, cy + 44, 10, 6, '#808080', 3);
      d.blob(cx + 18, cy + 44, 10, 6, '#808080', 3);
      break;
    }
    case 'fish': {
      if (spiky) spikes(d, cx, cy + 6, 30, 10, a);
      d.shape([[cx + 26, cy + 6], [cx + 50, cy - 12], [cx + 46, cy + 6], [cx + 50, cy + 24]], a, 3);
      d.blob(cx, cy + 6, 34, 26, c, 3);
      d.shape([[cx - 4, cy - 18], [cx + 10, cy - 30], [cx + 14, cy - 16]], a, 2);
      d.blob(cx - 16, cy, 8, 9, '#ffffff', 2);
      if (mood === 'hurt') d.line([[cx - 20, cy - 3], [cx - 12, cy + 3]], 2);
      else d.dot(cx - 17, cy + 1, 4);
      if (mood === 'angry') d.line([[cx - 26, cy - 12], [cx - 8, cy - 8]], 3);
      mouth(d, cx - 26, cy + 14, mood);
      for (let i = 0; i < 4; i++) d.line([[cx - 2 + i * 7, cy + 14], [cx + 2 + i * 7, cy + 22]], 1, a);
      break;
    }
    case 'jelly': {
      for (let i = 0; i < 5; i++) {
        const x = cx - 20 + i * 10;
        d.line([[x, cy + 14], [x + d.r(-6, 6), cy + 30], [x + d.r(-6, 6), cy + 46]], 3, a);
      }
      d.blob(cx, cy, 30, 22, c, 3);
      d.shape([[cx - 30, cy + 4], [cx + 30, cy + 4], [cx + 28, cy + 14], [cx - 28, cy + 14]], c, 3);
      eyes(d, cx, cy - 2, 9, mood);
      break;
    }
    case 'crab': {
      for (const s of [-1, 1]) {
        d.line([[cx + s * 22, cy + 16], [cx + s * 40, cy - 2]], 4);
        d.shape([[cx + s * 34, cy - 4], [cx + s * 54, cy - 20], [cx + s * 46, cy - 2], [cx + s * 56, cy + 2], [cx + s * 40, cy + 8]], c, 3);
        for (let k = 0; k < 3; k++) d.line([[cx + s * 14, cy + 26], [cx + s * (26 + k * 6), cy + 40]], 2);
      }
      d.blob(cx, cy + 6, 22, 14, a, 3, 0.2);
      d.blob(cx, cy + 20, 32, 18, c, 3);
      d.line([[cx - 8, cy + 8], [cx - 10, cy - 8]], 2);
      d.line([[cx + 8, cy + 8], [cx + 10, cy - 8]], 2);
      d.blob(cx - 10, cy - 10, 5, 5, '#ffffff', 2);
      d.blob(cx + 10, cy - 10, 5, 5, '#ffffff', 2);
      d.dot(cx - 10, cy - 10, 2);
      d.dot(cx + 10, cy - 9, 2);
      mouth(d, cx, cy + 24, mood);
      break;
    }
    case 'ghost': {
      const pts: Pt[] = [];
      for (let i = 0; i <= 12; i++) { const t = Math.PI + (i / 12) * Math.PI; pts.push([cx + Math.cos(t) * 30, cy - 4 + Math.sin(t) * 34]); }
      for (let i = 0; i <= 6; i++) pts.push([cx + 30 - i * 10, cy + 34 + (i % 2 ? -8 : 2) + bob]);
      d.shape(pts, c, 3);
      d.blob(cx - 10, cy - 8, 6, 8, mood === 'hurt' ? '#ffffff' : '#000000', 2);
      d.blob(cx + 10, cy - 6, 5, 7, mood === 'hurt' ? '#ffffff' : '#000000', 2);
      d.blob(cx, cy + 12, 6, mood === 'angry' ? 7 : 4, '#000000', 2);
      d.spray(cx + 18, cy + 18, 8, a, 30);
      break;
    }
    case 'knight':
    case 'mirror': {
      const body = art.body === 'mirror' ? '#e0e0ff' : c;
      d.line([[cx + 34, cy - 40], [cx + 30, cy + 44]], 4, '#808080');
      d.shape([[cx + 28, cy - 40], [cx + 34, cy - 58], [cx + 40, cy - 40]], '#c0c0c0', 2);
      d.shape([[cx - 26, cy + 4], [cx + 26, cy + 4], [cx + 22, cy + 42], [cx - 22, cy + 42]], body, 3);
      d.blob(cx, cy - 16, 26, 24, body, 3);
      d.shape([[cx - 18, cy - 18], [cx + 18, cy - 19], [cx + 17, cy - 12], [cx - 17, cy - 11]], '#000000', 2, 1);
      if (mood !== 'hurt') { d.dot(cx - 8, cy - 15, 2.5, mood === 'angry' ? '#ff0000' : '#ffff00'); d.dot(cx + 8, cy - 15, 2.2, mood === 'angry' ? '#ff0000' : '#ffff00'); }
      d.shape([[cx - 4, cy - 40], [cx + 2, cy - 58], [cx + 12, cy - 44]], a, 2);
      d.blob(cx - 30, cy + 18, 10, 14, a, 3);
      if (art.body === 'mirror') { d.line([[cx - 14, cy + 10], [cx - 4, cy + 30]], 2, '#ffffff'); d.line([[cx + 6, cy - 34], [cx + 14, cy - 26]], 2, '#ffffff'); }
      break;
    }
    case 'guardian':
    case 'golem': {
      d.shape([[cx - 34, cy - 30], [cx + 30, cy - 34], [cx + 36, cy + 40], [cx - 32, cy + 42]], c, 3, 2);
      d.shape([[cx - 50, cy - 10], [cx - 34, cy - 14], [cx - 32, cy + 20], [cx - 48, cy + 22]], c, 3);
      d.shape([[cx + 34, cy - 14], [cx + 50, cy - 12], [cx + 48, cy + 22], [cx + 34, cy + 20]], c, 3);
      d.line([[cx - 20, cy + 10], [cx - 8, cy + 22], [cx - 14, cy + 34]], 2, '#404040');
      d.line([[cx + 18, cy - 24], [cx + 10, cy - 10]], 2, '#404040');
      d.blob(cx - 12, cy - 12, 6, 5, a, 2);
      d.blob(cx + 12, cy - 13, 5, 5, a, 2);
      if (mood === 'angry') d.line([[cx - 22, cy - 24], [cx + 22, cy - 22]], 3);
      mouth(d, cx, cy + 4, mood);
      if (art.body === 'guardian') d.shape([[cx - 10, cy - 34], [cx, cy - 50], [cx + 10, cy - 34]], a, 2);
      break;
    }
    case 'eye': {
      d.line([[cx - 28, cy + 4], [cx - 44, cy - 8]], 3, a);
      d.line([[cx + 28, cy + 4], [cx + 44, cy - 6]], 3, a);
      d.blob(cx, cy + 4, 32, 30, c, 3);
      d.blob(cx, cy + 4, 20, 18, '#ffffff', 2);
      if (mood === 'hurt') { d.line([[cx - 12, cy + 4], [cx + 12, cy + 6]], 3); }
      else { d.blob(cx + 2, cy + 5, 10, 10, a, 2); d.dot(cx + 3, cy + 5, 4); }
      break;
    }
    case 'star': {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 20 : 44;
        pts.push([cx + Math.cos(ang) * r * d.r(0.9, 1.1), cy + 8 + Math.sin(ang) * r * d.r(0.9, 1.1)]);
      }
      d.spray(cx, cy + 8, 52, a, 120);
      d.shape(pts, c, 3);
      eyes(d, cx, cy + 6, 10, mood, a === '#400000' ? '#ff0000' : '#000000');
      mouth(d, cx, cy + 22, mood);
      break;
    }
  }
  ctx.restore();
}

export function renderEnemyFrame(art: EnemyArt, frame: EnemyFrame, spiky: boolean, key: string): HTMLCanvasElement {
  const d = new Doodle(128, 128, hashString(key + frame));
  if (art.dark) d.shake = 1.4;
  drawEnemy(d, art, frame, spiky);
  return d.finish(3);
}
