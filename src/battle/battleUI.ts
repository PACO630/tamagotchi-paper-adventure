/** DOM battle HUD: party status panel and the command menu (keyboard, mouse and touch). */
import { G } from '../core/game';
import { portraitURL } from '../art/textures';
import { iconURL } from '../art/iconArt';
import { ITEMS } from '../data/items';
import { DUOS, DUO_COST, SKILLS } from '../data/skills';
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { h, iconLabel, statBar, uiRoot } from '../ui/dom';
import { uiIcon } from '../art/uiIcons';
import type { Fighter, MenuChoice } from './battleTypes';

export interface MenuContext {
  fighter: Fighter;
  party: Fighter[];
  enemies: Fighter[];
  boss: boolean;
  teamUnlocked: boolean;
  skillCost: (id: string) => number;
  highlight: (id: string | null) => void;
}

const BATTLE_ITEM_KINDS = new Set(['heal', 'sp', 'buff', 'battle', 'revive', 'cure']);

class BattleUI {
  private root: HTMLElement | null = null;
  private panel!: HTMLElement;
  private menuEl!: HTMLElement;

  mount(): void {
    this.unmount();
    this.panel = h('div', { class: 'b-party' });
    this.menuEl = h('div', { class: 'b-menu' });
    this.root = h('div', { class: 'battle-ui' }, this.panel, this.menuEl);
    uiRoot().append(this.root);
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
  }

  updateParty(party: Fighter[], activeId: string | null): void {
    if (!this.root) return;
    this.panel.innerHTML = '';
    for (const f of party) {
      const card = h('div', { class: `b-card${f.id === activeId ? ' active' : ''}${f.hp <= 0 ? ' ko' : ''}` },
        h('img', { class: 'b-portrait', src: portraitURL({ charId: f.charId! }, f.hp <= 0 ? 'hurt' : f.hp < f.maxHP * 0.3 ? 'worried' : 'normal'), alt: '' }),
        h('div', { class: 'b-info' },
          h('div', { class: 'b-name' }, f.name),
          statBar('hp', f.hp, f.maxHP),
          statBar('sp', f.sp, f.maxSP)));
      this.panel.append(card);
    }
  }

  showWaiting(text: string): void {
    if (!this.root) return;
    this.menuEl.innerHTML = '';
    this.menuEl.append(h('div', { class: 'b-wait' }, text));
  }

  clearMenu(): void {
    if (this.menuEl) this.menuEl.innerHTML = '';
  }

  /** Shows the command menu for the local player's fighter and resolves with the chosen action. */
  menu(ctx: MenuContext): Promise<MenuChoice> {
    return new Promise((resolve) => {
      const f = ctx.fighter;
      let off: (() => void) | null = null;
      let items: { el: HTMLElement; act: () => void }[] = [];
      let focus = 0;
      let back: (() => void) | null = null;

      const finish = (c: MenuChoice) => {
        off?.();
        ctx.highlight(null);
        this.clearMenu();
        resolve(c);
      };

      const render = (title: string, list: { label: string; sub?: string; tags?: string[]; icon?: string; disabled?: boolean; hint?: string; onFocus?: () => void; act: () => void }[], onBack: (() => void) | null) => {
        back = onBack;
        this.menuEl.innerHTML = '';
        const box = h('div', { class: 'b-cmd' }, h('div', { class: 'b-cmd-title' }, title));
        const hint = h('div', { class: 'b-hint' });
        items = list.map((it, i) => {
          const el = h('button', { class: `b-opt${it.disabled ? ' disabled' : ''}`, type: 'button' },
            it.icon ? h('img', { src: it.icon, alt: '' }) : null, h('span', { class: 'b-opt-label' }, ...iconLabel(it.label)), ...(it.tags ?? []).map((t) => uiIcon(t as any, 'tag')), it.sub ? h('span', { class: 'b-opt-sub' }, it.sub) : null);
          el.addEventListener('click', () => { focus = i; refocus(); if (!it.disabled) { audio.sfx('confirm'); it.act(); } else audio.sfx('error'); });
          el.addEventListener('pointerenter', () => { focus = i; refocus(); });
          box.append(el);
          return { el, act: () => { if (!it.disabled) { audio.sfx('confirm'); it.act(); } else audio.sfx('error'); }, hint: it.hint, onFocus: it.onFocus } as any;
        });
        if (onBack) {
          const b = h('button', { class: 'b-opt back', type: 'button' }, uiIcon('back'), '返回');
          b.addEventListener('click', () => { audio.sfx('cancel'); onBack(); });
          box.append(b);
        }
        box.append(hint);
        this.menuEl.append(box);
        focus = 0;
        const refocus = () => {
          items.forEach((x, i) => x.el.classList.toggle('focus', i === focus));
          const cur = items[focus] as any;
          hint.textContent = cur?.hint ?? '';
          cur?.onFocus?.();
        };
        (this as any)._refocus = refocus;
        refocus();
      };

      const pickTarget = (side: 'enemy' | 'ally', then: (id: string) => void, onBack: () => void) => {
        const list = side === 'enemy' ? ctx.enemies.filter((e) => e.hp > 0) : ctx.party;
        render(side === 'enemy' ? '選擇目標' : '選擇隊友', list.map((t) => ({
          label: t.name,
          sub: `HP ${t.hp}/${t.maxHP}`,
          tags: side === 'enemy' ? [t.traits.includes('flying') ? 'wing' : '', t.traits.includes('spiky') ? 'spike' : ''].filter(Boolean) : [],
          hint: side === 'enemy' ? enemyHint(t) : '',
          onFocus: () => ctx.highlight(t.id),
          act: () => then(t.id),
        })), onBack);
      };

      const top = () => {
        ctx.highlight(f.id);
        const opts = [
          { label: '[hammer]鎚子攻擊', hint: '時機按下確認可增加傷害，Great 會把敵人敲皺（防禦下降）。打不到飛行的敵人。', act: () => pickTarget('enemy', (id) => finish({ kind: 'hammer', target: id }), top) },
          { label: '[shoe]跳躍攻擊', hint: '落地時按確認可連續踩。不能踩刺刺的敵人。', act: () => pickTarget('enemy', (id) => finish({ kind: 'jump', target: id }), top) },
          { label: '[sparkle]技能', sub: `SP ${f.sp}`, hint: '使用角色的特殊技能。', act: skills },
          ...(duoPartners().length ? [{ label: '[duo]合體技', sub: `SP ${DUO_COST}+${DUO_COST}`, hint: '和夥伴一起完成兩段指令，放出強力的合體招式！兩個人都要消耗技能點數。', act: duos }] : []),
          { label: '[bag]道具', hint: '使用背包裡的道具。', act: itemsMenu },
          { label: '[shield]防禦', hint: '本回合防禦力 +1，並回復 1 技能點數。', act: () => finish({ kind: 'defend' }) },
          { label: '[run]逃跑', disabled: ctx.boss, hint: ctx.boss ? 'Boss 戰無法逃跑！' : '有機會離開戰鬥。', act: () => finish({ kind: 'flee' }) },
        ];
        if (ctx.teamUnlocked) opts.unshift({ label: '[star]星之心合奏', hint: '所有夥伴的力量合而為一！唯一能突破永恆之壁的招式。', act: () => finish({ kind: 'team' }) });
        render(`${f.name} 的回合`, opts, null);
      };

      const duoPartners = () => ctx.party.filter((p) => p.id !== f.id && p.hp > 0 && p.charId && DUOS[p.charId]);
      const duos = () => {
        const list = duoPartners().map((p) => {
          const d = DUOS[p.charId!]!;
          const tired = p.statuses.some((s) => s.type === 'sleep' || s.type === 'dizzy');
          const low = f.sp < DUO_COST || p.sp < DUO_COST;
          return {
            label: d.name, sub: `與 ${p.name}`, disabled: tired || low, hint: tired ? `${p.name} 現在沒辦法配合！` : low ? `兩個人都需要 ${DUO_COST} 技能點數。` : d.desc,
            act: () => {
              if (d.target === 'enemy') pickTarget('enemy', (id) => finish({ kind: 'duo', partner: p.id, target: id }), duos);
              else finish({ kind: 'duo', partner: p.id });
            },
          };
        });
        render('合體技', list, top);
      };

      const skills = () => {
        const list = f.skills.map((id) => SKILLS[id]).filter(Boolean).map((s) => {
          const cost = ctx.skillCost(s.id);
          return {
            label: s.name, sub: `SP ${cost}`, disabled: f.sp < cost, hint: s.desc,
            act: () => {
              if (s.target === 'enemy') pickTarget('enemy', (id) => finish({ kind: 'skill', skill: s.id, target: id }), skills);
              else if (s.target === 'ally') pickTarget('ally', (id) => finish({ kind: 'skill', skill: s.id, target: id }), skills);
              else finish({ kind: 'skill', skill: s.id });
            },
          };
        });
        if (!list.length) list.push({ label: '（沒有技能）', sub: '', disabled: true, hint: '', act: () => {} });
        render('技能', list, top);
      };

      const itemsMenu = () => {
        const inv = G.state.inventory.filter((e) => BATTLE_ITEM_KINDS.has(ITEMS[e.id]?.kind));
        const list = inv.map((e) => {
          const it = ITEMS[e.id];
          return {
            label: it.name, sub: `×${e.qty}`, icon: iconURL(it.icon, it.id), hint: it.desc,
            act: () => {
              if (it.target === 'enemy') pickTarget('enemy', (id) => finish({ kind: 'item', item: it.id, target: id }), itemsMenu);
              else if (it.target === 'ally' || it.kind === 'revive') pickTarget('ally', (id) => finish({ kind: 'item', item: it.id, target: id }), itemsMenu);
              else finish({ kind: 'item', item: it.id });
            },
          };
        });
        if (!list.length) list.push({ label: '（背包是空的）', sub: '', icon: '', hint: '', act: () => {} } as any);
        render('道具', list, top);
      };

      off = input.onPress((b) => {
        if (!this.root || !this.menuEl.isConnected) { off?.(); return false; } // battle UI already gone
        if (!items.length) return true;
        if (b === 'up' || b === 'left') { focus = (focus - 1 + items.length) % items.length; (this as any)._refocus(); audio.sfx('hover'); }
        else if (b === 'down' || b === 'right') { focus = (focus + 1) % items.length; (this as any)._refocus(); audio.sfx('hover'); }
        else if (b === 'confirm' || b === 'jump') items[focus]?.act();
        else if (b === 'cancel' && back) { audio.sfx('cancel'); back(); }
        return true;
      });
      top();
    });
  }
}

function enemyHint(e: Fighter): string {
  const tags: string[] = [];
  if (e.traits.includes('flying')) tags.push('飛行：鎚子打不到');
  if (e.traits.includes('spiky')) tags.push('尖刺：不能踩');
  if (e.traits.includes('armored')) tags.push('裝甲：防禦高');
  if (e.traits.includes('ghost')) tags.push('幽靈：鎚子常打空');
  if (e.traits.includes('fiery')) tags.push('火焰：踩下去會燙');
  return `${e.name}　攻${e.atk} 防${e.def}　${tags.join('，')}`;
}

export const battleUI = new BattleUI();
