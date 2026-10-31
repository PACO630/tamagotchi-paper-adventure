/** Story dialogue box: name tag, MS Paint portrait with expressions, typewriter text, skip, choices. */
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { settings } from '../systems/settings';
import { h, uiRoot } from './dom';
import { uiIcon } from '../art/uiIcons';

export interface Line { name: string; portrait: string | null; text: string; pitch: number; side: 'left' | 'right' }

class DialogueBox {
  private el: HTMLElement | null = null;
  private nameEl!: HTMLElement;
  private textEl!: HTMLElement;
  private portEl!: HTMLImageElement;
  private moreEl!: HTMLElement;
  private waitEl!: HTMLElement;
  private choiceEl!: HTMLElement;
  private typing = false;
  private full = '';
  private advanceResolve: (() => void) | null = null;
  private off: (() => void) | null = null;
  private skipRequested = false;
  /** When false (multiplayer client), only the host can advance. */
  canAdvance = true;
  onSkip: (() => void) | null = null;
  onAdvance: (() => void) | null = null;

  get open(): boolean {
    return !!this.el;
  }

  get skipping(): boolean {
    return this.skipRequested;
  }

  show(): void {
    if (this.el) return;
    this.skipRequested = false;
    this.nameEl = h('div', { class: 'dlg-name' });
    this.textEl = h('div', { class: 'dlg-text' });
    this.portEl = h('img', { class: 'dlg-portrait', alt: '' }) as HTMLImageElement;
    this.moreEl = h('div', { class: 'dlg-more' }, uiIcon('more'));
    this.waitEl = h('div', { class: 'dlg-wait' }, '等待房主繼續…');
    this.choiceEl = h('div', { class: 'dlg-choices' });
    const skip = h('button', { class: 'dlg-skip', type: 'button' }, '跳過', uiIcon('play'));
    skip.addEventListener('click', (e) => { e.stopPropagation(); this.requestSkip(); });
    this.el = h('div', { class: 'dialogue' },
      h('div', { class: 'dlg-box' }, h('div', { class: 'dlg-port-wrap' }, this.portEl), h('div', { class: 'dlg-body' }, this.nameEl, this.textEl), this.moreEl, this.waitEl, skip),
      this.choiceEl);
    this.el.addEventListener('click', () => this.next());
    uiRoot().append(this.el);
    requestAnimationFrame(() => this.el?.classList.add('in'));
    input.block('dialogue');
    document.body.classList.add('dlg-open');
    this.off = input.onPress((b) => {
      if (!this.el) return false;
      if (this.choiceEl.childElementCount) return false; // choice layer handles itself
      if (b === 'confirm' || b === 'jump' || b === 'attack') { this.next(); return true; }
      if (b === 'cancel') { this.requestSkip(); return true; }
      return true;
    });
  }

  hide(): void {
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    el.classList.remove('in');
    setTimeout(() => el.remove(), 200);
    this.off?.();
    this.off = null;
    input.unblock('dialogue');
    document.body.classList.remove('dlg-open');
    this.advanceResolve?.();
    this.advanceResolve = null;
  }

  requestSkip(): void {
    if (!this.canAdvance) return;
    this.skipRequested = true;
    audio.sfx('click');
    this.onSkip?.();
    this.finishTyping();
    this.advanceResolve?.();
    this.advanceResolve = null;
  }

  /** Forget a skip request (a nested cutscene starts fresh). */
  endSkip(): void {
    this.skipRequested = false;
  }

  externalSkip(): void {
    this.skipRequested = true;
    this.finishTyping();
    this.advanceResolve?.();
    this.advanceResolve = null;
  }

  private finishTyping(): void {
    this.typing = false;
    if (this.textEl) this.textEl.textContent = this.full;
    this.moreEl?.classList.add('show');
  }

  private next(): void {
    if (!this.canAdvance) return;
    if (this.typing) { this.finishTyping(); return; }
    audio.sfx('click');
    this.onAdvance?.();
    this.advanceResolve?.();
    this.advanceResolve = null;
  }

  /** Used by multiplayer clients when the host advances. */
  externalAdvance(): void {
    this.finishTyping();
    this.advanceResolve?.();
    this.advanceResolve = null;
  }

  say(line: Line): Promise<void> {
    this.show();
    if (this.skipRequested) return Promise.resolve();
    this.nameEl.textContent = line.name;
    this.nameEl.style.display = line.name ? '' : 'none';
    this.el!.classList.toggle('narration', !line.portrait);
    this.el!.classList.toggle('right', line.side === 'right');
    if (line.portrait) { this.portEl.src = line.portrait; this.portEl.style.display = ''; }
    else this.portEl.style.display = 'none';
    this.portEl.classList.remove('pop');
    void this.portEl.offsetWidth;
    this.portEl.classList.add('pop');
    this.waitEl.classList.toggle('show', !this.canAdvance);
    this.full = line.text;
    this.textEl.textContent = '';
    this.moreEl.classList.remove('show');
    this.typing = true;
    const speed = settings.current.textSpeed === 'fast' ? 12 : settings.current.textSpeed === 'slow' ? 55 : 30;
    const chars = [...line.text];
    let i = 0;
    const tick = () => {
      if (!this.typing || !this.el) return;
      i++;
      this.textEl.textContent = chars.slice(0, i).join('');
      if (chars[i - 1] && !/[\s。，！？…、]/.test(chars[i - 1]) && line.name) audio.blip(line.pitch);
      if (i >= chars.length) { this.finishTyping(); return; }
      setTimeout(tick, /[。！？]/.test(chars[i - 1]) ? speed * 5 : speed);
    };
    setTimeout(tick, 60);
    return new Promise((r) => { this.advanceResolve = r; });
  }

  choose(prompt: string, options: string[], interactive: boolean): Promise<number> {
    this.show();
    if (prompt) {
      this.nameEl.textContent = '';
      this.nameEl.style.display = 'none';
      this.portEl.style.display = 'none';
      this.textEl.textContent = prompt;
      this.full = prompt;
      this.typing = false;
    }
    this.choiceEl.innerHTML = '';
    return new Promise((resolve) => {
      let idx = 0;
      const btns = options.map((o, i) => {
        const b = h('button', { class: 'dlg-choice', type: 'button' }, o);
        if (!interactive) b.setAttribute('disabled', '');
        b.addEventListener('click', (e) => { e.stopPropagation(); if (interactive) pick(i); });
        return b;
      });
      const focus = () => btns.forEach((b, i) => b.classList.toggle('focus', i === idx));
      const pick = (i: number) => {
        offChoice();
        audio.sfx('confirm');
        this.choiceEl.innerHTML = '';
        resolve(i);
      };
      const offChoice = input.onPress((b) => {
        if (!interactive) return true;
        if (b === 'up' || b === 'left') { idx = (idx - 1 + btns.length) % btns.length; focus(); audio.sfx('hover'); }
        else if (b === 'down' || b === 'right') { idx = (idx + 1) % btns.length; focus(); audio.sfx('hover'); }
        else if (b === 'confirm' || b === 'jump') pick(idx);
        return true;
      });
      this.choiceEl.append(...btns);
      focus();
      this.externalChoice = (i: number) => { offChoice(); this.choiceEl.innerHTML = ''; resolve(i); };
    });
  }

  externalChoice: ((i: number) => void) | null = null;
}

export const dialogue = new DialogueBox();
