/**
 * Tamagotchi characters, designed after the official character sheet (big round head on a tiny body,
 * the real ears / hair / masks of each character) but drawn as MS Paint mouse doodles — hand-drawn
 * skill style #5: shaky broken lines, lopsided shapes, rough fills that spill past the outline,
 * spray-can blush, pixel jaggies, no gradients. Every frame is a 128x128 paper cut-out.
 */
import type { CharId, Expr, NpcLook, Species } from '../data/types';
import { Doodle } from './paint';
import { hashString } from '../core/util';

export type Facing = 'front' | 'side' | 'back';

export interface Pose {
  facing: Facing;
  expr: Expr;
  bob: number;
  sx: number;
  sy: number;
  footL: number;
  footR: number;
  liftL: number;
  liftR: number;
  armL: number; // radians, 0 = hanging down
  armR: number;
  hammer: number | null; // radians of hammer swing (side only)
  lean: number;
  blink: boolean;
  flat: boolean;
  dizzy: boolean;
  mouthOpen: boolean;
}

export const basePose = (p: Partial<Pose> = {}): Pose => ({
  facing: 'front', expr: 'normal', bob: 0, sx: 1, sy: 1, footL: 0, footR: 0, liftL: 0, liftR: 0,
  armL: 0.3, armR: -0.3, hammer: null, lean: 0, blink: false, flat: false, dizzy: false, mouthOpen: false, ...p,
});

type P = [number, number];

const LW = 3.2;
const CHUBBY = 1.08;
const CHEEK = '#ff9fc0';
const MOUTH = '#c8323e';
const TONGUE = '#ff8a9a';

/* ---------------- Drawing kit (everything goes through the MS Paint doodle pen) ---------------- */

interface Geo {
  d: Doodle;
  c: CanvasRenderingContext2D;
  cx: number; // body centre x
  hx: number; // head centre x
  hy: number; // head centre y
  by: number; // body centre y
  fx: number; // face centre x
  ey: number; // eye line y
  dir: number;
  side: boolean;
  back: boolean;
  pose: Pose;
  spec: Spec;
  dark: boolean;
  ink: string;
  col: (c: string) => string;
  /** the head outline for this frame (wobbled once, reused for fill, clip and re-stroke) */
  head: P[];
}

interface Spec {
  head: string;
  body?: string;
  feet?: string;
  limb?: string;
  hrx: number;
  hry: number;
  /** head centre y when standing (default 62) */
  headY?: number;
  /** custom head silhouette relative to head centre (smoothed) */
  headPts?: P[];
  /** no separate body: the head is the whole character */
  bodyless?: boolean;
  noFeet?: boolean;
  bodyW?: number;
  eyes?: 'dot' | 'big' | 'closed';
  eyeY?: number;
  eyeGap?: number;
  eyeScale?: number;
  eyeCol?: string;
  cheek?: string | false;
  mouth?: 'smile' | 'open' | 'none';
  mouthY?: number;
  noEyes?: boolean;
  size?: number;
  behind?: (g: Geo) => void;
  over?: (g: Geo) => void;
  /** drawn after the default face (custom eyes / mouths / glasses) */
  faceOver?: (g: Geo) => void;
}

const DARKS: Record<string, string> = {};
function darken(c: string): string {
  if (DARKS[c]) return DARKS[c];
  const n = parseInt(c.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v: number, t: number) => Math.round(v * 0.28 + t * 0.72);
  const out = '#' + [m(r, 28), m(g, 8), m(b, 48)].map((v) => v.toString(16).padStart(2, '0')).join('');
  DARKS[c] = out;
  return out;
}

/** How far a fill may slop past its outline: big shapes spill a lot, tiny ones barely. */
const spillFor = (r: number) => (r < 6 ? 0 : Math.min(2.5, r * 0.12));

/** Fill + shaky closed outline for a ready-made point list. */
function paintPts(g: Geo, pts: P[], fill: string | null, w = LW, r = 20): void {
  if (fill) g.d.fill(pts, g.col(fill), spillFor(r));
  if (w > 0) g.d.line(pts, w, g.ink, { closed: true });
}

function ell(g: Geo, x: number, y: number, rx: number, ry: number, fill: string | null, w = LW, rot = 0): void {
  const small = Math.min(rx, ry) < 7;
  let pts = g.d.wobbleEllipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), small ? 0.05 : 0.08, small ? 18 : 36);
  if (rot) {
    const co = Math.cos(rot), si = Math.sin(rot);
    pts = pts.map(([px, py]) => [x + (px - x) * co - (py - y) * si, y + (px - x) * si + (py - y) * co]);
  }
  paintPts(g, pts, fill, w, Math.min(rx, ry));
}

/** Samples the closed smooth curve through the points (quadratic through midpoints). */
function smoothPts(pts: P[], per = 6): P[] {
  const n = pts.length;
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = mid(pts[(i + n - 1) % n], pts[i]), q = pts[i], b = mid(pts[i], pts[(i + 1) % n]);
    for (let k = 0; k < per; k++) {
      const t = k / per, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * q[0] + t * t * b[0], u * u * a[1] + 2 * u * t * q[1] + t * t * b[1]]);
    }
  }
  return out;
}

function quadPts(x1: number, y1: number, qx: number, qy: number, x2: number, y2: number, n = 8): P[] {
  const out: P[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t;
    out.push([u * u * x1 + 2 * u * t * qx + t * t * x2, u * u * y1 + 2 * u * t * qy + t * t * y2]);
  }
  return out;
}

function extent(pts: P[]): number {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return Math.min(x1 - x0, y1 - y0) / 2;
}

function shape(g: Geo, pts: P[], fill: string | null, w = LW): void {
  paintPts(g, smoothPts(pts), fill, w, extent(pts));
}

function poly(g: Geo, pts: P[], fill: string | null, w = LW): void {
  paintPts(g, pts, fill, w, extent(pts));
}

function line(g: Geo, pts: P[], w = 2.6, color?: string): void {
  g.d.line(pts, w, color ?? g.ink);
}

function curve(g: Geo, x1: number, y1: number, qx: number, qy: number, x2: number, y2: number, w = 2.6, color?: string): void {
  g.d.line(quadPts(x1, y1, qx, qy, x2, y2), w, color ?? g.ink, { broken: 0 });
}

/** Rounded rectangle as a point list. */
function rrPts(x: number, y: number, w: number, h: number, r: number): P[] {
  const out: P[] = [];
  const corner = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= 4; k++) { const a = a0 + (k / 4) * (Math.PI / 2); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
}

function rr(g: Geo, x: number, y: number, w: number, h: number, r: number, fill: string | null, lw = LW): void {
  paintPts(g, rrPts(x, y, w, h, r), fill, lw, Math.min(w, h) / 2);
}

/** Stubby arm / handle: a fat black mouse stroke with the colour scribbled on top. */
function limb(g: Geo, x1: number, y1: number, x2: number, y2: number, color: string, w = 7.5): void {
  g.d.line([[x1, y1], [x2, y2]], w + LW * 2, g.ink, { broken: 0 });
  g.d.line([[x1, y1], [x2, y2]], w, g.col(color), { broken: 0 });
}

/** Points relative to the head centre; `s` mirrors x. Side view squeezes features toward the back. */
function H(g: Geo, pts: P[], s = 1, shift = 0): P[] {
  const k = g.side ? 0.86 : 1;
  const ox = g.hx + (g.side ? -g.dir * 3 : 0) + shift;
  return pts.map(([x, y]) => [ox + x * s * k, g.hy + y]);
}

function strokeHead(g: Geo): void {
  g.d.line(g.head, LW, g.ink, { closed: true });
}

/** Paints inside the head silhouette only. */
function clipHead(g: Geo, draw: () => void): void {
  const c = g.c;
  c.save();
  c.beginPath();
  c.moveTo(g.head[0][0], g.head[0][1]);
  for (const p of g.head.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.clip();
  draw();
  c.restore();
}

/** A flat region inside a clip: no outline, no spill. */
function region(g: Geo, pts: P[], fill: string): void {
  g.d.fill(pts, g.col(fill), 0);
}

function star(g: Geo, x: number, y: number, r: number, fill: string, w = 2.2): void {
  const pts: P[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = (i % 2 ? r * 0.45 : r) * g.d.r(0.85, 1.12);
    pts.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]);
  }
  poly(g, pts, fill, w);
}

/* ---------------- Faces ---------------- */

function eyePositions(g: Geo): [P, P] {
  const gap = (g.spec.eyeGap ?? 11) * (g.side ? 0.78 : 1);
  return [[g.fx - gap, g.ey], [g.fx + gap, g.ey]];
}

function drawEyes(g: Geo): void {
  const { pose, spec } = g;
  const ex = pose.expr;
  const style = spec.eyes ?? 'dot';
  const k = spec.eyeScale ?? 1;
  const big = style === 'big';
  const rx = (big ? 5.2 : 3.5) * k, ry = (big ? 7 : 4.5) * k;
  const eyeCol = g.dark ? '#ff2a3a' : spec.eyeCol ?? '#1b1b2a';
  eyePositions(g).forEach(([x, y], i) => {
    const s = i ? 1 : -1;
    const uneven = i ? 0.84 : 1; // the two eyes are never the same size
    if (pose.dizzy) {
      line(g, [[x - 4, y - 4], [x + 4, y + 4]]);
      line(g, [[x + 4, y - 4], [x - 4, y + 4]]);
    } else if (pose.blink || ex === 'sleepy') {
      curve(g, x - 4.5, y, x, y + 2.5, x + 4.5, y);
    } else if (ex === 'happy' || (style === 'closed' && (ex === 'normal' || ex === 'determined'))) {
      curve(g, x - 5, y + 2, x, y - 6, x + 5, y + 2, 2.8);
    } else if (ex === 'hurt') {
      line(g, [[x - 4 * s, y - 4], [x + 3 * s, y], [x - 4 * s, y + 4]], 2.8);
    } else if (ex === 'surprised') {
      ell(g, x, y, 5.5 * k, 6.5 * k, '#ffffff', 2.4);
      ell(g, x, y + 0.5, 2.1 * k, 2.4 * k, eyeCol, 0);
    } else {
      const look = ex === 'sad' ? 1.5 : 0;
      const yy = y + look + (i ? 1.5 : 0);
      if (big) ell(g, x, yy, rx * uneven, ry * uneven, eyeCol, 0);
      else g.d.dot(x, yy, (i ? 3.4 : 4.2) * k * (g.side ? 0.8 : 1), eyeCol); // the original game's dot eyes
      if (!g.dark) {
        g.c.fillStyle = '#ffffff';
        g.c.fillRect(Math.round(x - (big ? rx * 0.45 : 1)), Math.round(yy - (big ? ry * 0.5 : 2)), i ? 1 : big ? 3 : 2, i ? 1 : big ? 3 : 2);
      }
    }
  });
}

/** No eyebrows (Tamagotchi faces don't have them): anger shows as a red vein mark, worry as a sweat drop. */
function drawMood(g: Geo): void {
  const ex = g.pose.expr;
  if (ex === 'angry') {
    const x = g.hx + (g.side ? -g.dir * 14 : g.spec.hrx * 0.55), y = g.hy - g.spec.hry * 0.62;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as P[]) curve(g, x + dx * 2, y + dy * 6, x + dx * 2.5, y + dy * 2.5, x + dx * 6, y + dy * 2, 2.6, '#ff0000');
  } else if (ex === 'worried') {
    ell(g, g.hx + (g.side ? -g.dir * 12 : g.spec.hrx * 0.7), g.hy - g.spec.hry * 0.45, 2.6, 4, '#80ffff', 1.5);
  }
}

function drawCheeks(g: Geo): void {
  const col = g.spec.cheek ?? CHEEK;
  if (col === false || g.dark) return;
  const gap = (g.spec.eyeGap ?? 11) * (g.side ? 0.78 : 1) + 8.5;
  const y = g.ey + 7.5;
  const xs = g.side ? [g.fx + g.dir * gap] : [g.fx - gap, g.fx + gap];
  xs.forEach((x, i) => g.d.spray(x, y, i ? 4.5 : 5.5, col, i ? 24 : 30));
}

/** Open "D" mouth used by happy faces. */
function openMouth(g: Geo, x: number, y: number, w: number, h: number): void {
  const pts: P[] = [
    ...quadPts(x - w, y - h * 0.25, x, y - h * 0.45, x + w, y - h * 0.25, 6),
    ...quadPts(x + w, y - h * 0.25, x + w * 0.9, y + h, x, y + h, 6).slice(1),
    ...quadPts(x, y + h, x - w * 0.9, y + h, x - w, y - h * 0.25, 6).slice(1),
  ];
  g.d.fill(pts, g.col(MOUTH), 0.8);
  ell(g, x, y + h * 0.6, w * 0.5, h * 0.3, TONGUE, 0);
  g.d.line(pts, 2.4, g.ink, { closed: true });
}

function drawMouth(g: Geo): void {
  const { pose, spec } = g;
  const ex = pose.expr;
  const x = g.fx, y = g.ey + (spec.mouthY ?? 11);
  const style = spec.mouth ?? 'smile';
  if (style === 'none') return;
  if (pose.mouthOpen || ex === 'surprised') ell(g, x, y + 1, 3.6, 4.2, MOUTH, 2.4);
  else if (ex === 'hurt') ell(g, x, y + 1, 4.5, 3.4, MOUTH, 2.4);
  else if (ex === 'happy' || (style === 'open' && ex === 'normal')) openMouth(g, x, y, 6, 6.5);
  else if (ex === 'sad') curve(g, x - 5, y + 3, x, y - 3, x + 5, y + 3);
  else if (ex === 'angry') curve(g, x - 6, y + 3, x, y - 4, x + 6, y + 3, 2.8);
  else if (ex === 'worried') line(g, [[x - 5, y + 1], [x - 2, y - 1], [x + 2, y + 2], [x + 5, y]]);
  else if (ex === 'determined') line(g, [[x - 5, y + 1], [x + 5, y]], 2.8);
  else if (ex === 'sleepy') ell(g, x, y + 1, 2, 2.2, MOUTH, 2);
  else curve(g, x - 5, y - 1, x, y + 5, x + 5, y - 1);
}

function drawFace(g: Geo): void {
  if (g.back) return;
  if (!g.spec.noEyes) drawEyes(g);
  drawMood(g);
  drawCheeks(g);
  drawMouth(g);
  g.spec.faceOver?.(g);
}

/* ---------------- Reusable features ---------------- */

/** Rounded ear lobe behind the head (Mametchi / Mimitchi style). */
function lobeEars(pts: P[], color: string) {
  return (g: Geo) => { for (const s of [-1, 1]) shape(g, H(g, pts, s), color); };
}

/** Hair "cap" covering the top of the head down to a soft M-shaped hairline. */
function hairCap(color: string, line0: number, dip = 9) {
  return (g: Geo) => {
    const x = g.side ? g.hx - g.dir * 4 : g.hx;
    const y0 = g.hy + (g.back ? line0 + 18 : line0);
    const hairline: P[] = [
      ...quadPts(x - 50, y0 + 4, x - 16, y0 - dip, x + 1, y0, 6),
      ...quadPts(x + 1, y0, x + 18, y0 - dip, x + 50, y0 + 4, 6).slice(1),
    ];
    clipHead(g, () => {
      region(g, [[x + 50, g.hy - 60], [x - 50, g.hy - 60], ...hairline], color);
      g.d.line(hairline, 2.6, g.ink);
    });
    strokeHead(g);
  };
}

function cape(color: string, wide = 1) {
  return (g: Geo) => {
    const sh = g.side ? -g.dir * 12 : 0;
    const sway = g.side ? -g.dir * 6 : 0;
    poly(g, [[g.cx - 14, g.by - 12], [g.cx + 14, g.by - 12], [g.cx + 24 * wide + sh + sway, g.by + 15], [g.cx + sh, g.by + 11], [g.cx - 24 * wide + sh + sway, g.by + 15]], color);
  };
}

function crown(g: Geo, y: number, w: number, color = '#ffd23e', gem = '#ff3a6a'): void {
  const x = g.side ? g.hx - g.dir * 3 : g.hx;
  poly(g, [[x - w, y + 4], [x - w - 2, y - 13], [x - w / 2, y - 5], [x, y - 17], [x + w / 2, y - 5], [x + w + 2, y - 13], [x + w, y + 4]], color);
  ell(g, x, y - 1, 3, 3, gem, 2);
}

function grin(g: Geo, y: number, w: number, h: number): void {
  const x = g.fx;
  rr(g, x - w, y - h / 2, w * 2, h, h / 2, '#ffffff', 2.6);
  line(g, [[x - w + 2, y], [x + w - 2, y]], 1.8);
  for (let i = 1; i < 4; i++) line(g, [[x - w + (2 * w * i) / 4, y - h / 2 + 1], [x - w + (2 * w * i) / 4, y + h / 2 - 1]], 1.8);
}

function bigLips(g: Geo, y: number, w: number, h: number, color: string): void {
  const open = g.pose.mouthOpen || ['happy', 'hurt', 'surprised'].includes(g.pose.expr);
  const x = g.side ? g.fx + g.dir * 4 : g.fx;
  ell(g, x, y, w, h, color);
  if (open) {
    ell(g, x, y + 1, w * 0.62, h * 0.48, MOUTH, 2.2);
    ell(g, x, y + h * 0.2, w * 0.36, h * 0.2, TONGUE, 0);
  } else if (g.pose.expr === 'sad' || g.pose.expr === 'angry' || g.pose.expr === 'worried') {
    curve(g, x - w * 0.6, y + 2, x, y - 3, x + w * 0.6, y + 2, 2.4);
  } else {
    curve(g, x - w * 0.65, y - 1, x, y + 3, x + w * 0.65, y - 1, 2.4);
  }
}

/* ---------------- The cast ---------------- */

const BLUE = '#1c2a9c';

/** The original game's pointy ears. */
function pointyEars(color: string, tall = 32) {
  return (g: Geo) => {
    const x = g.hx + (g.side ? -g.dir * 6 : 0);
    for (const s of [-1, 1]) {
      const bx = x + s * (g.side ? 9 : 16);
      poly(g, [[bx - 9, g.hy - 18], [bx + s * 9 + g.d.r(-3, 3), g.hy - 18 - tall + g.d.r(-3, 3)], [bx + 8, g.hy - 22]], color);
    }
  };
}

const MAMETCHI: Spec = {
  head: '#ffff80', hrx: 31, hry: 27, eyeY: -1, eyeGap: 11.5, mouthY: 10.5,
  behind: pointyEars(BLUE),
  over: hairCap(BLUE, -12, 7),
};

const LOOKS: Record<CharId, Spec> = {
  mametchi: MAMETCHI,
  // 大嘴吉: round like the original game, a big green mouth and yellow blush
  kuchipatchi: {
    head: '#80ff00', hrx: 32, hry: 27.5, eyeY: -6, eyeGap: 12, mouth: 'none', cheek: '#ffff00',
    behind: (g) => line(g, [[g.hx - 2, g.hy - 25], [g.hx + 2, g.hy - 35], [g.hx + 6, g.hy - 26]], 3),
    faceOver: (g) => bigLips(g, g.hy + 9, 17, 9, '#00b000'),
  },
  memetchi: {
    head: '#ffa83d', hrx: 30, hry: 25.5, eyes: 'closed', mouth: 'open', eyeY: 1,
    behind: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      curve(g, x, g.hy - 24, x - 1, g.hy - 30, x + 1, g.hy - 34, 3);
      const pts: P[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, a = Math.PI / 2 + t * Math.PI * 3.2, r = 8.5 * (1 - t * 0.85);
        pts.push([x + 1 + Math.cos(a) * r, g.hy - 42.5 + Math.sin(a) * r]);
      }
      line(g, pts, 3);
    },
  },
  mimitchi: {
    head: '#ffffff', hrx: 30, hry: 26.5, eyes: 'closed', mouth: 'open', eyeY: 1,
    // long rabbit ears like the original game's, in Mimitchi's navy
    behind: (g) => { for (const s of [-1, 1]) { const [[x, y]] = H(g, [[s * 17, -44]]); ell(g, x, y, 9, 25, BLUE, LW, s * 0.18); } },
    over: hairCap(BLUE, -16, 5),
  },
  violetchi: {
    head: '#c9a4f2', hrx: 30, hry: 25.5, eyeY: 2,
    behind: (g) => {
      for (const s of [-1, 1]) {
        shape(g, H(g, [[6, -16], [11, -36], [17, -44], [24, -38], [31, -18]], s), '#c9a4f2');
        shape(g, H(g, [[12, -20], [15, -34], [19, -37], [23, -32], [25, -21]], s), '#ffc6e6', 0);
      }
    },
    over: (g) => {
      const [bx, by] = H(g, [[18, -22]])[0];
      poly(g, [[bx, by], [bx - 11, by - 7], [bx - 11, by + 6]], '#ffe14a', 2.4);
      poly(g, [[bx, by], [bx + 11, by - 7], [bx + 11, by + 6]], '#ffe14a', 2.4);
      ell(g, bx, by, 3.2, 3.2, '#ffb000', 2.2);
      if (!g.back) ell(g, g.fx - (g.side ? -g.dir * 16 : 17), g.hy - 12, 3.4, 2.6, '#58b4ff', 0);
    },
  },
  gozarutchi: {
    head: '#2b2b3e', hrx: 30, hry: 26, eyeY: 1.5, eyeGap: 10, cheek: false, mouth: 'none',
    behind: (g) => {
      // the hood knot
      const [kx, ky] = H(g, [[17, -22]])[0];
      const s = g.side ? -g.dir : 1;
      shape(g, [[kx, ky], [kx + s * 9, ky - 14], [kx + s * 15, ky - 12], [kx + s * 6, ky + 2]], '#2b2b3e');
      shape(g, [[kx, ky + 2], [kx + s * 16, ky - 4], [kx + s * 18, ky + 2], [kx + s * 4, ky + 6]], '#2b2b3e');
    },
    over: (g) => {
      if (g.back) return;
      clipHead(g, () => rr(g, g.fx - 25, g.hy - 7.5, 50, 18, 9, '#ffe3c8', 2.6));
      strokeHead(g);
    },
  },
  maskutchi: {
    head: '#e8403f', body: '#ffffff', limb: '#ffffff', feet: '#e8403f', hrx: 30.5, hry: 26, noEyes: true, eyeY: -2, mouthY: 16, eyeGap: 11.5,
    behind: cape('#e8403f'),
    over: (g) => {
      if (g.back) return;
      const edge = quadPts(g.hx - 50, g.hy + 10, g.fx, g.hy + 2, g.hx + 50, g.hy + 10, 10);
      clipHead(g, () => {
        region(g, [[g.hx - 50, g.hy + 50], ...edge, [g.hx + 50, g.hy + 50]], '#ffffff');
        g.d.line(edge, 2.6, g.ink);
      });
      strokeHead(g);
    },
    faceOver: (g) => {
      const ex = g.pose.expr;
      eyePositions(g).forEach(([x, y], i) => {
        const s = i ? 1 : -1;
        ell(g, x, y, 9, 6.2, '#ffffff', 2.6, -s * 0.38);
        if (g.pose.blink || ex === 'sleepy') line(g, [[x - 5, y], [x + 5, y]]);
        else if (ex === 'happy') curve(g, x - 4, y + 2, x, y - 4, x + 4, y + 2);
        else if (ex === 'hurt' || g.pose.dizzy) line(g, [[x - 4 * s, y - 3], [x + 3 * s, y], [x - 4 * s, y + 3]]);
        else ell(g, x - s * 1.5, y + 0.5, 2.6, 3, g.dark ? '#ff2a3a' : '#1b1b2a', 0);
      });
    },
  },
  oyajitchi: {
    head: '#f5c492', hrx: 31, hry: 26.5, noEyes: true, mouth: 'none', eyeY: -1, eyeGap: 11,
    behind: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      line(g, [[x, g.hy - 25], [x + 2, g.hy - 32], [x + 7, g.hy - 35], [x + 9, g.hy - 30], [x + 5, g.hy - 28]], 2.6);
    },
    faceOver: (g) => {
      const ex = g.pose.expr;
      const lift = ex === 'surprised' ? -3 : 0;
      const [a, b] = eyePositions(g);
      for (const [x, y] of [a, b]) {
        rr(g, x - 9.5, y - 6 + lift, 19, 12.5, 5.5, g.dark ? '#30001a' : '#1e1e2a', 2.4);
        if (!g.dark) line(g, [[x - 5, y - 2 + lift], [x - 2, y - 4 + lift]], 2, '#ffffff');
      }
      if (!g.side) line(g, [[a[0] + 9, a[1] - 2 + lift], [b[0] - 9, b[1] - 2 + lift]], 2.4);
      const my = g.ey + 11;
      const open = g.pose.mouthOpen || ['happy', 'hurt', 'surprised'].includes(ex);
      if (open) ell(g, g.fx, my + 5, 5.5, 4.5, MOUTH, 2.4);
      else if (ex === 'sad' || ex === 'angry') curve(g, g.fx - 5, my + 7, g.fx, my + 2, g.fx + 5, my + 7);
      else curve(g, g.fx - 4, my + 4, g.fx, my + 7, g.fx + 4, my + 4);
      const mo = g.side ? [g.fx + g.dir * 2] : [g.fx - 7, g.fx + 7];
      for (const x of mo) ell(g, x, my, g.side ? 11 : 8.5, 4.6, '#3a2a22', 2.2);
    },
  },
};

/* ---------------- Villagers, villains & friends ---------------- */

const SPECIES: Record<Species, Spec> = {
  furawatchi: {
    head: '#ffa6d4', hrx: 30, hry: 25.5, eyes: 'big', eyeY: 3, eyeScale: 0.85,
    behind: (g) => {
      for (const s of [-1, 1]) {
        shape(g, H(g, [[12, -18], [20, -34], [34, -38], [38, -26], [28, -14]], s), '#6cc04a');
        const [fx, fy] = H(g, [[30, -30]], s)[0];
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ell(g, fx + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 3.4, 3.4, '#ffe14a', 1.8); }
        ell(g, fx, fy, 2.6, 2.6, '#ff9a2a', 0);
      }
    },
    faceOver: (g) => {
      if (g.pose.expr !== 'normal' || g.pose.blink) return;
      eyePositions(g).forEach(([x, y], i) => { const s = i ? 1 : -1; line(g, [[x + s * 4, y - 6], [x + s * 8, y - 9]], 2); line(g, [[x + s * 5, y - 3], [x + s * 9, y - 4]], 2); });
    },
  },
  youngmametchi: {
    ...MAMETCHI, head: '#fff3a0', size: 0.82, eyes: 'dot', eyeScale: 1.15,
    behind: pointyEars('#4aa3e6', 24),
    over: hairCap('#4aa3e6', -12, 7),
  },
  youngmimitchi: {
    head: '#ffffff', hrx: 29.5, hry: 25, eyes: 'closed', mouth: 'open', eyeY: 3, size: 0.82,
    behind: lobeEars([[2, -18], [3, -38], [11, -53], [25, -51], [33, -37], [31, -15]], '#5db7ee'),
    over: hairCap('#5db7ee', -13, 6),
  },
  ringotchi: {
    head: '#e5383b', body: '#fff2d8', limb: '#fff2d8', feet: '#fff2d8', hrx: 31, hry: 26,
    headPts: [[0, -20], [11, -27], [25, -22], [31, -6], [29, 12], [18, 24], [0, 26], [-18, 24], [-29, 12], [-31, -6], [-25, -22], [-11, -27]],
    eyeY: 3, eyeGap: 10,
    behind: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      line(g, [[x, g.hy - 18], [x + 2, g.hy - 32]], 3.6, '#7a4a20');
      shape(g, [[x + 2, g.hy - 28], [x + 10, g.hy - 38], [x + 20, g.hy - 36], [x + 12, g.hy - 27]], '#5bbf4a', 2.4);
    },
    over: (g) => { if (!g.back) ell(g, g.fx, g.hy + 5, 19, 15, '#fff6e6', 0); },
  },
  nikatchi: {
    head: '#ffe561', hrx: 30, hry: 26, eyeY: -1, eyeGap: 10, mouth: 'none',
    headPts: [[0, -36], [9, -26], [23, -17], [30, 2], [26, 18], [14, 25], [0, 26], [-14, 25], [-26, 18], [-30, 2], [-23, -17], [-9, -26]],
    faceOver: (g) => {
      grin(g, g.ey + 13, 13, 10);
    },
  },
  ichigotchi: {
    head: '#ff4d5e', hrx: 30, hry: 26, mouth: 'open', eyeY: 3,
    headPts: [[0, -24], [18, -25], [29, -12], [28, 6], [18, 21], [0, 28], [-18, 21], [-28, 6], [-29, -12], [-18, -25]],
    over: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      for (const [sx, sy] of [[-20, -10], [21, -12], [-23, 6], [24, 4], [-12, 18], [13, 19]] as P[]) ell(g, x + sx, g.hy + sy, 1.6, 2.2, '#ffe14a', 0);
      const pts: P[] = [];
      for (let i = 0; i < 10; i++) { const a = Math.PI + (i / 9) * Math.PI; const r = i % 2 ? 10 : 20; pts.push([x + Math.cos(a) * r, g.hy - 22 + Math.sin(a) * r * 0.6]); }
      poly(g, [[x - 20, g.hy - 21], ...pts, [x + 20, g.hy - 21], [x, g.hy - 18]], '#5bbf4a', 2.4);
    },
  },
  drotchi: {
    head: '#ffffff', hrx: 28, hry: 30, headY: 76, bodyless: true, noFeet: true, eyeY: -8, eyeCol: '#3f9cff', mouth: 'none',
    headPts: [[0, -32], [18, -28], [28, -12], [28, 8], [24, 20], [32, 30], [16, 32], [4, 26], [-10, 31], [-22, 25], [-28, 10], [-28, -12], [-18, -28]],
    faceOver: (g) => {
      const x = g.fx + 2, y = g.ey + 11;
      line(g, [[x - 3, y - 4], [x + 2, y - 2], [x - 2, y], [x + 2, y + 2], [x - 3, y + 4]], 2.4);
    },
  },
  tarakotchi: {
    head: '#ffb98a', hrx: 30, hry: 26, eyeY: -4, eyeGap: 10, eyeScale: 0.9, mouth: 'none', cheek: false,
    behind: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      for (const dx of [-5, 0, 5]) curve(g, x + dx, g.hy - 24, x + dx * 1.6, g.hy - 32, x + dx * 2.4, g.hy - 36, 2.6);
    },
    faceOver: (g) => bigLips(g, g.ey + 15, 14, 9, '#ff7fa0'),
  },
  hashizotchi: {
    head: '#f068a8', hrx: 26, hry: 28, headY: 60, eyeY: -6, eyeGap: 8, mouth: 'none', cheek: false,
    faceOver: (g) => {
      const d = g.side ? g.dir : 1;
      const x = g.fx + d * 4, y = g.ey + 12;
      shape(g, [[x - d * 8, y - 3], [x + d * 26, y - 7], [x + d * 32, y + 1], [x + d * 22, y + 9], [x - d * 6, y + 9]], '#ffd23a');
      line(g, [[x - d * 4, y + 3], [x + d * 26, y + 1]], 2);
    },
  },
  hinotamatchi: {
    head: '#ff5536', hrx: 29, hry: 25, eyeY: 3, mouth: 'open',
    behind: (g) => {
      shape(g, H(g, [[-18, -14], [-20, -30], [-10, -26], [-6, -46], [4, -30], [14, -42], [18, -24], [22, -30], [24, -12]]), '#ffb02e');
      shape(g, H(g, [[-10, -16], [-8, -26], [-2, -22], [2, -34], [8, -24], [14, -16]]), '#ffe14a', 0);
    },
  },
  debatchi: {
    head: '#ffe23a', hrx: 30, hry: 25, eyeY: -2, eyeGap: 10, mouth: 'none',
    behind: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      line(g, [[x, g.hy - 24], [x + 1, g.hy - 32]], 2.8);
      shape(g, [[x + 1, g.hy - 31], [x - 8, g.hy - 40], [x - 14, g.hy - 36], [x - 6, g.hy - 30]], '#5bbf4a', 2.2);
      shape(g, [[x + 1, g.hy - 31], [x + 10, g.hy - 41], [x + 16, g.hy - 37], [x + 8, g.hy - 30]], '#5bbf4a', 2.2);
    },
    faceOver: (g) => {
      const x = g.fx, y = g.ey + 11;
      openMouth(g, x, y, 12, 9);
      rr(g, x - 10, y - 3, 20, 4.5, 1.5, '#ffffff', 1.8);
    },
  },
  robotchi: {
    head: '#c2c6d0', body: '#e04848', limb: '#c2c6d0', feet: '#3a3e4a', hrx: 28, hry: 23, noEyes: true, mouth: 'none', cheek: false, eyeY: -2,
    headPts: [[-26, -22], [26, -22], [28, -20], [28, 19], [26, 21], [-26, 21], [-28, 19], [-28, -20]],
    behind: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      line(g, [[x, g.hy - 22], [x, g.hy - 34]], 2.8);
      ell(g, x, g.hy - 37, 4.5, 4.5, '#ff4a4a', 2.4);
    },
    faceOver: (g) => {
      rr(g, g.fx - 19, g.ey - 8, 38, 16, 5, '#2a3040', 2.4);
      const ex = g.pose.expr;
      for (const [x, y] of eyePositions(g)) {
        if (ex === 'happy') curve(g, x - 4, y + 2, x, y - 3, x + 4, y + 2, 2.4, '#7affd8');
        else if (ex === 'hurt' || g.pose.dizzy) line(g, [[x - 3, y - 3], [x + 3, y + 3]], 2.4, '#ff7a7a');
        else ell(g, x, y, 3.2, 3.2, g.dark ? '#ff2a3a' : '#7affd8', 0);
      }
      for (let i = -1; i <= 1; i++) line(g, [[g.fx + i * 5, g.ey + 12], [g.fx + i * 5, g.ey + 16]], 2);
    },
  },
  wooltchi: {
    head: '#ffffff', hrx: 28, hry: 25, eyeY: 4, eyeGap: 7, eyeCol: '#ffffff', mouth: 'none', cheek: false, feet: '#2f3a80', limb: '#2f3a80',
    over: (g) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ell(g, g.hx + Math.cos(a) * 25, g.hy + Math.sin(a) * 22, 9, 8, '#ffffff');
      }
      ell(g, g.hx, g.hy, 26, 23, '#ffffff', 0);
      if (!g.back) ell(g, g.fx, g.hy + 4, 15.5, 13.5, '#2f3a80');
    },
    faceOver: (g) => {
      for (const s of g.side ? [g.dir] : [-1, 1]) ell(g, g.fx + s * 10, g.ey + 6, 3, 2, '#ff9fc0', 0);
      curve(g, g.fx - 3, g.ey + 7, g.fx, g.ey + 10, g.fx + 3, g.ey + 7, 2, '#ffffff');
    },
  },
  /* the villains */
  eternatchi: {
    head: '#fffbe6', hrx: 30, hry: 25.5, eyeY: 3,
    behind: (g) => {
      cape('#5b35b5', 1.15)(g);
      for (const s of [-1, 1]) shape(g, H(g, [[13, -18], [20, -32], [27, -36], [27, -24], [24, -12]], s), '#7d58d8');
    },
    over: (g) => {
      crown(g, g.hy - 25, 13);
      if (!g.back) star(g, g.fx, g.hy - 11, 4.2, '#ffd23e', 1.8);
    },
  },
  young_eter: {
    head: '#fffbe6', hrx: 30, hry: 25.5, eyeY: 3, size: 0.86,
    behind: (g) => { for (const s of [-1, 1]) shape(g, H(g, [[13, -18], [19, -29], [25, -32], [25, -22], [23, -12]], s), '#7d58d8'); },
    over: (g) => {
      crown(g, g.hy - 24, 9);
      if (!g.back) star(g, g.fx, g.hy - 11, 3.6, '#ffd23e', 1.8);
    },
  },
  dahui: {
    head: '#aeb0bc', hrx: 33, hry: 27, eyeY: -3, eyeGap: 11, eyeScale: 0.85, mouth: 'none', cheek: false, size: 1.12, bodyW: 1.25,
    over: (g) => {
      const x = g.side ? g.hx - g.dir * 3 : g.hx;
      clipHead(g, () => { ell(g, x, g.hy - 26, 34, 18, '#5a5c6e', 2.6); });
      strokeHead(g);
      const d = g.side ? g.dir : 1;
      ell(g, x + d * 22, g.hy - 12, 16, 4.5, '#5a5c6e', 2.6, d * 0.15);
      ell(g, x, g.hy - 27, 3.5, 3, '#ff6a3a', 2);
    },
    faceOver: (g) => {
      bigLips(g, g.ey + 15, 14, 8.5, '#d58a9c');
    },
  },
  xiaohui: {
    head: '#cfd0d8', hrx: 29, hry: 25, eyeY: 2, eyeGap: 11, size: 0.84,
    behind: (g) => { for (const s of [-1, 1]) shape(g, H(g, [[8, -16], [14, -36], [20, -40], [26, -32], [29, -14]], s), '#7a5aa0'); },
    faceOver: (g) => {
      for (const [x, y] of eyePositions(g)) ell(g, x, y, 7.5, 7.5, null, 2.4);
      if (!g.side) { const [a, b] = eyePositions(g); line(g, [[a[0] + 7.5, a[1]], [b[0] - 7.5, b[1]]], 2.2); }
    },
  },
  lumi: {
    head: '#fff6a8', hrx: 25, hry: 23, headY: 76, bodyless: true, noFeet: true, eyeY: -2, mouth: 'open', size: 0.8,
    behind: (g) => {
      // glow = a big MS Paint airbrush cloud
      g.d.spray(g.hx, g.hy, 44, '#ffff80', 420);
      g.d.spray(g.hx, g.hy, 34, '#ffff00', 160);
    },
    over: (g) => star(g, g.hx + 2, g.hy - 26, 8, '#ffd84a'),
  },
};

/* ---------------- Plain NPC looks (no species) and accessories ---------------- */

function lookFromNpc(n: NpcLook): Spec {
  if (n.species) return { ...SPECIES[n.species], ...(n.size ? { size: n.size } : {}) };
  const spec: Spec = { head: n.color, hrx: 30, hry: 25.5, eyeY: 2, size: n.size ?? 1 };
  spec.behind = (g) => {
    switch (n.ears) {
      case 'round': for (const s of [-1, 1]) { const [x, y] = H(g, [[21, -19]], s)[0]; ell(g, x, y, 9, 9, n.color); } break;
      case 'pointy': for (const s of [-1, 1]) shape(g, H(g, [[8, -16], [14, -36], [20, -40], [26, -32], [29, -14]], s), n.accent); break;
      case 'cat': for (const s of [-1, 1]) shape(g, H(g, [[8, -16], [16, -36], [28, -18]], s), n.color); break;
      case 'bunny': lobeEars([[2, -18], [3, -36], [10, -50], [22, -48], [28, -34], [27, -15]], n.color)(g); break;
      case 'antenna': for (const s of [-1, 1]) { const [[x1, y1], [x2, y2]] = H(g, [[7, -23], [15, -38]], s); line(g, [[x1, y1], [x2, y2]], 2.6); ell(g, x2, y2, 4, 4, n.accent, 2.2); } break;
      case 'leaf': { const [x, y] = H(g, [[0, -24]])[0]; shape(g, [[x, y], [x + 6, y - 14], [x + 18, y - 16], [x + 10, y - 4]], '#5bbf4a', 2.4); break; }
      case 'horn': for (const s of [-1, 1]) shape(g, H(g, [[13, -18], [20, -32], [27, -36], [27, -24], [24, -12]], s), n.accent); break;
      default: break;
    }
  };
  return spec;
}

function drawAccessories(g: Geo, n: NpcLook): void {
  const top = g.hy - g.spec.hry;
  const x = g.side ? g.hx - g.dir * 3 : g.hx;
  switch (n.hat) {
    case 'beret': ell(g, x - 3, top + 3, 24, 8, n.accent); line(g, [[x - 3, top - 5], [x - 1, top - 10]], 3); break;
    case 'crown': crown(g, top + 2, 12); break;
    case 'chef': for (const dx of [-11, 0, 11]) ell(g, x + dx, top - 8, 9, 9, '#ffffff'); rr(g, x - 17, top - 3, 34, 9, 3, '#ffffff'); break;
    case 'cap': clipHead(g, () => ell(g, x, top, 32, 16, n.accent, 2.6)); strokeHead(g); { const d = g.side ? g.dir : 1; ell(g, x + d * 20, top + 13, 14, 4, n.accent, 2.4, d * 0.15); } break;
    case 'bow': { const bx = x + 18, by = top + 6; poly(g, [[bx, by], [bx - 10, by - 7], [bx - 10, by + 6]], n.accent, 2.4); poly(g, [[bx, by], [bx + 10, by - 7], [bx + 10, by + 6]], n.accent, 2.4); ell(g, bx, by, 3, 3, n.accent, 2); break; }
    case 'hood': clipHead(g, () => region(g, [[x - 50, g.hy - 60], [x + 50, g.hy - 60], [x + 50, g.hy - 12], [x - 50, g.hy - 12]], n.accent)); strokeHead(g); poly(g, [[x - 6, top - 2], [x + 2, top - 16], [x + 8, top - 1]], n.accent, 2.4); break;
    case 'helmet': clipHead(g, () => { region(g, [[x - 50, g.hy - 60], [x + 50, g.hy - 60], [x + 50, g.hy - 10], [x - 50, g.hy - 10]], '#c4c8d4'); line(g, [[x - 50, g.hy - 10], [x + 50, g.hy - 10]]); }); strokeHead(g); poly(g, [[x - 3, top + 2], [x, top - 12], [x + 3, top + 2]], n.accent, 2.2); break;
    case 'flower': { const fx = x + 16, fy = top + 4; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ell(g, fx + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 3.6, 3.6, '#ff6a8a', 1.8); } ell(g, fx, fy, 2.6, 2.6, '#ffe14a', 0); break; }
    default: break;
  }
  if (g.back) return;
  if (n.glasses) for (const [ex, ey] of eyePositions(g)) ell(g, ex, ey, 7, 7, null, 2.2);
  if (n.mustache) for (const s of g.side ? [g.dir] : [-1, 1]) ell(g, g.fx + s * 6.5, g.ey + 9, 7.5, 3.8, '#ffffff', 2.2);
}

/* ---------------- Main draw ---------------- */

export interface DrawTarget { charId?: CharId; npc?: NpcLook; dark?: boolean }

function specFor(t: DrawTarget): Spec {
  return t.charId ? LOOKS[t.charId] : lookFromNpc(t.npc!);
}

export function drawCharacter(d: Doodle, t: DrawTarget, pose: Pose, ox = 0, oy = 0, scale = 1): void {
  const spec = specFor(t);
  const dark = !!t.dark;
  const c = d.ctx;
  c.save();
  c.translate(ox + 64, oy + 124);
  c.scale(scale * pose.sx, scale * pose.sy);
  c.translate(-64, -124);
  // chubby: one big round body, a touch larger than the official sheet
  const size = (spec.size ?? 1) * CHUBBY;
  c.translate(64, 117); c.scale(size, size); c.translate(-64, -117);

  const side = pose.facing === 'side', back = pose.facing === 'back';
  const dir = 1;
  const hy = (spec.headY ?? 82) - pose.bob;
  const hx = 64 + pose.lean;
  const cx = 64 + pose.lean * 0.55;
  const g: Geo = {
    d, c, cx, hx, hy, by: hy + 17, fx: side ? hx + dir * 10 : hx, ey: hy + (spec.eyeY ?? 2),
    dir, side, back, pose, spec, dark,
    ink: '#000000',
    col: dark ? darken : (x: string) => x,
    head: [],
  };
  g.head = spec.headPts ? smoothPts(H(g, spec.headPts)) : d.wobbleEllipse(hx, hy, spec.hrx * d.r(0.97, 1.04), spec.hry * d.r(0.96, 1.05), 0.07);
  const bodyCol = spec.body ?? spec.head;
  const limbCol = spec.limb ?? bodyCol;
  const feetCol = spec.feet ?? bodyCol;

  if (pose.flat) {
    ell(g, 64, 113, spec.hrx + 12, 8, spec.head);
    for (const x of [54, 74]) { line(g, [[x - 3, 110], [x + 3, 116]], 2.2); line(g, [[x + 3, 110], [x - 3, 116]], 2.2); }
    c.restore();
    return;
  }

  // the head IS the body (like a real Tamagotchi): fat feet and round blob hands stick straight onto it
  const fy = 114;
  const footAt = (x: number, lift: number) => { if (!spec.noFeet) ell(g, x, fy - lift, 10, 6, feetCol); };
  const shoulderY = hy + 8;
  const shoulderX = spec.hrx * (spec.bodyW ?? 1) - 5;
  const arm = (s: number, ang: number) => {
    const ax = cx + s * shoulderX, ay = shoulderY;
    ell(g, ax + Math.sin(ang) * 13 * s, ay + Math.cos(ang) * 13, 6, 6, limbCol, 3);
  };
  const lf = cx - (side ? 4 : 14) + pose.footL, rf = cx + (side ? 8 : 14) + pose.footR;

  spec.behind?.(g);
  if (side) { footAt(lf, pose.liftL); arm(-1, pose.armL); }
  paintPts(g, g.head, spec.head, LW, 25);
  spec.over?.(g);
  if (!side) {
    footAt(lf, pose.liftL);
    footAt(rf, pose.liftR);
    arm(-1, pose.armL);
    arm(1, -pose.armR);
  } else {
    footAt(rf, pose.liftR);
  }
  drawFace(g);
  if (t.npc) drawAccessories(g, t.npc);

  if (side) {
    if (pose.hammer !== null) {
      const ax = cx + 9, ay = hy + 25;
      const a = pose.hammer;
      const hx2 = ax + Math.cos(a) * 40, hy2 = ay + Math.sin(a) * 40;
      limb(g, ax, ay, hx2, hy2, '#a8642e', 4.5);
      c.save();
      c.translate(hx2, hy2);
      c.rotate(a + Math.PI / 2);
      rr(g, -14, -3, 28, 15, 4, '#ff8040');
      rr(g, -14, 3, 28, 3.5, 1, '#ffff00', 0);
      c.restore();
      ell(g, ax, ay, 4.6, 4.6, limbCol);
    } else {
      arm(1, -pose.armR);
    }
  }
  if (pose.dizzy) {
    for (let i = 0; i < 3; i++) star(g, hx - 14 + i * 14, hy - spec.hry - 10 - (i % 2) * 6, 6, '#ffe14a', 1.8);
  }
  if (pose.expr === 'sleepy') {
    d.text('z', hx + spec.hrx - 4, hy - spec.hry + 2, 15, '#0000ff');
  }
  c.restore();
}

/** One standalone 128x128 frame with paper backing. */
export function renderFrame(t: DrawTarget, pose: Pose, seedKey: string): HTMLCanvasElement {
  const d = new Doodle(128, 128, hashString(seedKey));
  drawCharacter(d, t, pose);
  return d.finish(3);
}
