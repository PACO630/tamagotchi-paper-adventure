/** Dedicated touch controls: virtual joystick + action buttons, laid out for landscape and portrait. */
import { bus } from '../core/events';
import { isTouchDevice } from '../core/util';
import { input, type Btn } from '../input/input';
import { settings } from '../systems/settings';
import { $, h, iconLabel } from './dom';
import { uiIcon } from '../art/uiIcons';

class TouchControls {
  private root!: HTMLElement;
  private knob!: HTMLElement;
  private base!: HTMLElement;
  private active = false;
  private stickId: number | null = null;
  private center = { x: 0, y: 0 };
  private dirHeld: Btn | null = null;

  init(): void {
    this.root = $('#touch');
    this.knob = h('div', { class: 'stick-knob' });
    this.base = h('div', { class: 'stick-base' }, this.knob);
    const stickZone = h('div', { class: 'stick-zone' }, this.base);
    const mk = (cls: string, label: string, b: Btn, sub?: string) => {
      const el = h('div', { class: `tbtn ${cls}`, role: 'button', 'aria-label': label }, h('b', {}, ...iconLabel(label)), sub ? h('small', {}, sub) : null);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); input.touchDown(b); if (navigator.vibrate) navigator.vibrate(8); });
      const up = () => { el.classList.remove('down'); input.touchUp(b); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      return el;
    };
    const buttons = h('div', { class: 'tbtns' },
      mk('t-jump', 'A', 'jump', '跳躍'),
      mk('t-attack', 'B', 'attack', '攻擊'),
      mk('t-ok', 'OK', 'confirm', '確認'),
      mk('t-item', '[bag]', 'item', '道具'));
    const back = mk('t-back', '[menu]', 'cancel', '選單/返回');
    const dpad = h('div', { class: 'tdpad' }, mk('t-up', '[up]', 'up'), mk('t-left', '[left]', 'left'), mk('t-right', '[right]', 'right'), mk('t-down', '[down]', 'down'));
    this.root.append(stickZone, buttons, back, dpad, h('div', { class: 'rotate-hint' }, uiIcon('phone'), '建議將手機轉為橫向遊玩'));

    stickZone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      stickZone.setPointerCapture(e.pointerId);
      const r = this.base.getBoundingClientRect();
      this.center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.move(e.clientX, e.clientY);
    });
    stickZone.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      input.stick.x = input.stick.y = 0;
      this.knob.style.transform = '';
      if (this.dirHeld) { input.touchUp(this.dirHeld); this.dirHeld = null; }
    };
    stickZone.addEventListener('pointerup', end);
    stickZone.addEventListener('pointercancel', end);

    bus.on('settings:changed', () => this.refresh());
    window.addEventListener('resize', () => this.refresh());
    this.refresh();
  }

  private move(x: number, y: number): void {
    const max = 52;
    let dx = x - this.center.x, dy = y - this.center.y;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / max, ny = dy / max;
    input.stick.x = Math.abs(nx) < 0.15 ? 0 : nx;
    input.stick.y = Math.abs(ny) < 0.15 ? 0 : ny;
    // digital direction for menus / sequences
    let dir: Btn | null = null;
    if (Math.hypot(nx, ny) > 0.6) dir = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'down' : 'up');
    if (dir !== this.dirHeld) {
      if (this.dirHeld) input.touchUp(this.dirHeld);
      if (dir) input.touchDown(dir);
      this.dirHeld = dir;
    }
  }

  setActive(on: boolean, mode: 'field' | 'battle' = 'field'): void {
    this.active = on;
    this.root.dataset.mode = mode;
    this.refresh();
  }

  refresh(): void {
    const pref = settings.current.touchControls;
    const show = this.active && (pref === 'on' || (pref === 'auto' && isTouchDevice()));
    this.root.classList.toggle('show', show);
    document.body.classList.toggle('touch-ui', show);
  }
}

export const touch = new TouchControls();
