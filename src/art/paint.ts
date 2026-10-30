/**
 * MS Paint "烂涂鸦" renderer — procedural implementation of hand-drawn skill style #5
 * (.claude/skills/hand-drawn/STYLES.md §5, rendered via scripts/render_prompt.py --style 5):
 *   - lines are wobbly, shaky and broken, drawn "one stroke at a time with a mouse"
 *   - proportions are absurdly off: circles aren't round, straight lines aren't straight
 *   - big rough flat solid fills that clearly spill past the outline, pixel jaggies, low-quality digital feel
 *   - "trying to draw it right but everything is off"; pure white background
 *   - NO professional polish, realistic lighting, gradients or pretty details
 * Every doodle is rendered without anti-aliasing (alpha threshold + palette snap) and mounted
 * on a white paper backing so it doubles as a paper-cutout sprite.
 */
import { makeRng } from '../core/util';

export type Pt = [number, number];

/** Windows XP MS Paint default palette (+ the custom colours a kid would mix). */
export const PAINT_PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class Doodle {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly rnd: () => number;
  private colors = new Set<string>(['#000000', '#ffffff']);
  /** how shaky the "mouse hand" is (1 = default) */
  shake = 1.35;

  constructor(public w: number, public h: number, seed: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.rnd = makeRng(seed);
  }

  r(a: number, b: number): number {
    return a + (b - a) * this.rnd();
  }

  private use(c: string): string {
    this.colors.add(c.toLowerCase());
    return c;
  }

  /** Lumpy closed shape around an ellipse — low-frequency lumps + high-frequency hand shake. */
  wobbleEllipse(cx: number, cy: number, rx: number, ry: number, lump = 0.08, n = 36): Pt[] {
    const p1 = this.r(0, 6.28), p2 = this.r(0, 6.28), a1 = this.r(0.4, 1) * lump, a2 = this.r(0.3, 0.8) * lump;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const k = 1 + Math.sin(t * 2 + p1) * a1 + Math.sin(t * 3 + p2) * a2 + this.r(-0.02, 0.02) * this.shake;
      pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
    }
    return pts;
  }

  /** Adds shake to an arbitrary polyline (subdividing long segments). */
  jitter(pts: Pt[], amt = 1.2, closed = false): Pt[] {
    const out: Pt[] = [];
    const src = closed ? [...pts, pts[0]] : pts;
    for (let i = 0; i < src.length - 1; i++) {
      const [x0, y0] = src[i];
      const [x1, y1] = src[i + 1];
      const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push([x0 + (x1 - x0) * t + this.r(-amt, amt) * this.shake, y0 + (y1 - y0) * t + this.r(-amt, amt) * this.shake]);
      }
    }
    if (!closed) out.push(src[src.length - 1]);
    return out;
  }

  private path(pts: Pt[]): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  }

  /** Flat bucket-style fill that spills past the outline and leaves slivers uncovered. */
  fill(pts: Pt[], color: string, spill = 2.5): void {
    const c = this.ctx;
    c.save();
    c.fillStyle = this.use(color);
    const dx = this.r(-spill, spill), dy = this.r(-spill, spill);
    c.translate(dx, dy);
    this.path(pts);
    c.closePath();
    c.fill();
    c.restore();
    // a rushed extra scribble of colour that goes over the line somewhere
    if (spill > 0 && this.rnd() < 0.7) {
      const i = Math.floor(this.r(0, pts.length));
      const [x, y] = pts[i];
      c.save();
      c.strokeStyle = color;
      c.lineWidth = this.r(3, 6);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + this.r(-6, 6), y + this.r(-6, 6));
      c.stroke();
      c.restore();
    }
  }

  /** Shaky, sometimes broken outline. `closed` overshoots the start like a hasty mouse stroke. */
  line(pts: Pt[], width = 3, color = '#000000', opts: { closed?: boolean; broken?: number } = {}): void {
    const c = this.ctx;
    let p = this.jitter(pts, 0.9, false);
    if (opts.closed) {
      const over = Math.max(2, Math.floor(p.length * 0.08));
      p = [...this.jitter(pts, 0.9, true), ...p.slice(1, over).map(([x, y]) => [x + this.r(-2, 2), y + this.r(-2, 2)] as Pt)];
    }
    c.save();
    c.strokeStyle = this.use(color);
    const broken = opts.broken ?? 0.06;
    let seg: Pt[] = [];
    const flush = () => {
      if (seg.length > 1) {
        c.lineWidth = width * this.r(0.8, 1.25);
        this.path(seg);
        c.stroke();
      }
      seg = [];
    };
    for (const pt of p) {
      if (this.rnd() < broken) flush(); // the line breaks: "断断续续"
      seg.push(pt);
    }
    flush();
    c.restore();
  }

  /** Filled + outlined wobbly blob. */
  blob(cx: number, cy: number, rx: number, ry: number, fillColor: string | null, width = 3, lump = 0.08): Pt[] {
    const pts = this.wobbleEllipse(cx, cy, rx, ry, lump);
    if (fillColor) this.fill(pts, fillColor);
    if (width > 0) this.line(pts, width, '#000000', { closed: true });
    return pts;
  }

  shape(pts: Pt[], fillColor: string | null, width = 3, spill = 2.5): void {
    if (fillColor) this.fill(pts, fillColor, spill);
    if (width > 0) this.line(pts, width, '#000000', { closed: true });
  }

  /** MS Paint airbrush/spray-can: scattered single pixels. */
  spray(cx: number, cy: number, radius: number, color: string, density = 60): void {
    const c = this.ctx;
    c.fillStyle = this.use(color);
    for (let i = 0; i < density; i++) {
      const a = this.r(0, Math.PI * 2);
      const d = Math.sqrt(this.rnd()) * radius;
      c.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1);
    }
  }

  /** Rough zig-zag "shading" scribble. */
  scribble(x: number, y: number, w: number, h: number, color: string, n = 5): void {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) pts.push([x + (w * i) / n + this.r(-1, 1), y + (i % 2 ? h : 0) + this.r(-1, 1)]);
    this.line(pts, 2, color, { broken: 0 });
  }

  dot(x: number, y: number, r: number, color = '#000000'): void {
    const c = this.ctx;
    c.fillStyle = this.use(color);
    c.beginPath();
    c.ellipse(x, y, r * this.r(0.85, 1.15), r * this.r(0.85, 1.15), this.r(0, 3), 0, Math.PI * 2);
    c.fill();
  }

  /** Text written with the "mouse" — chunky and slanted. */
  text(s: string, x: number, y: number, size: number, color = '#000000'): void {
    const c = this.ctx;
    c.save();
    c.fillStyle = this.use(color);
    c.font = `bold ${size}px "Comic Sans MS", "Marker Felt", sans-serif`;
    c.translate(x, y);
    c.rotate(this.r(-0.12, 0.12));
    c.fillText(s, 0, 0);
    c.restore();
  }

  registerColor(c: string): void {
    this.use(c);
  }

  /**
   * Removes anti-aliasing (alpha threshold + snap to the colours actually used) so edges are jaggy
   * like MS Paint, then mounts the doodle on a white paper backing with a thin paper-edge shadow.
   */
  finish(border = 3): HTMLCanvasElement {
    const { w, h } = this;
    const pal = [...this.colors].map(hexToRgb);
    const img = this.ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const cache = new Map<number, number>();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let idx = cache.get(key);
      if (idx === undefined) {
        let best = 1e9;
        idx = 0;
        for (let p = 0; p < pal.length; p++) {
          const dr = pal[p][0] - d[i], dg = pal[p][1] - d[i + 1], db = pal[p][2] - d[i + 2];
          const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
          if (dist < best) { best = dist; idx = p; }
        }
        cache.set(key, idx);
      }
      d[i] = pal[idx][0]; d[i + 1] = pal[idx][1]; d[i + 2] = pal[idx][2];
    }
    this.ctx.putImageData(img, 0, 0);
    if (border <= 0) return this.canvas;

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const o = out.getContext('2d')!;
    o.imageSmoothingEnabled = false;
    // silhouette (dilated) for the paper backing
    const sil = document.createElement('canvas');
    sil.width = w;
    sil.height = h;
    const s = sil.getContext('2d')!;
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      s.drawImage(this.canvas, Math.round(Math.cos(a) * border), Math.round(Math.sin(a) * border));
    }
    s.drawImage(this.canvas, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = '#ffffff';
    s.fillRect(0, 0, w, h);
    // paper thickness edge
    o.globalAlpha = 0.35;
    o.filter = 'none';
    o.drawImage(sil, 1, 2);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = '#8a7a66';
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = 'source-over';
    o.globalAlpha = 1;
    o.drawImage(sil, 0, 0);
    o.drawImage(this.canvas, 0, 0);
    // final crispness pass for the backing edge
    const im2 = o.getImageData(0, 0, w, h);
    const d2 = im2.data;
    for (let i = 3; i < d2.length; i += 4) d2[i] = d2[i] < 60 ? 0 : d2[i] < 200 ? Math.max(d2[i], 140) : 255;
    o.putImageData(im2, 0, 0);
    return out;
  }
}
