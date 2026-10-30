/**
 * Phones play in landscape only. In portrait a full-screen "rotate your phone" sheet covers the
 * game and the game loop is paused until the phone is turned sideways.
 */
import { G } from '../core/game';
import { isPhone } from '../core/device';
import { input } from '../input/input';
import { uiIcon } from '../art/uiIcons';

let sheet: HTMLElement | null = null;
let paused = false;

function tryLock(): void {
  const o = (screen as any).orientation;
  if (o?.lock) o.lock('landscape').catch(() => { /* iOS / not allowed: the sheet handles it */ });
}

function update(): void {
  const portrait = window.innerHeight > window.innerWidth;
  const lock = isPhone() && portrait;
  sheet?.classList.toggle('show', lock);
  if (lock) input.block('rotate'); else input.unblock('rotate');
  const game = G.game as any;
  if (!game?.loop) return;
  if (lock && !paused) { game.pause?.(); paused = true; }
  else if (!lock && paused) { game.resume?.(); paused = false; }
}

export function initRotateLock(): void {
  sheet = document.createElement('div');
  sheet.className = 'rotate-lock';
  const icon = uiIcon('rotate', 'rl-icon');
  const t = document.createElement('div');
  t.className = 'rl-title';
  t.textContent = '請把手機轉成橫向';
  const s = document.createElement('div');
  s.className = 'rl-sub';
  s.textContent = '紙片大冒險只能橫向遊玩，轉過來就會繼續！';
  sheet.append(icon, t, s);
  document.body.append(sheet);
  tryLock();
  window.addEventListener('pointerdown', tryLock, { once: true });
  window.addEventListener('resize', () => setTimeout(update, 50));
  window.addEventListener('orientationchange', () => setTimeout(update, 250));
  update();
}

/** Call after the Phaser game exists so a portrait start is paused too. */
export function refreshRotateLock(): void {
  update();
}
