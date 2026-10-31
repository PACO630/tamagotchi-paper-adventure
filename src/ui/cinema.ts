/**
 * Cinematic presentation layer for cutscenes: letterbox bars, story captions and banners.
 * While cinema mode is on the HUD and touch controls step aside and player input is blocked.
 */
import { input } from '../input/input';
import { wait } from '../core/util';
import { h } from './dom';

class Cinema {
  private root: HTMLElement | null = null;
  private cap!: HTMLElement;
  private banner!: HTMLElement;
  active = false;
  /** Set by the story runner: skips the rest of the running cutscene. */
  onSkip: (() => void) | null = null;

  private ensure(): HTMLElement {
    if (this.root) return this.root;
    this.cap = h('div', { class: 'cine-caption' });
    this.banner = h('div', { class: 'cine-banner' });
    const skip = h('button', { class: 'cine-skip', type: 'button' }, '跳過');
    skip.addEventListener('click', (e) => { e.stopPropagation(); this.onSkip?.(); });
    this.root = h('div', { class: 'cinema' }, h('div', { class: 'cine-bar top' }), h('div', { class: 'cine-bar bottom' }), this.cap, this.banner, skip);
    // inside the UI layer, under the dialogue box (z-index 5 < 8): the bars must never cover the text
    document.getElementById('ui')!.append(this.root);
    window.addEventListener('keydown', (e) => { if (this.active && e.key === 'Escape') this.onSkip?.(); });
    return this.root;
  }

  on(): void {
    const r = this.ensure();
    this.active = true;
    r.classList.add('on');
    document.body.classList.add('cinema-on');
    input.block('cinema');
  }

  off(): void {
    this.active = false;
    this.root?.classList.remove('on');
    document.body.classList.remove('cinema-on');
    input.unblock('cinema');
    this.clearCaption();
  }

  /** Story caption between the letterbox bars. Resolves after `ms`. */
  async caption(text: string, ms = 2600): Promise<void> {
    this.ensure();
    this.cap.textContent = text;
    this.cap.classList.remove('show');
    void this.cap.offsetWidth;
    this.cap.classList.add('show');
    await wait(ms);
    this.cap.classList.remove('show');
    await wait(250);
  }

  clearCaption(): void {
    this.cap?.classList.remove('show');
  }

  /**
   * Paper-style name card that slides in from the side (boss entrances, new partners, henchmen).
   * Resolves once it has been read.
   */
  async nameCard(title: string, sub = '', img: string | null = null, color = '#e8203a', ms = 2300): Promise<void> {
    const card = h('div', { class: 'name-card', style: { '--nc': color } },
      img ? h('div', { class: 'nc-pic' }, h('img', { src: img, alt: '' })) : null,
      h('div', { class: 'nc-text' }, sub ? h('div', { class: 'nc-sub' }, sub) : null, h('div', { class: 'nc-title' }, title)));
    document.getElementById('fx-overlay')!.append(card);
    requestAnimationFrame(() => card.classList.add('in'));
    await wait(ms);
    card.classList.add('out');
    await wait(450);
    card.remove();
  }

  /** Big stamped banner ("BOSS", "夥伴加入", …). Does not block. */
  flashBanner(title: string, sub = '', ms = 2200): void {
    this.ensure();
    this.banner.innerHTML = '';
    this.banner.append(h('div', { class: 'cb-title' }, title));
    if (sub) this.banner.append(h('div', { class: 'cb-sub' }, sub));
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    window.setTimeout(() => this.banner.classList.remove('show'), ms);
  }
}

export const cinema = new Cinema();
