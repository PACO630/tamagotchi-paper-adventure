/**
 * Picture-book (紙芝居) flashbacks: hand-painted pages that flip one after another, each with a
 * small illustration (backdrop + characters + props) and a caption. Used for the memories that
 * each Star Heart shard brings back, and for the epilogue.
 */
import { basePose, renderFrame, type DrawTarget } from '../art/characterArt';
import { canvas } from '../art/paperArt';
import { wait } from '../core/util';
import { CHARACTERS } from '../data/characters';
import { SPEAKERS } from '../data/chapters/helpers';
import type { BookPage, ChapterDef, CharId } from '../data/types';
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { h } from './dom';

const W = 960, H = 440;

function targetFor(look: string, dark: boolean | undefined, chapter: ChapterDef | null): DrawTarget {
  if (look in CHARACTERS) return { charId: look as CharId, dark };
  const sp = SPEAKERS[look];
  if (sp) return typeof sp.look === 'string' ? { charId: sp.look, dark: dark ?? sp.dark } : { npc: sp.look, dark: dark ?? sp.dark };
  const npc = chapter?.npcs.find((n) => n.id === look);
  if (npc) return typeof npc.look === 'string' ? { charId: npc.look, dark: dark ?? npc.dark } : { npc: npc.look, dark: dark ?? npc.dark };
  return { npc: { color: '#ffffff', accent: '#c0c0c0' }, dark };
}

/** Wobbly hand-drawn star. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#2a1a0a';
  g.stroke();
}

function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, broken = false): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 140);
  glow.addColorStop(0, 'rgba(255,250,200,0.9)');
  glow.addColorStop(1, 'rgba(255,250,200,0)');
  g.fillStyle = glow;
  g.fillRect(-150, -150, 300, 300);
  g.beginPath();
  g.moveTo(0, 60);
  g.bezierCurveTo(-110, -10, -70, -100, 0, -45);
  g.bezierCurveTo(70, -100, 110, -10, 0, 60);
  const gr = g.createRadialGradient(-20, -30, 6, 0, 0, 90);
  gr.addColorStop(0, '#fffbe0');
  gr.addColorStop(0.5, '#ffb0d8');
  gr.addColorStop(1, '#ff6aa0');
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = '#2a1a0a';
  g.stroke();
  if (broken) {
    g.beginPath();
    g.moveTo(0, -45); g.lineTo(-12, -10); g.lineTo(10, 8); g.lineTo(-6, 30); g.lineTo(4, 58);
    g.lineWidth = 6; g.strokeStyle = '#2a1a0a'; g.stroke();
  }
  g.restore();
}

function backdrop(g: CanvasRenderingContext2D, bg: BookPage['bg']): void {
  const grad = (a: string, b: string) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  const stars = (n: number, col = '#fffbe0') => { g.fillStyle = col; for (let i = 0; i < n; i++) { const x = (i * 197) % W, y = (i * 113) % (H * 0.7); g.fillRect(x, y, 3, 3); } };
  const hills = (col: string, y: number, amp = 30) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x / 90) * amp); g.lineTo(W, H); g.fill(); };
  switch (bg) {
    case 'night': grad('#1a2060', '#5a4a9a'); stars(70); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(820, 80, 40, 0, Math.PI * 2); g.fill(); hills('#2a3a5a', H - 90); break;
    case 'day': grad('#7ac8ff', '#e8f6ff'); g.fillStyle = '#ffffff'; for (const [x, y] of [[160, 80], [520, 60], [780, 110]]) { g.beginPath(); g.ellipse(x, y, 70, 26, 0, 0, Math.PI * 2); g.fill(); } hills('#7ad06a', H - 100); hills('#4aa04a', H - 50, 20); break;
    case 'village': grad('#ffc890', '#fff0d8'); hills('#8acb6a', H - 110); g.fillStyle = '#c8443a'; for (const x of [140, 300, 700]) { g.fillStyle = '#fff4dc'; g.fillRect(x, H - 190, 90, 80); g.fillStyle = '#c8443a'; g.beginPath(); g.moveTo(x - 14, H - 186); g.lineTo(x + 45, H - 240); g.lineTo(x + 104, H - 186); g.fill(); } break;
    case 'temple': grad('#2a1a5a', '#8a5ab0'); stars(40, '#ffe6a0'); g.fillStyle = '#e8d8a8'; for (const x of [120, 260, 700, 840]) g.fillRect(x, 120, 34, H - 160); g.fillStyle = '#d0c090'; g.fillRect(0, H - 50, W, 50); break;
    case 'storm': grad('#3a3a4a', '#6a6a7a'); g.strokeStyle = 'rgba(200,210,255,0.5)'; g.lineWidth = 2; for (let i = 0; i < 60; i++) { const x = (i * 71) % W, y = (i * 37) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 10, y + 30); g.stroke(); } g.strokeStyle = '#fff6a0'; g.lineWidth = 6; g.beginPath(); g.moveTo(600, 0); g.lineTo(570, 90); g.lineTo(610, 100); g.lineTo(560, 220); g.stroke(); hills('#2a2a34', H - 70); break;
    case 'sunset': grad('#ff8a5a', '#ffd8a0'); g.fillStyle = '#fff2a0'; g.beginPath(); g.arc(W / 2, H - 120, 70, 0, Math.PI * 2); g.fill(); hills('#a05a6a', H - 110); hills('#6a3a5a', H - 60, 18); break;
    case 'dark': grad('#0a0614', '#2a1440'); g.fillStyle = 'rgba(180,120,255,0.5)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i * 131) % W, (i * 89) % H, 3 + (i % 3), 0, Math.PI * 2); g.fill(); } break;
    case 'sea': grad('#7ac8f0', '#1a4a8a'); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3; for (let y = 60; y < H; y += 46) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x / 40 + y) * 6); g.stroke(); } break;
    case 'castle': grad('#3a2a6a', '#8a7ac0'); stars(30); g.fillStyle = '#2a1a4a'; g.fillRect(320, 120, 320, H - 120); for (const x of [300, 470, 620]) { g.fillRect(x, 70, 60, 120); g.beginPath(); g.moveTo(x - 10, 74); g.lineTo(x + 30, 10); g.lineTo(x + 70, 74); g.fill(); } g.fillStyle = '#ffe680'; for (const [x, y] of [[380, 200], [560, 200], [470, 270]]) g.fillRect(x, y, 22, 30); break;
    case 'space': grad('#05041a', '#1a1a4a'); stars(120); g.fillStyle = '#6a5ad0'; g.beginPath(); g.arc(150, 330, 120, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8aff9a'; g.beginPath(); g.arc(120, 300, 30, 0, Math.PI * 2); g.fill(); break;
  }
}

function deco(g: CanvasRenderingContext2D, d: NonNullable<BookPage['deco']>[number]): void {
  const x = d.x * W, y = d.y * H, s = d.s ?? 1;
  switch (d.t) {
    case 'heart': heart(g, x, y, s); break;
    case 'heart_broken': heart(g, x, y, s, true); break;
    case 'star': star(g, x, y, 22 * s, '#fff6a0'); break;
    case 'shards':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = 110 * s;
        g.save(); g.translate(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7); g.rotate(a);
        g.beginPath(); g.moveTo(0, -18); g.lineTo(12, 0); g.lineTo(2, 20); g.lineTo(-12, 4); g.closePath();
        g.fillStyle = '#ffd0ea'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2a1a0a'; g.stroke(); g.restore();
      }
      break;
    case 'tear':
      g.beginPath(); g.moveTo(x, y - 14 * s); g.quadraticCurveTo(x + 12 * s, y + 6 * s, x, y + 12 * s); g.quadraticCurveTo(x - 12 * s, y + 6 * s, x, y - 14 * s);
      g.fillStyle = '#8ad0ff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#2a4a8a'; g.stroke(); break;
    case 'light': {
      const gr = g.createRadialGradient(x, y, 2, x, y, 60 * s);
      gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.4, 'rgba(255,240,160,0.8)'); gr.addColorStop(1, 'rgba(255,240,160,0)');
      g.fillStyle = gr; g.fillRect(x - 70 * s, y - 70 * s, 140 * s, 140 * s); break;
    }
    case 'crack':
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 30, y * 0.4); g.lineTo(x + 20, y * 0.7); g.lineTo(x - 10, y);
      g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#2a1a0a'; g.stroke(); break;
    case 'note':
      g.fillStyle = '#2a1a0a'; g.beginPath(); g.ellipse(x, y, 9 * s, 7 * s, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(x + 7 * s, y - 30 * s, 3 * s, 30 * s); break;
    case 'grey':
      g.fillStyle = 'rgba(120,120,130,0.55)'; g.fillRect(0, 0, W, H); break;
  }
}

function paint(page: BookPage, chapter: ChapterDef | null): HTMLCanvasElement {
  const [c, g] = canvas(W, H);
  backdrop(g, page.bg);
  for (const d of page.deco ?? []) if (d.t !== 'grey') deco(g, d);
  for (const ch of page.chars ?? []) {
    const t = targetFor(ch.look, ch.dark, chapter);
    const fr = renderFrame(t, basePose({ facing: 'front', expr: ch.face ?? 'normal' }), `book|${ch.look}|${ch.face ?? 'normal'}|${ch.dark ? 1 : 0}`);
    const s = (ch.s ?? 1) * 1.15;
    const w = fr.width * s, hh = fr.height * s;
    const x = ch.x * W, y = (ch.y ?? 0.92) * H;
    g.save();
    g.translate(x, y);
    if (ch.flip) g.scale(-1, 1);
    g.drawImage(fr, -w / 2, -hh, w, hh);
    g.restore();
  }
  for (const d of page.deco ?? []) if (d.t === 'grey') deco(g, d);
  return c;
}

/** Plays the pages; resolves when the reader closes the book (or skips it). */
export async function playBook(pages: BookPage[], chapter: ChapterDef | null): Promise<void> {
  if (!pages.length) return;
  const img = h('img', { class: 'sb-pic', alt: '' }) as HTMLImageElement;
  const text = h('div', { class: 'sb-text' });
  const num = h('div', { class: 'sb-num' });
  const more = h('div', { class: 'sb-more' }, '▶');
  const skip = h('button', { class: 'sb-skip', type: 'button' }, '跳過回憶');
  const page = h('div', { class: 'sb-page' }, h('div', { class: 'sb-frame' }, img), text, num, more);
  const root = h('div', { class: 'storybook' }, page, skip);
  document.getElementById('fx-overlay')!.append(root);
  input.block('book');
  let next: (() => void) | null = null;
  let skipped = false;
  let typing = false;
  const advance = () => { if (typing) { typing = false; return; } next?.(); };
  root.addEventListener('click', advance);
  skip.addEventListener('click', (e) => { e.stopPropagation(); skipped = true; typing = false; next?.(); });
  const off = input.onPress((b) => {
    if (b === 'confirm' || b === 'jump' || b === 'attack') { advance(); return true; }
    if (b === 'cancel' || b === 'menu') { skipped = true; typing = false; next?.(); return true; }
    return true;
  });
  requestAnimationFrame(() => root.classList.add('in'));
  audio.sfx('flip');
  try {
    for (let i = 0; i < pages.length && !skipped; i++) {
      const p = pages[i];
      page.classList.remove('flip');
      void page.offsetWidth;
      page.classList.add('flip');
      if (i > 0) audio.sfx('flip');
      img.src = paint(p, chapter).toDataURL();
      img.classList.toggle('sepia', p.sepia !== false);
      num.textContent = `${i + 1} / ${pages.length}`;
      more.classList.remove('show');
      text.textContent = '';
      // typewriter caption
      typing = true;
      for (const ch of p.text) {
        if (!typing || skipped) break;
        text.textContent += ch;
        await wait(38);
      }
      typing = false;
      text.textContent = p.text;
      if (skipped) break;
      more.classList.add('show');
      await new Promise<void>((r) => { next = r; });
      next = null;
    }
  } finally {
    off();
    input.unblock('book');
    root.classList.remove('in');
    root.classList.add('out');
    await wait(400);
    root.remove();
  }
}
