/** Tiny DOM helpers, layer management, keyboard/touch navigation, toasts and dialogs. */
import { bus } from '../core/events';
import { input, type Btn } from '../input/input';
import { audio } from '../systems/audio';
import { uiIcon, type UiIconName } from '../art/uiIcons';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, any>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export const uiRoot = () => $('#ui');

/** A full-screen UI layer (screen or modal). Layers stack; only the top receives navigation. */
export class Layer {
  el: HTMLElement;
  private off: (() => void) | null = null;
  private focusIdx = 0;
  onCancel: (() => void) | null = null;
  closed = false;
  private key: string;
  private static seq = 0;

  constructor(cls: string, public modal = false) {
    this.el = h('div', { class: `layer ${cls}${modal ? ' modal-layer' : ''}` });
    this.key = `ui:${cls}:${++Layer.seq}`;
  }

  open(): this {
    uiRoot().append(this.el);
    input.block(this.key);
    this.off = input.onPress((b) => this.handle(b));
    requestAnimationFrame(() => this.el.classList.add('in'));
    setTimeout(() => this.focusFirst(), 30);
    return this;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.off?.();
    input.unblock(this.key);
    this.el.classList.remove('in');
    this.el.classList.add('out');
    setTimeout(() => this.el.remove(), 180);
  }

  buttons(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>('.nav:not([disabled])')].filter((b) => b.offsetParent !== null);
  }

  focusFirst(): void {
    const bs = this.buttons();
    const pref = bs.findIndex((b) => b.classList.contains('primary'));
    this.focusIdx = pref >= 0 ? pref : 0;
    this.applyFocus();
  }

  private applyFocus(): void {
    const bs = this.buttons();
    bs.forEach((b, i) => b.classList.toggle('focus', i === this.focusIdx));
    bs[this.focusIdx]?.scrollIntoView?.({ block: 'nearest' });
  }

  handle(b: Btn): boolean {
    if (this.closed) return false;
    // only the top-most layer navigates
    const layers = [...uiRoot().querySelectorAll('.layer:not(.out)')];
    if (layers[layers.length - 1] !== this.el) return false;
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
      if (b === 'cancel') active.blur();
      return true;
    }
    const bs = this.buttons();
    if (b === 'up' || b === 'left') { this.focusIdx = (this.focusIdx - 1 + bs.length) % Math.max(1, bs.length); this.applyFocus(); audio.sfx('hover'); return true; }
    if (b === 'down' || b === 'right') { this.focusIdx = (this.focusIdx + 1) % Math.max(1, bs.length); this.applyFocus(); audio.sfx('hover'); return true; }
    if (b === 'confirm' || b === 'jump') {
      const el = bs[this.focusIdx];
      if (el) {
        if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') return true;
        el.click();
      }
      return true;
    }
    if (b === 'cancel' && this.onCancel) { audio.sfx('cancel'); this.onCancel(); return true; }
    return true;
  }
}

export function btn(label: string, onClick: () => void, opts: { cls?: string; disabled?: boolean; sfx?: string; title?: string; icon?: UiIconName } = {}): HTMLButtonElement {
  // a leading "[iconName]" in the label renders that doodle icon
  const m = /^\[(\w+)\]\s*/.exec(label);
  const icon = opts.icon ?? (m ? (m[1] as UiIconName) : undefined);
  const text = m ? label.slice(m[0].length) : label;
  const b = h('button', { class: `btn nav ${opts.cls ?? ''}`, type: 'button', title: opts.title }, icon ? uiIcon(icon) : null, text ? h('span', {}, text) : null);
  if (opts.disabled) b.setAttribute('disabled', '');
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (b.hasAttribute('disabled')) return;
    audio.sfx(opts.sfx ?? 'confirm');
    onClick();
  });
  b.addEventListener('pointerenter', () => audio.sfx('hover'));
  return b;
}

/** HP/SP row: label, bar, numbers side by side (numbers never sit inside the thin bar). */
export function statBar(kind: 'hp' | 'sp', cur: number, max: number): HTMLElement {
  const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) * 100 : 0;
  return h('div', { class: `stat ${kind}` },
    h('b', { class: 'stat-label' }, kind === 'hp' ? 'HP' : 'SP'),
    h('div', { class: `bar ${kind}` }, h('i', { style: { width: pct + '%' } })),
    h('span', { class: 'stat-val' }, `${cur}/${max}`));
}

/** Renders a label that may start with "[iconName]". */
export function iconLabel(label: string): (Node | string)[] {
  const m = /^\[(\w+)\]\s*/.exec(label);
  return m ? [uiIcon(m[1] as UiIconName), label.slice(m[0].length)] : [label];
}

/* ---------------- Toasts ---------------- */

export function toast(text: string, kind: 'info' | 'good' | 'warn' | 'save' | 'quest' = 'info', ms = 2400): void {
  const box = $('#toasts');
  const t = h('div', { class: `toast toast-${kind}` }, text);
  box.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  while (box.children.length > 4) box.firstChild?.remove();
}

bus.on('toast', (text: string, kind?: any) => toast(text, kind));

/* ---------------- Dialogs ---------------- */

export function confirmDialog(title: string, body: string | Node, okLabel = '確定', cancelLabel = '取消', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const layer = new Layer('dialog', true);
    const done = (v: boolean) => { layer.close(); resolve(v); };
    layer.onCancel = () => done(false);
    layer.el.append(h('div', { class: 'paper-card dialog-card' },
      h('h2', {}, title),
      typeof body === 'string' ? h('p', { class: 'dialog-body' }, body) : body,
      h('div', { class: 'row' }, btn(cancelLabel, () => done(false), { sfx: 'cancel' }), btn(okLabel, () => done(true), { cls: danger ? 'danger primary' : 'primary' }))));
    layer.open();
  });
}

export function alertDialog(title: string, body: string | Node, okLabel = '好'): Promise<void> {
  return new Promise((resolve) => {
    const layer = new Layer('dialog', true);
    const done = () => { layer.close(); resolve(); };
    layer.onCancel = done;
    layer.el.append(h('div', { class: 'paper-card dialog-card' },
      h('h2', {}, title),
      typeof body === 'string' ? h('p', { class: 'dialog-body' }, body) : body,
      h('div', { class: 'row' }, btn(okLabel, done, { cls: 'primary' }))));
    layer.open();
  });
}

export function promptDialog(title: string, label: string, initial: string, validate: (v: string) => string | null): Promise<string | null> {
  return new Promise((resolve) => {
    const layer = new Layer('dialog', true);
    const inp = h('input', { class: 'text-input nav', maxlength: '24', value: initial, autocomplete: 'off' }) as HTMLInputElement;
    const err = h('div', { class: 'error-text' });
    const done = (v: string | null) => { layer.close(); resolve(v); };
    const submit = () => {
      const e = validate(inp.value);
      if (e) { err.textContent = e; audio.sfx('error'); return; }
      done(inp.value.trim());
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    layer.onCancel = () => done(null);
    layer.el.append(h('div', { class: 'paper-card dialog-card' },
      h('h2', {}, title), h('label', { class: 'field-label' }, label), inp, err,
      h('div', { class: 'row' }, btn('取消', () => done(null), { sfx: 'cancel' }), btn('確定', submit, { cls: 'primary' }))));
    layer.open();
    setTimeout(() => inp.focus(), 60);
  });
}
