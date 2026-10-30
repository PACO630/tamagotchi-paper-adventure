/** Tamagotchi characters drawn as deliberately bad MS Paint mouse doodles (skill style #5). */
import type { CharId, Expr, NpcLook } from '../data/types';
import { Doodle, type Pt } from './paint';
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

interface Look {
  body: string;
  cheek: string;
  feet?: string;
  eye?: string;
  rx: number;
  ry: number;
  dark?: boolean;
  behind?: (d: Doodle, g: Geo) => void;
  over?: (d: Doodle, g: Geo) => void;
  face?: (d: Doodle, g: Geo) => boolean; // return true to skip default mouth
}

interface Geo { cx: number; cy: number; rx: number; ry: number; facing: Facing; pose: Pose; dir: number; look: Look }

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

/* ---------------- Per-character looks ---------------- */

function ear(d: Doodle, base1: Pt, tip: Pt, base2: Pt, color: string, inner?: string) {
  d.shape([base1, tip, base2], color, 3);
  if (inner) {
    const mid: Pt = [(base1[0] + base2[0]) / 2, (base1[1] + base2[1]) / 2];
    d.shape([[mid[0] + (base1[0] - mid[0]) * 0.5, mid[1]], [tip[0] * 0.75 + mid[0] * 0.25, tip[1] * 0.75 + mid[1] * 0.25], [mid[0] + (base2[0] - mid[0]) * 0.5, mid[1]]], inner, 0, 1);
  }
}

const LOOKS: Record<CharId, Look> = {
  mametchi: {
    body: '#ffff80', cheek: '#ff0080', rx: 33, ry: 29,
    behind: (d, g) => {
      const { cx, cy, facing, dir } = g;
      const navy = g.look.dark ? '#100020' : '#000080';
      const off = facing === 'side' ? -6 * dir : 0;
      for (const s of [-1, 1]) {
        const bx = cx + off + s * (facing === 'side' ? 9 : 16);
        ear(d, [bx - 9, cy - 20], [bx + s * 9 + d.r(-3, 3), cy - 52 + d.r(-3, 3)], [bx + 8, cy - 24], navy);
      }
    },
  },
  memetchi: {
    body: '#ffe0c0', cheek: '#ff0080', rx: 31, ry: 29,
    behind: (d, g) => {
      const { cx, cy, facing } = g;
      const hair = g.look.dark ? darken('#ff80c0') : '#ff80c0';
      const sides = facing === 'side' ? [-1] : [-1, 1];
      for (const s of sides) {
        const x = cx + s * 30 - (facing === 'side' ? 6 * g.dir : 0);
        d.blob(x, cy + 2, 10, 14, hair, 3, 0.15);
        d.blob(x + s * 2, cy + 22, 9, 12, hair, 3, 0.15);
      }
    },
    over: (d, g) => {
      const { cx, cy, rx, ry, facing, dir } = g;
      const hair = g.look.dark ? darken('#ff80c0') : '#ff80c0';
      const pts: Pt[] = [];
      const n = 14;
      const sh = facing === 'side' ? -6 * dir : 0;
      for (let i = 0; i <= n; i++) {
        const t = Math.PI + (i / n) * Math.PI;
        pts.push([cx + sh + Math.cos(t) * (rx + 3), cy - 2 + Math.sin(t) * (ry + 3)]);
      }
      // jagged fringe
      if (facing !== 'back') {
        pts.push([cx + sh + rx * 0.5, cy - ry * 0.35], [cx + sh + rx * 0.2, cy - ry * 0.55], [cx + sh - rx * 0.1, cy - ry * 0.3], [cx + sh - rx * 0.45, cy - ry * 0.5], [cx + sh - rx * 0.8, cy - ry * 0.15]);
      } else {
        pts.push([cx + rx, cy + ry * 0.5], [cx - rx, cy + ry * 0.5]);
      }
      d.shape(pts, hair, 3);
      d.blob(cx + sh + 4, cy - ry - 6, 8, 6, '#ff0000', 3);
      d.blob(cx + sh - 9, cy - ry - 5, 7, 5, '#ff0000', 2);
    },
  },
  kuchipatchi: {
    body: '#80ff00', cheek: '#ff8040', rx: 35, ry: 30,
    face: (d, g) => {
      const { cx, cy, facing, dir } = g;
      if (facing === 'back') return true;
      const lx = facing === 'side' ? cx + dir * 28 : cx;
      d.blob(lx, cy + 9, facing === 'side' ? 11 : 17, 9, '#ff8040', 3, 0.1);
      d.line([[lx - (facing === 'side' ? 8 : 13), cy + 9], [lx + (facing === 'side' ? 8 : 13), cy + 10]], 2);
      return true;
    },
    behind: (d, g) => {
      // tiny tuft
      d.line([[g.cx - 2, g.cy - g.ry + 2], [g.cx + 2, g.cy - g.ry - 8], [g.cx + 6, g.cy - g.ry]], 3);
    },
  },
  mimitchi: {
    body: '#c0e0ff', cheek: '#ff80c0', rx: 30, ry: 28,
    behind: (d, g) => {
      const { cx, cy, facing, dir } = g;
      const col = g.look.dark ? darken('#c0e0ff') : '#c0e0ff';
      const sh = facing === 'side' ? -8 * dir : 0;
      for (const s of [-1, 1]) {
        const x = cx + sh + s * 12;
        const pts = d.wobbleEllipse(x + s * 6, cy - 46, 8, 26, 0.1);
        d.fill(pts, col);
        d.line(pts, 3, '#000000', { closed: true });
        const inner = d.wobbleEllipse(x + s * 6, cy - 44, 3.5, 18, 0.1);
        d.fill(inner, '#ff80c0', 1);
      }
    },
  },
  violetchi: {
    body: '#c080ff', cheek: '#ff0080', rx: 32, ry: 29,
    behind: (d, g) => {
      const { cx, cy, facing, dir } = g;
      const sh = facing === 'side' ? -6 * dir : 0;
      for (const s of [-1, 1]) {
        const bx = cx + sh + s * 18;
        ear(d, [bx - 10, cy - 18], [bx + s * 6, cy - 46], [bx + 10, cy - 20], g.look.dark ? darken('#c080ff') : '#c080ff', '#ffc0ff');
      }
    },
    face: (d, g) => {
      const { cx, cy, facing, dir } = g;
      if (facing !== 'back') {
        const mx = facing === 'side' ? cx + dir * 18 : cx;
        d.blob(mx, cy + 9, facing === 'side' ? 10 : 14, 8, '#ffffff', 2, 0.15);
      }
      return false;
    },
    over: (d, g) => {
      const { cx, cy, facing, dir } = g;
      const bx = cx + (facing === 'side' ? -4 * dir : 20);
      d.shape([[bx - 9, cy - 34], [bx, cy - 29], [bx - 9, cy - 24]], '#ffff00', 2);
      d.shape([[bx + 9, cy - 34], [bx, cy - 29], [bx + 9, cy - 24]], '#ffff00', 2);
    },
  },
  gozarutchi: {
    body: '#000080', cheek: '#ff8080', rx: 32, ry: 30, feet: '#000080',
    over: (d, g) => {
      const { cx, cy, rx, facing, dir } = g;
      // red headband
      d.shape([[cx - rx + 2, cy - 18], [cx + rx - 2, cy - 20], [cx + rx - 2, cy - 13], [cx - rx + 2, cy - 11]], '#ff0000', 2, 1);
      const kx = facing === 'side' ? cx - dir * (rx - 2) : cx + rx - 4;
      d.line([[kx, cy - 15], [kx + (facing === 'side' ? -dir : 1) * 14, cy - 22 + d.r(-3, 3)]], 4, '#ff0000');
      d.line([[kx, cy - 15], [kx + (facing === 'side' ? -dir : 1) * 12, cy - 8 + d.r(-3, 3)]], 4, '#ff0000');
    },
    face: (d, g) => {
      const { cx, cy, facing, dir } = g;
      if (facing === 'back') return true;
      const fx = facing === 'side' ? cx + dir * 14 : cx;
      d.blob(fx, cy + 2, facing === 'side' ? 15 : 22, 11, '#ffe0c0', 2, 0.1);
      return false;
    },
  },
  maskutchi: {
    body: '#ffffff', cheek: '#ff80c0', rx: 32, ry: 29,
    behind: (d, g) => {
      const { cx, cy, facing, dir } = g;
      const c = g.look.dark ? '#400000' : '#ff0000';
      const sway = d.r(-3, 3) - (facing === 'side' ? dir * 10 : 0);
      d.shape([[cx - 24, cy - 6], [cx + 24, cy - 6], [cx + 30 + sway, cy + 34], [cx + sway, cy + 30], [cx - 30 + sway, cy + 34]], c, 3);
    },
    over: (d, g) => {
      const { cx, cy, rx, facing, dir } = g;
      if (facing === 'back') {
        d.line([[cx - rx + 2, cy - 8], [cx + rx - 2, cy - 9]], 5);
        return;
      }
      const sh = facing === 'side' ? dir * 10 : 0;
      d.shape([[cx - rx + 4 + sh, cy - 14], [cx + rx - 3 + sh, cy - 15], [cx + rx - 6 + sh, cy - 1], [cx - rx + 6 + sh, cy]], '#000000', 2, 1);
      const holes: Pt[] = facing === 'side' ? [[cx + dir * 12, cy - 7], [cx + dir * 25, cy - 6]] : [[cx - 11, cy - 7], [cx + 12, cy - 6]];
      holes.forEach(([x, y], i) => {
        d.blob(x, y, i ? 4.5 : 5.5, i ? 4 : 5, '#ffffff', 0, 0.1);
        if (g.pose.expr === 'happy') d.line([[x - 3, y + 1], [x, y - 2], [x + 3, y + 1]], 2);
        else if (g.pose.expr === 'hurt' || g.pose.blink) d.line([[x - 3, y], [x + 3, y]], 2);
        else d.dot(x + (i ? 0.5 : -0.5), y + 0.5, i ? 1.8 : 2.2, g.look.dark ? '#ff0000' : '#000000');
      });
      d.shape([[cx - 4, cy - 30], [cx, cy - 40], [cx + 4, cy - 30], [cx + 10, cy - 33], [cx + 5, cy - 26], [cx - 5, cy - 26], [cx - 10, cy - 33]], '#ffff00', 2);
    },
    eye: '#ffffff',
  },
  oyajitchi: {
    body: '#80ffff', cheek: '#ff8080', rx: 33, ry: 30,
    behind: (d, g) => {
      const { cx, cy, ry } = g;
      d.line([[cx - 6, cy - ry + 3], [cx - 9, cy - ry - 9]], 2);
      d.line([[cx, cy - ry + 2], [cx + 1, cy - ry - 11]], 2);
      d.line([[cx + 6, cy - ry + 3], [cx + 10, cy - ry - 8]], 2);
    },
    face: (d, g) => {
      const { cx, cy, facing, dir } = g;
      if (facing === 'back') return true;
      const mx = facing === 'side' ? cx + dir * 20 : cx;
      d.blob(mx - 9, cy + 9, 11, 6, '#ffffff', 2, 0.2);
      d.blob(mx + 9, cy + 10, 11, 6, '#ffffff', 2, 0.2);
      return true;
    },
    over: (d, g) => {
      const { cx, cy, facing, dir } = g;
      if (facing === 'back') return;
      const ex = facing === 'side' ? [cx + dir * 14, cx + dir * 26] : [cx - 11, cx + 12];
      for (const x of ex) d.line(d.wobbleEllipse(x, cy - 4, 7, 7, 0.1), 2, '#000000', { closed: true });
      if (facing !== 'side') d.line([[ex[0] + 7, cy - 4], [ex[1] - 7, cy - 4]], 2);
    },
  },
};

function lookFromNpc(n: NpcLook): Look {
  const look: Look = { body: n.color, cheek: '#ff80c0', rx: 30 * (n.size ?? 1), ry: 27 * (n.size ?? 1) };
  look.behind = (d, g) => {
    const { cx, cy, ry } = g;
    switch (n.ears) {
      case 'round': for (const s of [-1, 1]) d.blob(cx + s * 20, cy - ry + 4, 9, 9, n.color, 3); break;
      case 'pointy': for (const s of [-1, 1]) ear(d, [cx + s * 14 - 8, cy - ry + 8], [cx + s * 24, cy - ry - 18], [cx + s * 14 + 8, cy - ry + 6], n.accent); break;
      case 'cat': for (const s of [-1, 1]) ear(d, [cx + s * 16 - 8, cy - ry + 8], [cx + s * 20, cy - ry - 12], [cx + s * 16 + 8, cy - ry + 8], n.color, '#ffc0c0'); break;
      case 'bunny': for (const s of [-1, 1]) d.blob(cx + s * 11, cy - ry - 16, 6, 18, n.color, 3); break;
      case 'antenna': for (const s of [-1, 1]) { d.line([[cx + s * 8, cy - ry + 2], [cx + s * 16, cy - ry - 16]], 2); d.blob(cx + s * 16, cy - ry - 18, 4, 4, n.accent, 2); } break;
      case 'leaf': d.shape([[cx, cy - ry + 2], [cx + 14, cy - ry - 16], [cx + 2, cy - ry - 12]], '#00a000', 2); break;
      case 'horn': d.shape([[cx - 5, cy - ry + 4], [cx, cy - ry - 14], [cx + 5, cy - ry + 4]], n.accent, 2); break;
      default: break;
    }
  };
  look.over = (d, g) => {
    const { cx, cy, ry, rx, facing } = g;
    switch (n.hat) {
      case 'beret': d.blob(cx - 4, cy - ry + 2, rx * 0.8, 8, n.accent, 3); break;
      case 'crown': d.shape([[cx - 14, cy - ry + 4], [cx - 14, cy - ry - 12], [cx - 6, cy - ry - 4], [cx, cy - ry - 14], [cx + 6, cy - ry - 4], [cx + 14, cy - ry - 12], [cx + 14, cy - ry + 4]], '#ffff00', 2); break;
      case 'chef': d.blob(cx, cy - ry - 8, 16, 12, '#ffffff', 3); break;
      case 'cap': d.shape([[cx - rx + 6, cy - ry + 10], [cx - rx + 10, cy - ry - 4], [cx + rx - 10, cy - ry - 4], [cx + rx + 6, cy - ry + 10]], n.accent, 3); break;
      case 'bow': d.blob(cx + 14, cy - ry + 2, 7, 5, n.accent, 2); d.blob(cx + 24, cy - ry + 2, 7, 5, n.accent, 2); break;
      case 'hood': d.shape([[cx - rx - 2, cy + 4], [cx - rx + 2, cy - ry], [cx, cy - ry - 8], [cx + rx - 2, cy - ry], [cx + rx + 2, cy + 4], [cx + rx - 8, cy - 8], [cx - rx + 8, cy - 8]], n.accent, 3); break;
      case 'helmet': d.shape([[cx - rx + 2, cy - 6], [cx - rx + 4, cy - ry], [cx + rx - 4, cy - ry], [cx + rx - 2, cy - 6]], '#c0c0c0', 3); break;
      case 'flower': d.blob(cx + 12, cy - ry + 2, 6, 6, '#ff0000', 2); d.dot(cx + 12, cy - ry + 2, 2, '#ffff00'); break;
      default: break;
    }
    if (facing === 'back') return;
    if (n.mustache) { d.blob(cx - 7, cy + 8, 8, 4, '#ffffff', 2); d.blob(cx + 7, cy + 8, 8, 4, '#ffffff', 2); }
    if (n.glasses) for (const x of [cx - 11, cx + 12]) d.line(d.wobbleEllipse(x, cy - 4, 6, 6, 0.1), 2, '#000000', { closed: true });
  };
  return look;
}

/* ---------------- Face ---------------- */

function drawFace(d: Doodle, g: Geo): void {
  const { cx, cy, facing, pose, dir, look } = g;
  if (facing === 'back') return;
  const skipMouth = look.face ? look.face(d, g) : false;
  const eyeCol = look.dark ? '#ff0000' : look.eye ? '#000000' : '#000000';
  const side = facing === 'side';
  const e1: Pt = side ? [cx + dir * 12, cy - 5] : [cx - 11, cy - 5];
  const e2: Pt = side ? [cx + dir * 25, cy - 3] : [cx + 12, cy - 3];
  const r1 = side ? 3.2 : 4.2, r2 = side ? 2.6 : 3.4; // never the same size
  const ex = pose.expr;
  if (pose.dizzy) {
    for (const [x, y] of [e1, e2]) d.line([[x - 4, y - 4], [x + 4, y + 4]], 2), d.line([[x + 4, y - 4], [x - 4, y + 4]], 2);
  } else if (pose.blink || ex === 'sleepy') {
    for (const [x, y] of [e1, e2]) d.line([[x - 4, y], [x + 4, y + 1]], 2);
  } else if (ex === 'happy') {
    for (const [x, y] of [e1, e2]) d.line([[x - 4, y + 2], [x, y - 3], [x + 4, y + 2]], 2);
  } else if (ex === 'hurt') {
    for (const [[x, y], s] of [[e1, 1], [e2, -1]] as [Pt, number][]) d.line([[x - 4 * s, y - 3], [x + 3 * s, y], [x - 4 * s, y + 3]], 2);
  } else if (ex === 'surprised') {
    d.blob(e1[0], e1[1], r1 + 2, r1 + 3, '#ffffff', 2);
    d.blob(e2[0], e2[1], r2 + 2, r2 + 3, '#ffffff', 2);
    d.dot(e1[0], e1[1], 1.6, eyeCol);
    d.dot(e2[0] + 1, e2[1], 1.4, eyeCol);
  } else {
    d.dot(e1[0], e1[1], r1, eyeCol);
    d.dot(e2[0], e2[1] + 1, r2, eyeCol);
    if (!look.dark) {
      d.ctx.fillStyle = '#ffffff';
      d.ctx.fillRect(Math.round(e1[0] - 1), Math.round(e1[1] - 2), 2, 2);
      d.ctx.fillRect(Math.round(e2[0]), Math.round(e2[1] - 1), 1, 1);
    }
  }
  // brows
  if (ex === 'angry' || ex === 'determined') {
    d.line([[e1[0] - 5, e1[1] - 9], [e1[0] + 4, e1[1] - 6]], 2);
    d.line([[e2[0] - 4, e2[1] - 7], [e2[0] + 5, e2[1] - 10]], 2);
  } else if (ex === 'worried' || ex === 'sad') {
    d.line([[e1[0] - 5, e1[1] - 6], [e1[0] + 4, e1[1] - 9]], 2);
    d.line([[e2[0] - 4, e2[1] - 10], [e2[0] + 5, e2[1] - 7]], 2);
  }
  // cheeks: MS Paint spray can
  if (!look.dark) {
    const c1: Pt = side ? [cx + dir * 4, cy + 7] : [cx - 21, cy + 6];
    const c2: Pt = side ? [cx + dir * 29, cy + 8] : [cx + 21, cy + 8];
    d.spray(c1[0], c1[1], 5, look.cheek, 28);
    if (!side) d.spray(c2[0], c2[1], 4, look.cheek, 22);
  }
  if (skipMouth) return;
  const m: Pt = side ? [cx + dir * 20, cy + 9] : [cx + 1, cy + 9];
  if (pose.mouthOpen || ex === 'surprised' || ex === 'hurt') {
    d.blob(m[0], m[1], 4, 4.5, '#800000', 2);
  } else if (ex === 'happy') {
    d.shape([[m[0] - 6, m[1] - 2], [m[0] + 6, m[1] - 1], [m[0], m[1] + 5]], '#ff0000', 2, 1);
  } else if (ex === 'sad') {
    d.line([[m[0] - 5, m[1] + 3], [m[0], m[1] - 1], [m[0] + 5, m[1] + 3]], 2);
    d.blob(e1[0] - 1, e1[1] + 9, 2, 3.5, '#00ffff', 1);
  } else if (ex === 'angry') {
    d.line([[m[0] - 6, m[1]], [m[0] - 3, m[1] - 2], [m[0], m[1]], [m[0] + 3, m[1] - 2], [m[0] + 6, m[1]]], 2);
  } else if (ex === 'worried') {
    d.line([[m[0] - 5, m[1]], [m[0] - 2, m[1] - 2], [m[0] + 2, m[1] + 1], [m[0] + 5, m[1] - 1]], 2);
    d.blob(cx + (side ? -dir * 10 : 26), cy - 16, 2.5, 4, '#80ffff', 1);
  } else if (ex === 'determined') {
    d.line([[m[0] - 5, m[1]], [m[0] + 5, m[1] - 1]], 3);
  } else if (ex === 'sleepy') {
    d.blob(m[0], m[1], 2, 2, '#800000', 1);
  } else {
    d.line([[m[0] - 5, m[1] - 1], [m[0] - 1, m[1] + 3], [m[0] + 5, m[1]]], 2);
  }
}

/* ---------------- Main draw ---------------- */

export interface DrawTarget { charId?: CharId; npc?: NpcLook; dark?: boolean }

export function lookFor(t: DrawTarget): Look {
  const base = t.charId ? LOOKS[t.charId] : lookFromNpc(t.npc!);
  if (!t.dark) return base;
  return { ...base, body: darken(base.body), feet: base.feet ? darken(base.feet) : undefined, cheek: '#400040', dark: true };
}

export function drawCharacter(d: Doodle, t: DrawTarget, pose: Pose, ox = 0, oy = 0, scale = 1): void {
  const look = lookFor(t);
  const ctx = d.ctx;
  ctx.save();
  ctx.translate(ox + 64, oy + 124);
  ctx.scale(scale * pose.sx, scale * pose.sy);
  ctx.translate(-64, -124);
  const dir = 1;
  const rx = look.rx, ry = look.ry;
  if (pose.flat) {
    // flattened like a dropped sheet of paper
    d.blob(64, 112, rx + 14, 10, look.body, 3, 0.1);
    for (const x of [52, 74]) { d.line([[x - 4, 108], [x + 4, 114]], 2); d.line([[x + 4, 108], [x - 4, 114]], 2); }
    ctx.restore();
    return;
  }
  const cx = 64 + pose.lean, cy = 82 - pose.bob;
  const g: Geo = { cx, cy, rx, ry, facing: pose.facing, pose, dir, look };
  const feet = look.feet ?? look.body;
  const side = pose.facing === 'side';

  // back foot (side view) first
  const fy = 115;
  const fl: Pt = [cx - (side ? 4 : 14) + pose.footL, fy - pose.liftL];
  const fr: Pt = [cx + (side ? 8 : 14) + pose.footR, fy - pose.liftR];
  if (side) d.blob(fl[0], fl[1], 10, 6, feet, 3, 0.1);

  look.behind?.(d, g);

  // arms behind (side: far arm)
  const arm = (sx: number, ang: number) => {
    const ax = cx + sx * (rx - 4), ay = cy + 6;
    const hx = ax + Math.sin(ang) * 14 * sx, hy = ay + Math.cos(ang) * 14;
    d.blob(hx, hy, 6, 6, look.body, 3, 0.1);
  };
  if (side) arm(-1, pose.armL);

  // body — never quite round
  d.blob(cx, cy, rx * d.r(0.97, 1.04), ry * d.r(0.96, 1.05), look.body, 3, 0.07);

  if (!side) {
    d.blob(fl[0], fl[1], 10, 6, feet, 3, 0.1);
    d.blob(fr[0], fr[1], 10, 6, feet, 3, 0.1);
    arm(-1, pose.armL);
    arm(1, -pose.armR);
  } else {
    d.blob(fr[0], fr[1], 10, 6, feet, 3, 0.1);
  }

  drawFace(d, g);
  look.over?.(d, g);

  if (side) {
    // near arm + optional hammer
    if (pose.hammer !== null) {
      const ax = cx + 6, ay = cy + 8;
      const a = pose.hammer;
      const hx = ax + Math.cos(a) * 42, hy = ay + Math.sin(a) * 42;
      d.line([[ax, ay], [hx, hy]], 5, '#804000', { broken: 0 });
      const px = Math.cos(a + Math.PI / 2) * 14, py = Math.sin(a + Math.PI / 2) * 14;
      const fx = Math.cos(a) * 13, fy2 = Math.sin(a) * 13;
      d.shape([[hx - px, hy - py], [hx + px, hy + py], [hx + px + fx, hy + py + fy2], [hx - px + fx, hy - py + fy2]], '#ff8040', 3, 1.5);
      d.blob(ax, ay, 6, 6, look.body, 3, 0.1);
    } else {
      arm(1, -pose.armR);
    }
  }
  if (pose.dizzy) {
    for (let i = 0; i < 3; i++) {
      const sx = cx - 14 + i * 14, sy = cy - ry - 10 - (i % 2) * 6;
      const pts: Pt[] = [];
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const r = k % 2 ? 2.5 : 6; pts.push([sx + Math.cos(a) * r, sy + Math.sin(a) * r]); }
      d.shape(pts, '#ffff00', 1);
    }
  }
  if (pose.expr === 'sleepy') d.text('z', cx + rx - 4, cy - ry, 14, '#0000ff');
  ctx.restore();
}

/** One standalone doodle frame (128x128) with paper backing. */
export function renderFrame(t: DrawTarget, pose: Pose, seedKey: string): HTMLCanvasElement {
  const d = new Doodle(128, 128, hashString(seedKey));
  drawCharacter(d, t, pose);
  return d.finish(3);
}
