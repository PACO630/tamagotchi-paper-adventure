/**
 * Chapter 4 set piece: the toy assembly line. Parts slide along the belt; press confirm (or tap)
 * when a part is under the stamp to put a toy together. Build 6 toys out of 9 parts to win.
 */
import { wait } from '../core/util';
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { h } from '../ui/dom';
import { canvas } from '../art/paperArt';

/** Toy parts drawn in the game's paper style (no emoji: they look different on every device). */
function partImage(i: number): string {
  const [c, g] = canvas(80, 80);
  const cols = ['#ff6a8a', '#5ab0ff', '#ffd23a', '#7ae07a', '#b88cff', '#ff9a4a'];
  g.fillStyle = cols[i % cols.length];
  g.strokeStyle = '#2a1a0a';
  g.lineWidth = 5;
  g.beginPath();
  switch (i % 5) {
    case 0: g.roundRect(12, 12, 56, 56, 10); break;
    case 1: g.arc(40, 40, 28, 0, Math.PI * 2); break;
    case 2: for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const r = k % 2 ? 13 : 30; g.lineTo(40 + Math.cos(a) * r, 42 + Math.sin(a) * r); } g.closePath(); break;
    case 3: g.moveTo(40, 66); g.bezierCurveTo(-4, 34, 18, 4, 40, 24); g.bezierCurveTo(62, 4, 84, 34, 40, 66); break;
    default: g.moveTo(14, 64); g.lineTo(40, 12); g.lineTo(66, 64); g.closePath(); break;
  }
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.arc(30, 30, 6, 0, Math.PI * 2); g.fill();
  return c.toDataURL();
}

const PARTS = Array.from({ length: 9 }, (_, i) => i);
const NEED = 6;

export function playAssembly(): Promise<void> {
  return new Promise((resolve) => {
    const belt = h('div', { class: 'asm-belt' });
    const stamp = h('div', { class: 'asm-stamp' }, h('div', { class: 'asm-press' }), h('div', { class: 'asm-zone' }));
    const score = h('div', { class: 'asm-score' });
    const tip = h('div', { class: 'asm-tip' }, input.lastDevice === 'touch' ? '零件跑到壓印機正下方時，點一下畫面！' : '零件跑到壓印機正下方時，按下 Enter！');
    const box = h('div', { class: 'paper-card asm-card' }, h('h2', {}, '玩具生產線'), score, h('div', { class: 'asm-track' }, belt, stamp), tip);
    const root = h('div', { class: 'asm-root' }, box);
    document.getElementById('fx-overlay')!.append(root);
    input.block('minigame');
    let made = 0, tried = 0, done = false;
    let items: { el: HTMLElement; x: number; hit: boolean }[] = [];
    const speed = 0.23; // track widths per second
    const refresh = () => { score.textContent = `完成的玩具：${made} / ${NEED}　剩下的零件：${PARTS.length - tried}`; };
    refresh();
    const press = () => {
      if (done) return;
      stamp.classList.remove('down');
      void stamp.offsetWidth;
      stamp.classList.add('down');
      const target = items.find((it) => !it.hit && Math.abs(it.x - 0.5) < 0.06);
      if (target) {
        target.hit = true;
        target.el.classList.add('made');
        made++;
        audio.sfx(Math.abs(target.x - 0.5) < 0.025 ? 'perfect' : 'nice');
      } else audio.sfx('miss');
      refresh();
    };
    const off = input.onPress((b) => {
      if (b === 'confirm' || b === 'jump' || b === 'attack') { press(); return true; }
      return true;
    });
    root.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
    requestAnimationFrame(() => root.classList.add('in'));
    let last = performance.now();
    let spawnT = 0.3;
    const loop = (now: number) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spawnT -= dt;
      if (spawnT <= 0 && tried < PARTS.length) {
        spawnT = 1.15 + Math.random() * 0.5;
        const el = h('div', { class: 'asm-part' }, h('img', { src: partImage(PARTS[tried]), alt: '' }));
        belt.append(el);
        items.push({ el, x: 0, hit: false });
        tried++;
        refresh();
      }
      for (const it of items) { it.x += speed * dt; it.el.style.left = `${it.x * 100}%`; }
      for (const it of items.filter((x) => x.x > 1.05)) it.el.remove();
      items = items.filter((x) => x.x <= 1.05);
      if (made >= NEED || (tried >= PARTS.length && !items.length)) { void end(made >= NEED); return; }
      requestAnimationFrame(loop);
    };
    const end = async (won: boolean) => {
      done = true;
      tip.textContent = won ? '生產線恢復正常！可愛的玩具又回來了！' : '零件用完了……再試一次！';
      audio.sfx(won ? 'levelup' : 'error');
      await wait(1600);
      if (!won) {
        made = 0; tried = 0; done = false; items.forEach((i) => i.el.remove()); items = [];
        tip.textContent = '再一次！看準時機！';
        refresh();
        last = performance.now();
        requestAnimationFrame(loop);
        return;
      }
      off();
      input.unblock('minigame');
      root.classList.remove('in');
      await wait(300);
      root.remove();
      resolve();
    };
    requestAnimationFrame(loop);
  });
}
