/**
 * Refined 2.5D paper-craft scenery. Unlike the characters, everything here is clean:
 * layered cut paper with soft gradients, white die-cut borders, drop shadows and paper grain.
 */
import { makeRng } from '../core/util';
import type { ThemeDef } from '../data/types';

type Ctx = CanvasRenderingContext2D;

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export function shade(c: string, amt: number): string {
  const n = parseInt(c.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

let grain: HTMLCanvasElement | null = null;
function grainCanvas(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const g = grain.getContext('2d')!;
  const img = g.createImageData(128, 128);
  const rnd = makeRng(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + rnd() * 135;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')!];
}

/** Wraps a vector drawing into a paper cutout: white die-cut border + shadow + grain. */
export function paperCut(w: number, h: number, draw: (g: Ctx) => void, border = 4, shadow = true): HTMLCanvasElement {
  const pad = border + 8;
  const [art, a] = canvas(w, h);
  draw(a);
  // grain only on the drawn pixels
  a.globalCompositeOperation = 'source-atop';
  a.fillStyle = a.createPattern(grainCanvas(), 'repeat')!;
  a.fillRect(0, 0, w, h);
  a.globalCompositeOperation = 'source-over';

  const [sil, s] = canvas(w + pad * 2, h + pad * 2);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    s.drawImage(art, pad + Math.cos(ang) * border, pad + Math.sin(ang) * border);
  }
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fffdf6';
  s.fillRect(0, 0, sil.width, sil.height);

  const [out, o] = canvas(w + pad * 2, h + pad * 2);
  if (shadow) {
    o.save();
    o.filter = 'blur(3px)';
    o.globalAlpha = 0.28;
    o.drawImage(sil, 3, 5);
    o.restore();
    o.globalCompositeOperation = 'source-atop';
    o.fillStyle = '#2a1a10';
    o.fillRect(0, 0, out.width, out.height);
    o.globalCompositeOperation = 'source-over';
  }
  o.drawImage(sil, 0, 0);
  o.drawImage(art, pad, pad);
  return out;
}

function vgrad(g: Ctx, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, c0);
  gr.addColorStop(1, c1);
  return gr;
}

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function rect(g: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, r = 0) {
  g.fillStyle = fill;
  g.beginPath();
  if (r) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
  g.fill();
}

function poly(g: Ctx, pts: number[][], fill: string | CanvasGradient) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath();
  g.fill();
}

function star(g: Ctx, cx: number, cy: number, r1: number, r2: number, fill: string | CanvasGradient) {
  const pts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  poly(g, pts, fill);
}

function canopy(g: Ctx, cx: number, cy: number, r: number, col: string) {
  const blobs = [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.2, 0.72], [0, -0.45, 0.7], [-0.3, -0.25, 0.6], [0.32, -0.3, 0.6]];
  for (const [dx, dy, s] of blobs) ellipse(g, cx + dx * r, cy + dy * r, r * s, r * s * 0.92, vgrad(g, cy - r, cy + r, shade(col, 0.25), shade(col, -0.2)));
  ellipse(g, cx - r * 0.3, cy - r * 0.35, r * 0.25, r * 0.16, 'rgba(255,255,255,0.25)');
}

/* ---------------- Props ---------------- */

export interface PropSpec { w: number; h: number; draw: (g: Ctx, w: number, h: number) => void; anchorY?: number }

export const PROPS: Record<string, PropSpec> = {
  tree_round: { w: 150, h: 220, draw: (g, w, h) => { rect(g, w / 2 - 12, h * 0.5, 24, h * 0.5, vgrad(g, h * 0.5, h, '#9a6436', '#6b4220'), 6); canopy(g, w / 2, h * 0.36, 62, '#4fb34a'); } },
  tree_pine: { w: 120, h: 240, draw: (g, w, h) => { rect(g, w / 2 - 9, h * 0.75, 18, h * 0.25, '#7a4a26', 4); for (let i = 0; i < 3; i++) poly(g, [[w / 2, 10 + i * 50], [w / 2 + 50 - i * 4, 100 + i * 55], [w / 2 - 50 + i * 4, 100 + i * 55]], vgrad(g, i * 50, 100 + i * 55, '#3c9a5a', '#1f6a3a')); } },
  bush: { w: 130, h: 70, draw: (g, w, h) => { for (const [x, r] of [[30, 28], [65, 34], [100, 28]]) ellipse(g, x, h - r + 4, r, r * 0.9, vgrad(g, 0, h, '#6ccc5c', '#3a8a3a')); } },
  flower: { w: 40, h: 70, draw: (g, w, h) => { rect(g, w / 2 - 2, 26, 4, h - 26, '#3a9a3a'); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ellipse(g, w / 2 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, 7, 7, '#ff6aa0'); } ellipse(g, w / 2, 20, 6, 6, '#ffe04a'); } },
  flower_y: { w: 40, h: 64, draw: (g, w, h) => { rect(g, w / 2 - 2, 24, 4, h - 24, '#3a9a3a'); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ellipse(g, w / 2 + Math.cos(a) * 8, 18 + Math.sin(a) * 8, 7, 7, '#ffd23a'); } ellipse(g, w / 2, 18, 5, 5, '#b05a1a'); } },
  rock: { w: 100, h: 60, draw: (g, w, h) => poly(g, [[8, h], [18, 22], [44, 6], [78, 14], [94, h]], vgrad(g, 0, h, '#c8c2b8', '#8a8478')) },
  fence: { w: 200, h: 70, draw: (g, w, h) => { rect(g, 0, 24, w, 10, '#e8c890'); rect(g, 0, 48, w, 10, '#e8c890'); for (let x = 8; x < w; x += 38) poly(g, [[x, h], [x, 14], [x + 9, 4], [x + 18, 14], [x + 18, h]], vgrad(g, 0, h, '#f6dcaa', '#c49a60')); } },
  house: { w: 230, h: 220, draw: (g, w, h) => {
    rect(g, 24, 96, w - 48, h - 96, vgrad(g, 96, h, '#fff1d6', '#e8cfa4'), 6);
    poly(g, [[6, 104], [w / 2, 14], [w - 6, 104]], vgrad(g, 14, 104, '#ff7a6a', '#c8443a'));
    rect(g, w / 2 - 22, h - 70, 44, 70, '#8a5a34', 8); ellipse(g, w / 2 + 12, h - 36, 3, 3, '#ffd23a');
    for (const x of [44, w - 84]) { rect(g, x, 124, 40, 36, '#7ec8ff', 4); rect(g, x + 18, 124, 4, 36, '#fff'); rect(g, x, 140, 40, 4, '#fff'); }
    rect(g, w - 70, 30, 22, 50, '#a0603a');
  } },
  house_b: { w: 200, h: 200, draw: (g, w, h) => {
    rect(g, 20, 80, w - 40, h - 80, vgrad(g, 80, h, '#e6f4ff', '#bcd8f0'), 6);
    ellipse(g, w / 2, 86, w / 2 - 4, 60, vgrad(g, 20, 120, '#7ab8ff', '#3a78d0'));
    rect(g, 20, 86, w - 40, 40, vgrad(g, 86, 126, '#e6f4ff', '#d6e8fa'));
    rect(g, w / 2 - 20, h - 64, 40, 64, '#6a4a8a', 18); rect(g, 40, 120, 34, 30, '#ffe680', 16);
  } },
  lamp: { w: 50, h: 170, draw: (g, w, h) => { rect(g, w / 2 - 4, 40, 8, h - 40, '#4a4a5a'); ellipse(g, w / 2, 34, 18, 22, vgrad(g, 10, 56, '#fff6b0', '#ffd23a')); rect(g, w / 2 - 14, h - 10, 28, 10, '#4a4a5a', 3); } },
  well: { w: 130, h: 150, draw: (g, w, h) => { rect(g, 14, 80, w - 28, h - 80, vgrad(g, 80, h, '#c8c2b8', '#8a8478'), 10); rect(g, 22, 20, 8, 70, '#8a5a34'); rect(g, w - 30, 20, 8, 70, '#8a5a34'); poly(g, [[6, 26], [w / 2, 0], [w - 6, 26]], '#c8443a'); } },
  // Candy forest
  lollipop: { w: 130, h: 260, draw: (g, w, h) => { rect(g, w / 2 - 6, 110, 12, h - 110, '#fff'); ellipse(g, w / 2, 64, 60, 60, vgrad(g, 0, 128, '#ff9ad6', '#e0409a')); g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); for (let t = 0; t < 14; t += 0.1) { const r = t * 4; g.lineTo(w / 2 + Math.cos(t) * r, 64 + Math.sin(t) * r); } g.stroke(); } },
  candy_cane: { w: 70, h: 220, draw: (g, w, h) => { g.lineCap = 'round'; g.lineWidth = 22; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(24, h - 10); g.lineTo(24, 50); g.arc(42, 50, 18, Math.PI, 0); g.stroke(); g.strokeStyle = '#ff3a4a'; g.lineWidth = 22; g.setLineDash([14, 14]); g.stroke(); g.setLineDash([]); } },
  cupcake_house: { w: 220, h: 230, draw: (g, w, h) => {
    poly(g, [[30, 110], [w - 30, 110], [w - 46, h], [46, h]], vgrad(g, 110, h, '#ffd08a', '#c8864a'));
    for (let x = 50; x < w - 40; x += 22) rect(g, x, 116, 8, h - 120, 'rgba(160,90,40,0.35)');
    for (const [x, y, r] of [[w / 2, 70, 70], [w / 2 - 50, 100, 40], [w / 2 + 50, 100, 40]]) ellipse(g, x, y, r, r * 0.7, vgrad(g, 0, 140, '#fff0fa', '#ffb0dc'));
    ellipse(g, w / 2, 18, 14, 14, '#ff3a4a'); rect(g, w / 2 - 20, h - 60, 40, 60, '#8a4a2a', 18);
  } },
  marshmallow: { w: 160, h: 110, draw: (g, w, h) => { ellipse(g, w / 2, h - 34, w / 2 - 4, 34, vgrad(g, h - 70, h, '#ffffff', '#ffd6e8')); ellipse(g, w / 2 - 20, h - 64, 44, 30, vgrad(g, 0, h, '#ffffff', '#ffe6f2')); } },
  gumdrop: { w: 70, h: 64, draw: (g, w, h) => { poly(g, [[6, h], [16, 20], [35, 4], [54, 20], [64, h]], vgrad(g, 0, h, '#7affb0', '#20a060')); for (let i = 0; i < 8; i++) ellipse(g, 14 + (i * 37) % 44, 18 + (i * 23) % 40, 2, 2, '#fff'); } },
  // Sky
  windmill: { w: 140, h: 260, draw: (g, w, h) => { poly(g, [[40, h], [56, 80], [84, 80], [100, h]], vgrad(g, 80, h, '#fffaf0', '#d8ccb8')); poly(g, [[46, 86], [70, 50], [94, 86]], '#6a8ad0'); rect(g, 60, h - 50, 20, 50, '#8a5a34', 8); } },
  blades: { w: 220, h: 220, draw: (g, w, h) => { for (let i = 0; i < 4; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate((i * Math.PI) / 2); rect(g, -10, -104, 20, 96, '#fff'); rect(g, -8, -100, 16, 90, 'rgba(255,190,120,0.6)'); g.restore(); } ellipse(g, w / 2, h / 2, 14, 14, '#c8443a'); } },
  sky_column: { w: 80, h: 260, draw: (g, w, h) => { rect(g, 14, 20, w - 28, h - 40, vgrad(g, 0, h, '#ffffff', '#c8d8f0')); for (let x = 22; x < w - 20; x += 12) rect(g, x, 24, 4, h - 48, 'rgba(120,150,200,0.25)'); rect(g, 4, 0, w - 8, 24, '#e8f0ff', 4); rect(g, 4, h - 24, w - 8, 24, '#e8f0ff', 4); } },
  float_rock: { w: 200, h: 140, draw: (g, w, h) => { poly(g, [[0, 40], [w, 36], [w - 30, 80], [w / 2 + 10, h], [50, 90]], vgrad(g, 30, h, '#c8a888', '#7a5a40')); ellipse(g, w / 2, 40, w / 2, 16, vgrad(g, 20, 56, '#8ae07a', '#4aa04a')); } },
  balloon: { w: 100, h: 170, draw: (g, w, h) => { ellipse(g, w / 2, 50, 44, 50, vgrad(g, 0, 100, '#ffb07a', '#ff6a4a')); g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(16, 70); g.lineTo(36, h - 30); g.moveTo(84, 70); g.lineTo(64, h - 30); g.stroke(); rect(g, 32, h - 32, 36, 28, '#a0703a', 4); } },
  cloud_puff: { w: 200, h: 100, draw: (g, w, h) => { for (const [x, y, r] of [[50, 64, 34], [100, 46, 44], [150, 64, 34], [100, 70, 40]]) ellipse(g, x, y, r, r * 0.8, vgrad(g, 0, h, '#ffffff', '#dce8ff')); } },
  // Factory
  gear_big: { w: 180, h: 180, draw: (g, w, h) => { const n = 12; const pts: number[][] = []; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2; const r = i % 2 ? 72 : 88; pts.push([w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r]); } poly(g, pts, vgrad(g, 0, h, '#d8d8e0', '#8a8a98')); ellipse(g, w / 2, h / 2, 30, 30, '#6a6a78'); ellipse(g, w / 2, h / 2, 12, 12, '#3a3a44'); } },
  gear_small: { w: 100, h: 100, draw: (g, w, h) => { const n = 8; const pts: number[][] = []; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2; const r = i % 2 ? 38 : 48; pts.push([w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r]); } poly(g, pts, vgrad(g, 0, h, '#ffc86a', '#c8862a')); ellipse(g, w / 2, h / 2, 12, 12, '#6a4a2a'); } },
  pipe: { w: 90, h: 260, draw: (g, w, h) => { rect(g, 22, 0, 46, h, vgrad(g, 0, h, '#8ad0a0', '#3a8a5a')); rect(g, 14, 30, 62, 20, '#2a6a44', 4); rect(g, 14, h - 60, 62, 20, '#2a6a44', 4); } },
  crate: { w: 110, h: 100, draw: (g, w, h) => { rect(g, 4, 4, w - 8, h - 8, vgrad(g, 0, h, '#e8b878', '#b07a40'), 6); g.strokeStyle = '#8a5a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.moveTo(w - 10, 10); g.lineTo(10, h - 10); g.stroke(); } },
  toy_block: { w: 90, h: 90, draw: (g, w, h) => { rect(g, 4, 4, w - 8, h - 8, vgrad(g, 0, h, '#7ab8ff', '#3a6ad0'), 10); g.fillStyle = '#fff'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.fillText('T', w / 2, h / 2 + 18); } },
  smokestack: { w: 110, h: 300, draw: (g, w, h) => { rect(g, 24, 30, 62, h - 30, vgrad(g, 0, h, '#c86a5a', '#8a3a2a')); for (let y = 50; y < h; y += 30) rect(g, 24, y, 62, 3, 'rgba(0,0,0,0.15)'); rect(g, 16, 18, 78, 22, '#5a2a1a', 4); } },
  // Ocean
  coral: { w: 150, h: 180, draw: (g, w, h) => { g.lineCap = 'round'; g.strokeStyle = '#ff6a8a'; for (const [x, a, l] of [[75, 0, 150], [75, -0.5, 100], [75, 0.5, 110], [55, -0.9, 60], [95, 0.9, 70]]) { g.lineWidth = 18; g.beginPath(); g.moveTo(75, h); g.lineTo(x + Math.sin(a) * l, h - Math.cos(a) * l); g.stroke(); } } },
  coral_b: { w: 130, h: 120, draw: (g, w, h) => { for (const [x, y, r] of [[40, 80, 30], [80, 70, 36], [100, 90, 26], [60, 50, 26]]) ellipse(g, x, y, r, r, vgrad(g, 0, h, '#ffb86a', '#e0702a')); for (let i = 0; i < 20; i++) ellipse(g, 20 + (i * 37) % 90, 30 + (i * 53) % 80, 2.5, 2.5, 'rgba(255,255,255,0.5)'); } },
  kelp: { w: 70, h: 260, draw: (g, w, h) => { g.strokeStyle = '#3a9a6a'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); for (let y = h; y > 10; y -= 10) g.lineTo(w / 2 + Math.sin(y / 30) * 14, y); g.stroke(); for (let y = h - 30; y > 30; y -= 40) ellipse(g, w / 2 + Math.sin(y / 30) * 14 + 14, y, 14, 7, '#4ab07a'); } },
  shipwreck: { w: 320, h: 200, draw: (g, w, h) => { poly(g, [[10, 90], [w - 10, 70], [w - 50, h], [60, h]], vgrad(g, 70, h, '#9a6a44', '#5a3a24')); for (let x = 30; x < w - 30; x += 30) rect(g, x, 84, 4, h - 90, 'rgba(0,0,0,0.2)'); rect(g, w / 2 - 6, 0, 12, 90, '#6a4a2a'); poly(g, [[w / 2 + 6, 10], [w / 2 + 80, 40], [w / 2 + 6, 70]], 'rgba(240,230,200,0.8)'); } },
  ruin_pillar: { w: 80, h: 220, draw: (g, w, h) => { poly(g, [[10, h], [12, 30], [30, 20], [44, 34], [70, 24], [70, h]], vgrad(g, 0, h, '#d8e8e0', '#8aa8a0')); for (let x = 20; x < 66; x += 12) rect(g, x, 40, 4, h - 44, 'rgba(60,90,80,0.2)'); } },
  shell_big: { w: 90, h: 70, draw: (g, w, h) => { poly(g, [[6, h], [w / 2, 4], [w - 6, h]], vgrad(g, 0, h, '#ffe6f0', '#ffa8c8')); for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(200,90,130,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(14 + i * 16, h - 2); g.stroke(); } } },
  anchor: { w: 100, h: 140, draw: (g, w, h) => { g.strokeStyle = '#5a6a7a'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w / 2, h - 20); g.moveTo(20, h - 50); g.quadraticCurveTo(w / 2, h + 10, w - 20, h - 50); g.moveTo(26, 40); g.lineTo(w - 26, 40); g.stroke(); ellipse(g, w / 2, 14, 12, 12, '#5a6a7a'); } },
  // Castle
  castle_tower: { w: 160, h: 320, draw: (g, w, h) => { rect(g, 24, 80, w - 48, h - 80, vgrad(g, 80, h, '#e8e0f8', '#a898c8')); poly(g, [[14, 90], [w / 2, 0], [w - 14, 90]], vgrad(g, 0, 90, '#8a6ad8', '#5a3aa0')); rect(g, w / 2 - 16, 140, 32, 46, '#ffe680', 16); for (let y = 100; y < h; y += 26) for (let x = 30; x < w - 30; x += 34) rect(g, x + ((y / 26) % 2) * 14, y, 28, 2, 'rgba(80,60,120,0.2)'); } },
  banner: { w: 70, h: 160, draw: (g, w, h) => { rect(g, 4, 0, w - 8, 8, '#ffd23a', 3); poly(g, [[10, 8], [w - 10, 8], [w - 10, h - 10], [w / 2, h - 34], [10, h - 10]], vgrad(g, 0, h, '#d84a6a', '#8a1a3a')); star(g, w / 2, 50, 16, 7, '#ffd23a'); } },
  candelabra: { w: 90, h: 160, draw: (g, w, h) => { rect(g, w / 2 - 4, 50, 8, h - 60, '#c8a03a'); rect(g, 14, 50, w - 28, 8, '#c8a03a', 4); for (const x of [18, w / 2, w - 18]) { rect(g, x - 6, 24, 12, 28, '#fff8e0', 3); ellipse(g, x, 16, 6, 10, vgrad(g, 6, 26, '#fff6a0', '#ff8a2a')); } rect(g, w / 2 - 20, h - 12, 40, 12, '#c8a03a', 4); } },
  mirror: { w: 110, h: 190, draw: (g, w, h) => { ellipse(g, w / 2, h / 2, w / 2 - 4, h / 2 - 4, vgrad(g, 0, h, '#ffd23a', '#a8781a')); ellipse(g, w / 2, h / 2, w / 2 - 16, h / 2 - 16, vgrad(g, 0, h, '#e8f4ff', '#9ab8d8')); poly(g, [[34, 50], [50, 40], [30, 100]], 'rgba(255,255,255,0.7)'); } },
  bookshelf: { w: 160, h: 200, draw: (g, w, h) => { rect(g, 4, 4, w - 8, h - 8, vgrad(g, 0, h, '#9a6a44', '#6a4224'), 6); const cols = ['#d84a4a', '#4a8ad8', '#4ab06a', '#ffd23a', '#a86ad8']; for (let row = 0; row < 3; row++) { rect(g, 12, 16 + row * 62, w - 24, 52, '#4a2a14'); for (let x = 16; x < w - 24; x += 14) rect(g, x, 22 + row * 62 + (x % 3) * 3, 11, 46 - (x % 3) * 3, cols[(x + row) % cols.length], 2); } } },
  castle_window: { w: 100, h: 160, draw: (g, w, h) => { rect(g, 6, 30, w - 12, h - 36, vgrad(g, 0, h, '#2a2a5a', '#4a3a8a'), 0); ellipse(g, w / 2, 34, w / 2 - 6, 30, '#2a2a5a'); rect(g, w / 2 - 3, 10, 6, h - 16, '#c8b8e8'); rect(g, 6, h / 2, w - 12, 6, '#c8b8e8'); star(g, 30, 50, 6, 3, '#fff6a0'); } },
  // Dark world
  twisted_tree: { w: 160, h: 240, draw: (g, w, h) => { g.strokeStyle = '#2a1a3a'; g.lineCap = 'round'; for (const [x2, y2, wd] of [[w / 2, 60, 22], [30, 40, 10], [130, 30, 10], [110, 100, 8], [40, 110, 8]]) { g.lineWidth = wd; g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + 20, h / 2, x2, y2); g.stroke(); } ellipse(g, 30, 40, 8, 8, '#ff3aa0'); ellipse(g, 130, 30, 6, 6, '#a03aff'); } },
  crystal: { w: 110, h: 180, draw: (g, w, h) => { for (const [x, ht, wd, c] of [[50, 170, 30, '#9a5aff'], [24, 110, 20, '#c88aff'], [80, 130, 22, '#6a3ad8']] as [number, number, number, string][]) poly(g, [[x - wd, h], [x - wd * 0.7, h - ht * 0.8], [x, h - ht], [x + wd * 0.7, h - ht * 0.8], [x + wd, h]], vgrad(g, h - ht, h, shade(c, 0.4), shade(c, -0.3))); } },
  broken_house: { w: 220, h: 200, draw: (g, w, h) => { poly(g, [[24, h], [24, 90], [80, 60], [120, 100], [150, 70], [196, 96], [196, h]], vgrad(g, 60, h, '#4a3a5a', '#2a1a3a')); poly(g, [[10, 98], [w / 2 - 20, 20], [w / 2 + 30, 60], [100, 90]], '#3a1a2a'); rect(g, w / 2 - 18, h - 60, 36, 60, '#140a1a', 14); rect(g, 50, 120, 30, 26, '#a03aff', 4); } },
  dark_lamp: { w: 50, h: 170, draw: (g, w, h) => { rect(g, w / 2 - 4, 40, 8, h - 40, '#1a1a2a'); ellipse(g, w / 2, 34, 16, 20, vgrad(g, 10, 56, '#e0a0ff', '#7a2ad8')); } },
  // Temple
  star_pillar: { w: 90, h: 300, draw: (g, w, h) => { rect(g, 18, 40, w - 36, h - 60, vgrad(g, 0, h, '#fffbe8', '#e0d0a0')); rect(g, 8, 20, w - 16, 26, '#ffd23a', 4); rect(g, 8, h - 26, w - 16, 26, '#ffd23a', 4); star(g, w / 2, 14, 16, 7, '#fff6a0'); for (let x = 26; x < w - 24; x += 10) rect(g, x, 50, 3, h - 80, 'rgba(180,150,80,0.25)'); } },
  star_altar: { w: 200, h: 150, draw: (g, w, h) => { poly(g, [[10, h], [30, 70], [w - 30, 70], [w - 10, h]], vgrad(g, 70, h, '#fffbe8', '#d0c090')); rect(g, 20, 56, w - 40, 18, '#ffd23a', 6); star(g, w / 2, 36, 28, 12, vgrad(g, 0, 70, '#fffbe0', '#ffc83a')); } },
  gold_arch: { w: 300, h: 300, draw: (g, w, h) => { g.strokeStyle = vgrad(g, 0, h, '#ffe88a', '#c8962a') as any; g.lineWidth = 36; g.beginPath(); g.moveTo(40, h); g.lineTo(40, 140); g.arc(w / 2, 140, w / 2 - 40, Math.PI, 0); g.lineTo(w - 40, h); g.stroke(); star(g, w / 2, 26, 20, 9, '#fff6a0'); } },
  star_lamp: { w: 60, h: 180, draw: (g, w, h) => { rect(g, w / 2 - 4, 50, 8, h - 50, '#c8962a'); star(g, w / 2, 34, 26, 11, vgrad(g, 0, 60, '#fffbe0', '#ffc83a')); } },
};

/* ---------------- Interactive objects ---------------- */

export const OBJECTS: Record<string, PropSpec> = {
  // partner-ability obstacles
  ab_food_wall: { w: 110, h: 110, draw: (g, w, h) => { rect(g, 6, 10, w - 12, h - 14, vgrad(g, 0, h, '#f6c878', '#c88a3a'), 26); ellipse(g, w / 2, 22, w / 2 - 10, 16, '#fbe0a8'); for (let i = 0; i < 7; i++) ellipse(g, 20 + (i * 29) % 72, 40 + (i * 23) % 56, 4, 3, '#a0602a'); } },
  ab_paint_wall: { w: 110, h: 110, draw: (g, w, h) => { g.setLineDash([10, 8]); g.lineWidth = 5; g.strokeStyle = '#8a8a98'; g.fillStyle = 'rgba(200,200,210,0.55)'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 12, 8); g.fill(); g.stroke(); g.setLineDash([]); } },
  ab_paint_bridge: { w: 420, h: 150, draw: (g, w, h) => { g.setLineDash([16, 10]); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.roundRect(10, 30, w - 20, h - 60, 16); g.stroke(); for (let x = 50; x < w - 30; x += 50) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x, h - 34); g.stroke(); } g.setLineDash([]); } },
  ab_bear: { w: 190, h: 230, draw: (g, w, h) => { const c = vgrad(g, 0, h, '#ff9ad0', '#e0408a'); ellipse(g, w / 2, h - 70, 80, 70, c); ellipse(g, w / 2, 70, 60, 54, c); ellipse(g, 46, 26, 22, 22, c); ellipse(g, w - 46, 26, 22, 22, c); ellipse(g, w / 2, 86, 26, 18, '#ffd0ea'); ellipse(g, 74, 62, 7, 9, '#2a1a0a'); ellipse(g, w - 74, 62, 7, 9, '#2a1a0a'); ellipse(g, w / 2, 80, 8, 6, '#2a1a0a'); ellipse(g, 40, h - 30, 30, 22, c); ellipse(g, w - 40, h - 30, 30, 22, c); ellipse(g, 60, 70, 3, 3, '#fff'); } },
  ab_spot: { w: 90, h: 60, draw: (g, w, h) => { ellipse(g, w / 2, h / 2, w / 2 - 4, h / 2 - 6, 'rgba(160,220,255,0.45)'); star(g, w / 2, h / 2, 16, 7, '#ffffff'); } },
  vent: { w: 110, h: 50, draw: (g, w, h) => { ellipse(g, w / 2, h / 2, w / 2 - 4, h / 2 - 4, vgrad(g, 0, h, '#6a8a9a', '#3a5a6a')); ellipse(g, w / 2, h / 2, w / 2 - 22, h / 2 - 12, '#1a2a3a'); for (let i = 0; i < 4; i++) ellipse(g, 34 + i * 14, h / 2 - 2, 4, 4, 'rgba(200,240,255,0.9)'); } },
  chest: { w: 90, h: 76, draw: (g, w, h) => { rect(g, 4, 30, w - 8, h - 34, vgrad(g, 30, h, '#d88a3a', '#a0561a'), 6); ellipse(g, w / 2, 32, w / 2 - 4, 26, vgrad(g, 6, 40, '#f0a84a', '#c8702a')); rect(g, 4, 30, w - 8, 8, '#ffd23a'); rect(g, w / 2 - 8, 34, 16, 18, '#ffd23a', 3); } },
  chest_open: { w: 90, h: 86, draw: (g, w, h) => { poly(g, [[8, 40], [w - 8, 40], [w - 16, 6], [16, 6]], vgrad(g, 6, 40, '#f0a84a', '#c8702a')); rect(g, 4, 40, w - 8, h - 44, vgrad(g, 40, h, '#d88a3a', '#a0561a'), 6); rect(g, 12, 40, w - 24, 10, '#4a2a10'); ellipse(g, w / 2, 40, 26, 8, 'rgba(255,240,150,0.85)'); } },
  save_block: { w: 90, h: 100, draw: (g, w, h) => { rect(g, 6, 6, w - 12, w - 12, vgrad(g, 0, w, '#ff9ad6', '#c84a9a'), 12); g.fillStyle = '#fff'; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.fillText('S', w / 2, w / 2 + 18); star(g, w - 16, 16, 9, 4, '#fff6a0'); } },
  switch_off: { w: 70, h: 80, draw: (g, w, h) => { rect(g, 8, h - 24, w - 16, 20, '#6a6a78', 6); ellipse(g, w / 2, h - 30, 22, 16, vgrad(g, h - 46, h - 14, '#ff6a6a', '#c82a2a')); } },
  switch_on: { w: 70, h: 80, draw: (g, w, h) => { rect(g, 8, h - 24, w - 16, 20, '#6a6a78', 6); ellipse(g, w / 2, h - 24, 22, 8, vgrad(g, h - 32, h - 16, '#6aff8a', '#2ac84a')); } },
  gate: { w: 120, h: 230, draw: (g, w, h) => { rect(g, 4, 0, 18, h, '#6a4a3a', 4); rect(g, w - 22, 0, 18, h, '#6a4a3a', 4); for (let x = 30; x < w - 24; x += 18) rect(g, x, 10, 8, h - 20, vgrad(g, 0, h, '#a8a8b8', '#5a5a6a'), 3); rect(g, 4, 40, w - 8, 12, '#5a5a6a', 3); rect(g, 4, h - 60, w - 8, 12, '#5a5a6a', 3); ellipse(g, w / 2, h / 2, 16, 18, '#ffd23a'); rect(g, w / 2 - 3, h / 2 - 2, 6, 12, '#5a3a1a'); } },
  breakable: { w: 90, h: 90, draw: (g, w, h) => { rect(g, 4, 4, w - 8, h - 8, vgrad(g, 0, h, '#e8c890', '#b08a50'), 8); g.strokeStyle = '#6a4a20'; g.lineWidth = 4; g.beginPath(); g.moveTo(20, 10); g.lineTo(40, 40); g.lineTo(30, 60); g.lineTo(48, 80); g.moveTo(40, 40); g.lineTo(70, 34); g.stroke(); } },
  shard: { w: 80, h: 100, draw: (g, w, h) => { ellipse(g, w / 2, h / 2, 36, 36, 'rgba(255,250,180,0.5)'); poly(g, [[w / 2, 6], [w - 14, 40], [w / 2 + 6, h - 6], [16, h - 30], [18, 30]], vgrad(g, 0, h, '#fffbe0', '#ff6ab0')); poly(g, [[w / 2, 14], [w / 2 + 10, 40], [w / 2 - 6, 60]], 'rgba(255,255,255,0.8)'); } },
  door: { w: 110, h: 190, draw: (g, w, h) => { rect(g, 4, 30, w - 8, h - 30, vgrad(g, 0, h, '#c8b8e8', '#8a78b8'), 6); ellipse(g, w / 2, 34, w / 2 - 4, 30, '#c8b8e8'); rect(g, 18, 40, w - 36, h - 44, vgrad(g, 30, h, '#5a3a8a', '#2a1a4a'), 0); ellipse(g, w / 2, 42, w / 2 - 18, 24, '#5a3a8a'); ellipse(g, w - 30, h / 2 + 20, 5, 5, '#ffd23a'); } },
  spring: { w: 80, h: 70, draw: (g, w, h) => { g.strokeStyle = '#8a8a98'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i < 5; i++) { g.moveTo(14, h - 8 - i * 9); g.lineTo(w - 14, h - 12 - i * 9); } g.stroke(); rect(g, 6, 4, w - 12, 14, vgrad(g, 4, 18, '#ff8a6a', '#d84a2a'), 6); } },
  heal_pad: { w: 120, h: 50, draw: (g, w, h) => { ellipse(g, w / 2, h / 2, w / 2 - 4, h / 2 - 4, vgrad(g, 0, h, '#aaffd0', '#3ac87a')); g.fillStyle = '#fff'; g.fillRect(w / 2 - 14, h / 2 - 4, 28, 8); g.fillRect(w / 2 - 4, h / 2 - 12, 8, 24); } },
  sign: { w: 110, h: 120, draw: (g, w, h) => { rect(g, w / 2 - 6, 50, 12, h - 50, '#8a5a34'); rect(g, 6, 8, w - 12, 56, vgrad(g, 8, 64, '#f6dcaa', '#c49a60'), 8); for (let i = 0; i < 3; i++) rect(g, 18, 22 + i * 12, w - 36 - i * 10, 4, 'rgba(90,60,30,0.5)'); } },
};

/* ---------------- Platforms ---------------- */

export function platformTexture(look: string): HTMLCanvasElement {
  const w = 200, h = 70;
  const cols: Record<string, [string, string]> = {
    plank: ['#e8b878', '#a0703a'], cloud: ['#ffffff', '#c8d8f0'], gear: ['#d8d8e0', '#7a7a88'],
    lily: ['#8ae07a', '#3a9a4a'], crystal: ['#c88aff', '#6a3ad8'], star: ['#fffbe0', '#e0b83a'],
    candy: ['#ffb0dc', '#e0409a'], stone: ['#c8c2b8', '#7a7468'],
  };
  const [a, b] = cols[look] ?? cols.plank;
  return paperCut(w, h, (g) => {
    rect(g, 6, 22, w - 12, h - 26, b, 18);
    ellipse(g, w / 2, 26, w / 2 - 6, 22, vgrad(g, 4, 48, shade(a, 0.2), a));
    if (look === 'plank') for (let x = 30; x < w - 20; x += 34) rect(g, x, 10, 4, 34, 'rgba(120,70,30,0.35)');
    if (look === 'gear') for (let i = 0; i < 10; i++) rect(g, 14 + i * 18, 16, 8, 20, 'rgba(60,60,70,0.25)', 2);
    if (look === 'star') star(g, w / 2, 26, 14, 6, '#ffd23a');
  }, 3);
}

/* ---------------- Backgrounds ---------------- */

/** Periodic ridge line (tiles horizontally over width). */
function ridge(w: number, base: number, amp: number, seed: number): (x: number) => number {
  const rnd = makeRng(seed);
  const waves = [1, 2, 3, 5, 8].map((f) => ({ f, a: rnd() * amp / f ** 0.6, p: rnd() * Math.PI * 2 }));
  return (x) => base - waves.reduce((s, wv) => s + Math.sin((x / w) * Math.PI * 2 * wv.f + wv.p) * wv.a, 0);
}

export function skyTexture(t: ThemeDef): HTMLCanvasElement {
  const [c, g] = canvas(1280, 720);
  g.fillStyle = vgrad(g, 0, 720, hex(t.skyTop), hex(t.skyBottom));
  g.fillRect(0, 0, 1280, 720);
  const rnd = makeRng(t.id.length * 31);
  if (t.sun === 'sun') {
    const rg = g.createRadialGradient(1020, 140, 10, 1020, 140, 220);
    rg.addColorStop(0, 'rgba(255,250,210,0.95)');
    rg.addColorStop(0.25, 'rgba(255,240,170,0.5)');
    rg.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = rg;
    g.fillRect(780, 0, 500, 400);
    ellipse(g, 1020, 140, 54, 54, '#fff6c8');
  } else if (t.sun === 'moon' || t.sun === 'star') {
    for (let i = 0; i < 140; i++) {
      g.globalAlpha = 0.3 + rnd() * 0.7;
      ellipse(g, rnd() * 1280, rnd() * 420, rnd() * 1.8 + 0.4, rnd() * 1.8 + 0.4, '#ffffff');
    }
    g.globalAlpha = 1;
    if (t.sun === 'moon') {
      ellipse(g, 1000, 130, 50, 50, '#fffbe6');
      ellipse(g, 1020, 118, 44, 44, hex(t.skyTop));
    } else {
      star(g, 1000, 140, 50, 22, '#fff6c0');
    }
  } else if (t.sun === 'eye') {
    const rg = g.createRadialGradient(980, 150, 4, 980, 150, 160);
    rg.addColorStop(0, 'rgba(255,60,200,0.6)');
    rg.addColorStop(1, 'rgba(255,60,200,0)');
    g.fillStyle = rg;
    g.fillRect(800, 0, 400, 340);
    ellipse(g, 980, 150, 60, 30, '#2a0a3a');
    ellipse(g, 980, 150, 20, 20, '#ff3aa0');
  }
  if (t.underwater) {
    for (let i = 0; i < 9; i++) {
      g.save();
      g.globalAlpha = 0.08;
      g.translate(140 * i + 40, 0);
      g.rotate(0.25);
      rect(g, 0, -40, 50 + rnd() * 40, 800, '#ffffff');
      g.restore();
    }
  }
  return c;
}

export function layerTexture(t: ThemeDef, which: 'far' | 'mid'): HTMLCanvasElement {
  const W = 1280, H = which === 'far' ? 360 : 300;
  const [c, g] = canvas(W, H);
  const col = which === 'far' ? hex(t.far) : hex(t.mid);
  const acc = which === 'far' ? hex(t.farAccent) : hex(t.midAccent);
  const shape = which === 'far' ? t.farShape : t.midShape;
  const rnd = makeRng((which === 'far' ? 7 : 13) + t.id.charCodeAt(0));
  const layerPaper = (fn: (g2: Ctx) => void, edge = 5) => {
    const [tmp, t2] = canvas(W, H);
    fn(t2);
    const [sil, s] = canvas(W, H);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; s.drawImage(tmp, Math.cos(a) * edge, Math.sin(a) * edge); }
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = 'rgba(255,253,246,0.9)';
    s.fillRect(0, 0, W, H);
    g.save();
    g.filter = 'blur(4px)';
    g.globalAlpha = 0.25;
    g.drawImage(sil, 0, 8);
    g.restore();
    g.drawImage(sil, 0, 0);
    g.drawImage(tmp, 0, 0);
  };
  const fillRidge = (g2: Ctx, f: (x: number) => number, fill: string | CanvasGradient) => {
    g2.fillStyle = fill;
    g2.beginPath();
    g2.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g2.lineTo(x, f(x));
    g2.lineTo(W, H);
    g2.closePath();
    g2.fill();
  };
  switch (shape) {
    case 'mountains': {
      layerPaper((g2) => {
        g2.fillStyle = vgrad(g2, 40, H, shade(col, 0.15), shade(col, -0.15));
        g2.beginPath();
        g2.moveTo(0, H);
        const n = 7;
        for (let i = 0; i <= n; i++) {
          const x = (i / n) * W;
          g2.lineTo(x - W / n / 2, 90 + rnd() * 120);
          g2.lineTo(x, H * 0.75);
        }
        g2.lineTo(W, H);
        g2.fill();
        for (let i = 0; i < n; i++) {
          const x = (i / n) * W + W / n / 2;
          poly(g2, [[x - 40, 150], [x, 100], [x + 40, 150]], 'rgba(255,255,255,0.65)');
        }
      });
      break;
    }
    case 'hills':
    case 'reef':
    case 'clouds': {
      layerPaper((g2) => fillRidge(g2, ridge(W, H * 0.45, 70, rnd() * 1000), vgrad(g2, 60, H, shade(col, 0.15), shade(col, -0.12))));
      if (shape === 'clouds') for (let i = 0; i < 6; i++) layerPaper((g2) => { const x = rnd() * W, y = 60 + rnd() * 120; for (const [dx, r] of [[-40, 30], [0, 44], [40, 30]]) ellipse(g2, x + dx, y, r, r * 0.8, '#ffffff'); }, 3);
      if (shape === 'reef') for (let i = 0; i < 10; i++) layerPaper((g2) => { const x = rnd() * W; rect(g2, x, H * 0.35 + rnd() * 40, 12, 200, acc, 6); }, 3);
      break;
    }
    case 'chimneys': {
      layerPaper((g2) => {
        for (let x = 0; x < W; x += 160) {
          const hh = 140 + rnd() * 120;
          rect(g2, x + 10, H - hh, 130, hh, vgrad(g2, H - hh, H, shade(col, 0.1), shade(col, -0.2)));
          rect(g2, x + 30 + rnd() * 60, H - hh - 70, 26, 80, col);
          poly(g2, [[x + 10, H - hh], [x + 52, H - hh - 30], [x + 94, H - hh], [x + 136, H - hh - 30], [x + 140, H - hh]], shade(col, 0.15));
        }
      });
      break;
    }
    case 'castle': {
      layerPaper((g2) => {
        fillRidge(g2, ridge(W, H * 0.7, 30, 3), shade(col, -0.1));
        for (let x = 80; x < W; x += 300) {
          rect(g2, x, H * 0.25, 90, H, vgrad(g2, 0, H, shade(col, 0.2), col));
          poly(g2, [[x - 10, H * 0.25 + 4], [x + 45, H * 0.05], [x + 100, H * 0.25 + 4]], acc);
          rect(g2, x + 120, H * 0.45, 140, H, col);
          for (let k = 0; k < 5; k++) rect(g2, x + 120 + k * 30, H * 0.45 - 14, 18, 16, col);
        }
      });
      break;
    }
    case 'spikes': {
      layerPaper((g2) => {
        g2.fillStyle = vgrad(g2, 0, H, shade(col, 0.1), shade(col, -0.2));
        g2.beginPath();
        g2.moveTo(0, H);
        for (let x = 0; x <= W; x += 40) g2.lineTo(x + 20, H * 0.3 + rnd() * H * 0.4), g2.lineTo(x + 40, H * 0.8);
        g2.lineTo(W, H);
        g2.fill();
      });
      break;
    }
    case 'pillars': {
      layerPaper((g2) => {
        fillRidge(g2, ridge(W, H * 0.75, 20, 5), shade(col, -0.05));
        for (let x = 40; x < W; x += 180) {
          rect(g2, x, H * 0.2, 46, H, vgrad(g2, 0, H, shade(col, 0.3), col));
          star(g2, x + 23, H * 0.2 - 10, 18, 8, acc);
        }
      });
      break;
    }
    // mid-layer shapes
    case 'trees': {
      layerPaper((g2) => fillRidge(g2, ridge(W, H * 0.62, 30, 11), vgrad(g2, 80, H, shade(col, 0.1), shade(col, -0.15))));
      layerPaper((g2) => { for (let x = 30; x < W; x += 90 + rnd() * 60) canopy(g2, x, H * 0.45 + rnd() * 30, 36 + rnd() * 18, col); }, 4);
      break;
    }
    case 'candy': {
      layerPaper((g2) => fillRidge(g2, ridge(W, H * 0.6, 40, 17), vgrad(g2, 80, H, shade(col, 0.2), col)));
      layerPaper((g2) => { for (let x = 40; x < W; x += 110 + rnd() * 50) { rect(g2, x - 3, H * 0.4, 6, H, '#ffffff'); ellipse(g2, x, H * 0.38, 30, 30, rnd() < 0.5 ? acc : '#7ad8ff'); } }, 4);
      break;
    }
    case 'gears': {
      layerPaper((g2) => fillRidge(g2, ridge(W, H * 0.7, 20, 21), col));
      layerPaper((g2) => {
        for (let x = 60; x < W; x += 200) {
          const r = 50 + rnd() * 30, cy = H * 0.45;
          const pts: number[][] = [];
          for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push([x + Math.cos(a) * (i % 2 ? r : r + 12), cy + Math.sin(a) * (i % 2 ? r : r + 12)]); }
          poly(g2, pts, acc);
          ellipse(g2, x, cy, r * 0.35, r * 0.35, col);
        }
      }, 4);
      break;
    }
    case 'kelp': {
      layerPaper((g2) => fillRidge(g2, ridge(W, H * 0.72, 24, 31), col));
      layerPaper((g2) => { g2.strokeStyle = acc; g2.lineCap = 'round'; for (let x = 20; x < W; x += 50 + rnd() * 40) { g2.lineWidth = 10; g2.beginPath(); for (let y = H; y > H * 0.2 + rnd() * 60; y -= 10) g2.lineTo(x + Math.sin(y / 24 + x) * 10, y); g2.stroke(); } }, 3);
      break;
    }
    case 'towers': {
      layerPaper((g2) => { fillRidge(g2, ridge(W, H * 0.7, 20, 41), col); for (let x = 50; x < W; x += 150) { rect(g2, x, H * 0.3 + rnd() * 40, 50, H, shade(col, 0.1)); poly(g2, [[x - 6, H * 0.32], [x + 25, H * 0.12], [x + 56, H * 0.32]], acc); } });
      break;
    }
    case 'crystals': {
      layerPaper((g2) => { fillRidge(g2, ridge(W, H * 0.72, 30, 51), col); for (let x = 30; x < W; x += 70 + rnd() * 50) { const ht = 60 + rnd() * 120; poly(g2, [[x - 16, H], [x - 10, H - ht * 0.8], [x, H - ht], [x + 10, H - ht * 0.8], [x + 16, H]], acc); } });
      break;
    }
    case 'stars': {
      layerPaper((g2) => { fillRidge(g2, ridge(W, H * 0.72, 20, 61), col); for (let x = 50; x < W; x += 140) { rect(g2, x, H * 0.35, 30, H, shade(col, 0.25)); star(g2, x + 15, H * 0.33, 22, 10, acc); } });
      break;
    }
  }
  return c;
}

export function groundTexture(t: ThemeDef): HTMLCanvasElement {
  const W = 512, H = 260;
  const [c, g] = canvas(W, H);
  const col = hex(t.ground), acc = hex(t.groundAccent);
  g.fillStyle = vgrad(g, 0, H, shade(col, 0.08), shade(col, -0.12));
  g.fillRect(0, 0, W, H);
  const rnd = makeRng(t.id.charCodeAt(1) * 3);
  switch (t.groundPattern) {
    case 'grass':
      for (let i = 0; i < 90; i++) { const x = rnd() * W, y = rnd() * H; g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x, y, 10 + rnd() * 16, 3, 0, 0, Math.PI * 2); g.fill(); }
      for (let i = 0; i < 160; i++) { const x = rnd() * W, y = rnd() * H; g.strokeStyle = acc; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x + 3, y); g.lineTo(x + 5, y - 7); g.stroke(); }
      break;
    case 'candy':
      for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 64) if (((x / 64) + (y / 40)) % 2 === 0) rect(g, x, y, 64, 40, 'rgba(255,255,255,0.22)');
      for (let i = 0; i < 70; i++) rect(g, rnd() * W, rnd() * H, 8, 3, ['#ff3a6a', '#3ad0ff', '#ffe03a', '#6aff8a'][i % 4], 2);
      break;
    case 'cloud':
      for (let i = 0; i < 40; i++) ellipse(g, rnd() * W, rnd() * H, 30 + rnd() * 40, 12 + rnd() * 10, 'rgba(255,255,255,0.4)');
      break;
    case 'metal':
      for (let y = 0; y < H; y += 52) for (let x = 0; x < W; x += 128) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, 124, 48); for (const [dx, dy] of [[8, 8], [118, 8], [8, 42], [118, 42]]) ellipse(g, x + dx, y + dy, 3, 3, acc); }
      break;
    case 'sand':
      for (let y = 10; y < H; y += 18) { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin((x / W) * Math.PI * 4 + y) * 4); g.stroke(); }
      for (let i = 0; i < 30; i++) ellipse(g, rnd() * W, rnd() * H, 4, 3, acc);
      break;
    case 'stone':
      for (let y = 0; y < H; y += 44) for (let x = -(y % 88) / 2; x < W; x += 88) { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, 84, 40); }
      break;
    case 'void':
      for (let i = 0; i < 22; i++) { g.strokeStyle = acc; g.lineWidth = 2; g.beginPath(); let x = rnd() * W, y = rnd() * H; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd() * 40 - 20; y += rnd() * 20 - 10; g.lineTo(x, y); } g.stroke(); }
      break;
    case 'marble':
      for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) { rect(g, x + 1, y + 1, 62, 62, ((x + y) / 64) % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(200,170,90,0.12)'); }
      for (let i = 0; i < 18; i++) star(g, rnd() * W, rnd() * H, 5, 2, acc);
      break;
  }
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = g.createPattern(grainCanvas(), 'repeat')!;
  g.fillRect(0, 0, W, H);
  return c;
}

/** The lip at the back edge of the ground (grass fringe, frosting, etc.) */
export function groundEdgeTexture(t: ThemeDef): HTMLCanvasElement {
  const W = 512, H = 40;
  const [c, g] = canvas(W, H);
  const col = hex(t.groundEdge);
  g.fillStyle = vgrad(g, 0, H, shade(col, 0.2), shade(col, -0.1));
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, 14 + Math.sin((x / W) * Math.PI * 8) * 6 + (x % 32 ? 4 : -2));
  g.lineTo(W, H);
  g.fill();
  rect(g, 0, H - 6, W, 6, 'rgba(255,253,246,0.85)');
  return c;
}

/** The torn front edge of the paper floor. */
export function frontEdgeTexture(t: ThemeDef): HTMLCanvasElement {
  const W = 512, H = 50;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#fffdf6';
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x <= W; x += 12) g.lineTo(x, 8 + Math.sin(x * 0.7) * 3 + ((x * 7) % 5));
  g.lineTo(W, 0);
  g.fill();
  g.fillStyle = vgrad(g, 8, H, shade(hex(t.ground), -0.35), shade(hex(t.ground), -0.55));
  g.beginPath();
  g.moveTo(0, 10);
  for (let x = 0; x <= W; x += 12) g.lineTo(x, 10 + Math.sin(x * 0.7) * 3 + ((x * 7) % 5));
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();
  return c;
}

export function vignetteTexture(): HTMLCanvasElement {
  const [c, g] = canvas(1280, 720);
  const rg = g.createRadialGradient(640, 380, 260, 640, 380, 820);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(30,15,5,0.55)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 1280, 720);
  return c;
}

export function lightRaysTexture(): HTMLCanvasElement {
  const [c, g] = canvas(1280, 720);
  for (let i = 0; i < 6; i++) {
    g.save();
    g.translate(900 + i * 60, -40);
    g.rotate(0.5 + i * 0.05);
    const gr = g.createLinearGradient(0, 0, 0, 900);
    gr.addColorStop(0, 'rgba(255,250,220,0.22)');
    gr.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = gr;
    g.fillRect(-30 - i * 6, 0, 60 + i * 12, 900);
    g.restore();
  }
  return c;
}

export function softCircle(r: number, color: string): HTMLCanvasElement {
  const [c, g] = canvas(r * 2, r * 2);
  const rg = g.createRadialGradient(r, r, 0, r, r, r);
  rg.addColorStop(0, color);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, r * 2, r * 2);
  return c;
}
