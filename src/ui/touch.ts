/**
 * Touch controls designed not to cover the game:
 *  - field: a floating joystick (appears where the left thumb touches) + three small translucent
 *    buttons in the bottom-right corner; everything hides while dialogue or menus are open
 *  - battle: no permanent buttons — menus are tapped directly, timing commands are a tap on the
 *    screen, and a direction pad appears only for arrow-sequence commands
 */
import { bus } from '../core/events';
import { isTouchDevice } from '../core/util';
import { input, type Btn } from '../input/input';
import { settings } from '../systems/settings';
import { $, h, iconLabel } from './dom';

class TouchControls {
  private root!: HTMLElement;
  private knob!: HTMLElement;
  private base!: HTMLElement;
  private zone!: HTMLElement;
  private active = false;
  private mode: 'field' | 'battle' = 'field';
  private stickId: number | null = null;
  private center = { x: 0, y: 0 };
  private dirHeld: Btn | null = null;
  /** Set by the world: returns true when a screen tap hit the "…" / "!" bubble (and handled it). */
  tapHook: ((clientX: number, clientY: number) => boolean) | null = null;

  init(): void {
    this.root = $('#touch');
    this.knob = h('div', { class: 'stick-knob' });
    this.base = h('div', { class: 'stick-base' }, this.knob);
    this.zone = h('div', { class: 'stick-zone' }, this.base);
    const mk = (cls: string, label: string, b: Btn, sub?: string) => {
      const el = h('div', { class: `tbtn ${cls}`, role: 'button', 'aria-label': sub ?? label }, h('b', {}, ...iconLabel(label)), sub ? h('small', {}, sub) : null);
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
      mk('t-ok', 'OK', 'confirm', '調查'),
      mk('t-skill', 'C', 'ability', '能力'));
    const dpad = h('div', { class: 'tdpad' }, mk('t-up', '[up]', 'up'), mk('t-left', '[left]', 'left'), mk('t-right', '[right]', 'right'), mk('t-down', '[down]', 'down'));
    this.root.append(this.zone, buttons, dpad);

    this.zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // the left half is the joystick area — but tapping a talk bubble there should still talk
      if (this.tapHook?.(e.clientX, e.clientY)) return;
      this.stickId = e.pointerId;
      this.zone.setPointerCapture(e.pointerId);
      // floating stick: centre it under the thumb
      const zr = this.zone.getBoundingClientRect();
      const half = this.base.offsetWidth / 2;
      const cx = Math.min(Math.max(e.clientX, zr.left + half), zr.right - half);
      const cy = Math.min(Math.max(e.clientY, zr.top + half), zr.bottom - half);
      this.base.style.left = `${cx - zr.left - half}px`;
      this.base.style.top = `${cy - zr.top - half}px`;
      this.base.style.bottom = 'auto';
      this.zone.classList.add('active');
      this.center = { x: cx, y: cy };
      this.move(e.clientX, e.clientY);
    });
    this.zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      input.stick.x = input.stick.y = 0;
      this.knob.style.transform = '';
      this.base.style.left = this.base.style.top = this.base.style.bottom = '';
      this.zone.classList.remove('active');
      if (this.dirHeld) { input.touchUp(this.dirHeld); this.dirHeld = null; }
    };
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', end);

    bus.on('settings:changed', () => this.refresh());
    bus.on('touch:dpad', (on: boolean) => this.root.classList.toggle('dpad-on', !!on));
    window.addEventListener('resize', () => this.refresh());
    // hide field controls while dialogue / menus are open so they never cover them
    window.setInterval(() => {
      const hide = this.mode === 'field' && input.blocked;
      if (hide && !this.root.classList.contains('blocked')) input.releaseTouch();
      this.root.classList.toggle('blocked', hide);
    }, 150);
    this.refresh();
  }

  private move(x: number, y: number): void {
    const max = 46;
    let dx = x - this.center.x, dy = y - this.center.y;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / max, ny = dy / max;
    input.stick.x = Math.abs(nx) < 0.15 ? 0 : nx;
    input.stick.y = Math.abs(ny) < 0.15 ? 0 : ny;
    // digital direction for menus
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
    this.mode = mode;
    this.root.dataset.mode = mode;
    if (mode === 'field') this.root.classList.remove('dpad-on');
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
