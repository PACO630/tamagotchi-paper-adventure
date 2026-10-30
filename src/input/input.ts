/** Unified keyboard + touch input. Game code reads axes/buttons; DOM UI subscribes to presses. */
export type Btn = 'jump' | 'attack' | 'confirm' | 'cancel' | 'item' | 'run' | 'up' | 'down' | 'left' | 'right' | 'menu';

const KEYMAP: Record<string, Btn[]> = {
  KeyW: ['up'], ArrowUp: ['up'], KeyS: ['down'], ArrowDown: ['down'], KeyA: ['left'], ArrowLeft: ['left'], KeyD: ['right'], ArrowRight: ['right'],
  Space: ['jump'], KeyJ: ['attack'], KeyX: ['attack'], Enter: ['confirm'], NumpadEnter: ['confirm'], KeyE: ['confirm'], KeyZ: ['confirm'],
  Escape: ['cancel', 'menu'], Backspace: ['cancel'], KeyQ: ['item'], ShiftLeft: ['run'], ShiftRight: ['run'], Tab: ['menu'],
};

type PressListener = (b: Btn) => boolean | void;

class Input {
  private held = new Set<Btn>();
  private pressed = new Set<Btn>();
  private touchHeld = new Set<Btn>();
  private listeners: PressListener[] = [];
  /** analog stick from touch joystick, -1..1 */
  stick = { x: 0, y: 0 };
  /** World input is ignored while > 0 (dialogue, menus, battles). */
  private blockers = new Set<string>();
  lastDevice: 'keyboard' | 'touch' = 'keyboard';

  init(): void {
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const btns = KEYMAP[e.code];
      if (!btns) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
      this.lastDevice = 'keyboard';
      for (const b of btns) {
        if (!this.held.has(b) && !e.repeat) this.press(b);
        this.held.add(b);
      }
    });
    window.addEventListener('keyup', (e) => {
      for (const b of KEYMAP[e.code] ?? []) this.held.delete(b);
    });
    window.addEventListener('blur', () => { this.held.clear(); this.touchHeld.clear(); this.stick.x = this.stick.y = 0; });
  }

  /** Called by keyboard handlers and touch buttons. */
  press(b: Btn): void {
    // newest listener first (modal stack); a listener returning true consumes the press
    for (let i = this.listeners.length - 1; i >= 0; i--) {
      if (this.listeners[i](b) === true) return;
    }
    if (!this.blocked) this.pressed.add(b);
  }

  /** Every new finger press counts, even if a previous release was never delivered. */
  touchDown(b: Btn): void {
    this.lastDevice = 'touch';
    this.press(b);
    this.touchHeld.add(b);
  }

  /** Drop all held touch buttons (used when the controls are hidden mid-press). */
  releaseTouch(): void {
    this.touchHeld.clear();
    this.stick.x = this.stick.y = 0;
  }

  touchUp(b: Btn): void {
    this.touchHeld.delete(b);
  }

  onPress(fn: PressListener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  isDown(b: Btn): boolean {
    return this.held.has(b) || this.touchHeld.has(b);
  }

  justPressed(b: Btn): boolean {
    return this.pressed.has(b);
  }

  endFrame(): void {
    this.pressed.clear();
  }

  axis(): { x: number; y: number; run: boolean } {
    let x = 0, y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    let run = this.isDown('run');
    if (this.stick.x || this.stick.y) {
      x = this.stick.x;
      y = this.stick.y;
      run = Math.hypot(x, y) > 0.92;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, run };
  }

  block(reason: string): void { this.blockers.add(reason); }
  unblock(reason: string): void { this.blockers.delete(reason); }
  get blocked(): boolean { return this.blockers.size > 0; }
  isBlockedBy(reason: string): boolean { return this.blockers.has(reason); }
  clearBlockers(): void { for (const b of [...this.blockers]) if (b !== 'rotate') this.blockers.delete(b); }
}

export const input = new Input();
