/** In-game HUD: party HP/SP, level, coins, quest tracker, minimap and the quick item bar. */
import { bus } from '../core/events';
import { G } from '../core/game';
import { iconURL } from '../art/iconArt';
import { portraitURL } from '../art/textures';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import type { ChapterDef } from '../data/types';
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { quickItems, useFieldItem } from '../systems/inventory';
import { h, statBar, toast, uiRoot } from './dom';
import { uiIcon } from '../art/uiIcons';
import { toggleFullscreen } from './fullscreen';

class Hud {
  private el: HTMLElement | null = null;
  private party!: HTMLElement;
  private quest!: HTMLElement;
  private coins!: HTMLElement;
  private chapterEl!: HTMLElement;
  private quick!: HTMLElement;
  private map!: HTMLElement;
  private mapDot!: HTMLElement;
  private cd: ChapterDef | null = null;
  private raf = 0;
  private dirty = true;
  private offs: (() => void)[] = [];

  mount(cd: ChapterDef): void {
    this.unmount();
    this.cd = cd;
    this.party = h('div', { class: 'hud-party' });
    this.coins = h('div', { class: 'hud-coins' });
    this.chapterEl = h('div', { class: 'hud-chapter' });
    this.quest = h('div', { class: 'hud-quest' });
    this.quick = h('div', { class: 'hud-quick' });
    this.mapDot = h('div', { class: 'map-dot me' });
    this.map = h('div', { class: 'hud-map' }, h('div', { class: 'map-line' }), this.mapDot);
    for (const n of cd.mapNodes) {
      this.map.append(h('div', { class: 'map-node', style: { left: (n.x / cd.width) * 100 + '%' }, title: n.name }));
    }
    this.map.append(h('div', { class: 'map-boss', style: { left: (cd.boss.x / cd.width) * 100 + '%' } }, uiIcon('boss')));
    const menuBtn = h('button', { class: 'hud-btn', type: 'button', title: '選單 (ESC)' }, uiIcon('menu'));
    menuBtn.addEventListener('click', () => input.press('menu'));
    const fsBtn = h('button', { class: 'hud-btn', type: 'button', title: '全螢幕' }, uiIcon('fullscreen'));
    fsBtn.addEventListener('click', () => toggleFullscreen());
    this.el = h('div', { class: 'hud' },
      h('div', { class: 'hud-left' }, this.party),
      h('div', { class: 'hud-right' }, h('div', { class: 'hud-top-right' }, this.chapterEl, this.coins, fsBtn, menuBtn), this.map, this.quest),
      this.quick);
    uiRoot().prepend(this.el);
    this.offs.push(bus.on('state:changed', () => (this.dirty = true)), bus.on('hud:dirty', () => (this.dirty = true)), bus.on('stats:changed', () => (this.dirty = true)), bus.on('net:roster', () => (this.dirty = true)));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.dirty) { this.dirty = false; this.render(); }
      this.updateMapDot();
    };
    loop();
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    for (const o of this.offs) o();
    this.offs = [];
    this.el?.remove();
    this.el = null;
  }

  update(): void {
    this.dirty = true;
  }

  setVisible(v: boolean): void {
    this.el?.classList.toggle('hidden', !v);
  }

  private lastMapPct = -1;
  private updateMapDot(): void {
    if (!this.cd) return;
    const world = G.game?.scene.getScene('World') as any;
    const x = world?.playerX ?? 0;
    const pct = Math.round((x / this.cd.width) * 1000) / 10;
    if (pct !== this.lastMapPct) { this.lastMapPct = pct; this.mapDot.style.left = pct + '%'; }
  }

  private render(): void {
    if (!this.el || !G.state) return;
    const party = G.buildParty();
    this.party.innerHTML = '';
    const localKey = G.localMemberKey();
    for (const m of party) {
      const isMe = m.key === localKey;
      const hpPct = (m.hp / m.stats.maxHP) * 100;
      this.party.append(h('div', { class: `hud-card${isMe ? ' me' : ''}` },
        h('img', { src: portraitURL({ charId: m.charId }, hpPct < 30 ? 'worried' : 'normal'), alt: '' }),
        h('div', { class: 'hud-card-info' },
          h('div', { class: 'hud-name' }, `${m.name}`, h('span', { class: 'lv' }, ` Lv.${m.level}`)),
          statBar('hp', m.hp, m.stats.maxHP),
          statBar('sp', m.sp, m.stats.maxSP))));
    }
    this.coins.replaceChildren(uiIcon('coin'), h('span', {}, String(G.state.coins)));
    this.chapterEl.textContent = `第${this.cd?.num}章 ${this.cd?.location ?? ''}`;
    const main = G.state.activeQuests.map((q) => QUESTS[q.id]).filter(Boolean).sort((a, b) => (a.type === 'main' ? -1 : 1) - (b.type === 'main' ? -1 : 1))[0];
    this.quest.innerHTML = '';
    if (main) this.quest.append(h('div', { class: 'hud-quest-type' }, main.type === 'main' ? '主線' : '支線'), h('div', { class: 'hud-quest-title' }, main.title), h('div', { class: 'hud-quest-desc' }, main.desc));
    else this.quest.append(h('div', { class: 'hud-quest-title' }, '自由探索中'));
    this.quick.innerHTML = '';
    const qi = quickItems();
    qi.forEach((id, i) => {
      const it = ITEMS[id];
      const qty = G.state.inventory.find((e) => e.id === id)?.qty ?? 0;
      const b = h('button', { class: 'quick-slot', type: 'button', title: `${it.name}（${i === 0 ? 'Q' : '點擊'}）` }, h('img', { src: iconURL(it.icon, id), alt: '' }), h('span', {}, `×${qty}`));
      b.addEventListener('click', () => this.use(id));
      this.quick.append(b);
    });
    if (!qi.length) this.quick.append(h('div', { class: 'quick-empty' }, '沒有可用道具'));
  }

  private use(id: string): void {
    const err = useFieldItem(id, G.localMemberKey());
    if (err) { toast(err, 'warn', 1400); audio.sfx('error'); }
    else toast(`使用了 ${ITEMS[id].name}！`, 'good', 1200);
    this.dirty = true;
  }

  quickUse(): void {
    const id = quickItems()[0];
    if (id) this.use(id);
    else toast('沒有可以快速使用的道具。', 'warn', 1200);
  }
}

export const hud = new Hud();
