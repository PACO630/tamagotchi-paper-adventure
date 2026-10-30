/** In-game menu: bag, status, skills, quests, map, partners and system. */
import { bus } from '../../core/events';
import { G } from '../../core/game';
import { formatTime } from '../../core/util';
import { iconURL } from '../../art/iconArt';
import { portraitURL } from '../../art/textures';
import { CHAPTERS } from '../../data/chapters';
import { CHARACTERS, expToNext } from '../../data/characters';
import { ITEMS, STICKER_COUNT } from '../../data/items';
import { QUESTS } from '../../data/quests';
import { SKILLS } from '../../data/skills';
import type { CharId } from '../../data/types';
import { audio } from '../../systems/audio';
import { CATEGORY, itemsOf, toggleBadge, useFieldItem } from '../../systems/inventory';
import { saves } from '../../systems/saveManager';
import { BADGE_SLOTS } from '../../systems/saveSchema';
import { btn, confirmDialog, h, Layer, toast } from '../dom';
import { openTutorial } from './tutorial';
import { uiIcon } from '../../art/uiIcons';
import { openSaveManager } from './saveManagerScreen';
import { openSettings } from './settingsScreen';

type Tab = 'bag' | 'status' | 'skills' | 'quests' | 'map' | 'partners' | 'system';
const TABS: [Tab, string][] = [['bag', '[bag]背包'], ['status', '[clipboard]角色狀態'], ['skills', '[sparkle]技能'], ['quests', '[scroll]任務'], ['map', '[map]地圖'], ['partners', '[friends]夥伴'], ['system', '[gear]系統']];

let open = false;

export function openPauseMenu(_world: unknown): Promise<void> {
  if (open) return Promise.resolve();
  open = true;
  return new Promise((resolve) => {
    const layer = new Layer('screen pause-menu');
    const body = h('div', { class: 'pm-body' });
    const tabs = h('div', { class: 'pm-tabs' });
    let current: Tab = 'bag';
    const close = () => { open = false; layer.close(); bus.emit('hud:dirty'); resolve(); };
    layer.onCancel = close;
    const select = (t: Tab) => {
      current = t;
      [...tabs.children].forEach((c, i) => c.classList.toggle('sel', TABS[i][0] === t));
      body.innerHTML = '';
      render[t](body, () => select(current), close);
      layer.focusFirst();
    };
    for (const [t, label] of TABS) {
      if (t === 'partners' && G.mode !== 'single') continue;
      tabs.append(btn(label, () => select(t), { cls: 'pm-tab', sfx: 'click' }));
    }
    layer.el.append(h('div', { class: 'paper-card pm-card' }, h('div', { class: 'pm-head' }, h('h2', {}, '選單'), btn('[close]關閉', close, { cls: 'small', sfx: 'cancel' })), tabs, body));
    layer.open();
    select('bag');
  });
}

const render: Record<Tab, (el: HTMLElement, refresh: () => void, close: () => void) => void> = {
  bag(el, refresh) {
    let cat = Object.keys(CATEGORY)[0];
    const list = h('div', { class: 'bag-list' });
    const info = h('div', { class: 'bag-info' }, '選擇一個道具查看說明。');
    const cats = h('div', { class: 'row tight' });
    const draw = () => {
      list.innerHTML = '';
      [...cats.children].forEach((c) => c.classList.toggle('sel', c.textContent === cat));
      const items = itemsOf(CATEGORY[cat]);
      if (!items.length) list.append(h('div', { class: 'muted' }, '（空空的）'));
      for (const e of items) {
        const equipped = G.state.equipment.badges.includes(e.id);
        const row = btn('', () => {
          info.innerHTML = '';
          info.append(h('img', { src: iconURL(e.def.icon, e.id), class: 'big-icon', alt: '' }), h('h3', {}, e.def.name), h('p', {}, e.def.desc));
          if (e.def.fieldUse) {
            const party = G.buildParty();
            const targets = e.def.target === 'allAllies' ? [{ key: party[0].key, name: '全隊' }] : party.map((m) => ({ key: m.key, name: m.name }));
            info.append(h('div', { class: 'row tight' }, ...targets.map((t) => btn(`對 ${t.name} 使用`, () => {
              const err = useFieldItem(e.id, t.key);
              if (err) toast(err, 'warn'); else toast(`使用了 ${e.def.name}！`, 'good');
              draw();
            }, { cls: 'small' }))));
          }
          if (e.def.kind === 'badge') {
            if (G.mode !== 'single') info.append(h('p', { class: 'muted' }, '多人模式中徽章由各自的存檔決定。'));
            else info.append(btn(equipped ? '卸下徽章' : '裝備徽章', () => {
              const err = toggleBadge(e.id);
              if (err) toast(err, 'warn'); else audio.sfx('buff');
              draw();
            }, { cls: 'small primary' }));
          }
        }, { cls: `bag-row${equipped ? ' equipped' : ''}`, sfx: 'click' });
        row.append(h('img', { src: iconURL(e.def.icon, e.id), alt: '' }), h('span', { class: 'bag-name' }, e.def.name + (equipped ? '（裝備中）' : '')), h('span', { class: 'bag-qty' }, `×${e.qty}`));
        list.append(row);
      }
    };
    for (const c of Object.keys(CATEGORY)) cats.append(btn(c, () => { cat = c; draw(); }, { cls: 'small chip', sfx: 'click' }));
    const stickers = G.state.collectedItems.filter((i) => i.startsWith('sticker_')).length;
    el.append(cats, h('div', { class: 'bag-wrap' }, list, info), h('div', { class: 'muted icon-row' }, uiIcon('coin'), `${G.state.coins}　｜　收藏貼紙 ${stickers}/${STICKER_COUNT}　｜　徽章欄 ${G.state.equipment.badges.length}/${BADGE_SLOTS}`));
    draw();
    void refresh;
  },

  status(el) {
    const party = G.buildParty();
    const grid = h('div', { class: 'status-grid' });
    for (const m of party) {
      const c = CHARACTERS[m.charId];
      grid.append(h('div', { class: 'status-card' },
        h('img', { src: portraitURL({ charId: m.charId }, 'happy'), alt: '' }),
        h('div', {},
          h('h3', {}, `${m.name}　Lv.${m.level}`), h('div', { class: 'muted' }, c.title),
          h('div', {}, `HP ${m.hp}/${m.stats.maxHP}　SP ${m.sp}/${m.stats.maxSP}`),
          h('div', {}, `攻擊力 ${m.stats.atk}　防禦力 ${m.stats.def}`),
          h('div', { class: 'muted' }, c.desc))));
    }
    el.append(grid);
    if (G.local) {
      const need = expToNext(G.local.playerLevel);
      el.append(h('div', { class: 'exp-row' }, `經驗值 ${G.local.playerExp} / ${need}`, h('div', { class: 'bar exp' }, h('i', { style: { width: (G.local.playerExp / need) * 100 + '%' } }))));
      el.append(h('div', { class: 'muted' }, `遊戲時間 ${formatTime(G.local.totalPlayTime)}　戰鬥勝利 ${G.local.stats.battlesWon}　完美防禦 ${G.local.stats.perfectGuards}`));
    }
    const badges = G.state.equipment.badges.map((b) => ITEMS[b]?.name).filter(Boolean);
    el.append(h('div', {}, `裝備中的徽章：${badges.length ? badges.join('、') : '（無）'}`));
  },

  skills(el) {
    const party = G.buildParty();
    for (const m of party) {
      const c = CHARACTERS[m.charId];
      el.append(h('h3', {}, `${m.name}　（${c.fieldAbility}）`));
      const list = h('div', { class: 'skill-list' });
      list.append(h('div', { class: 'skill-row' }, h('b', {}, '鎚子攻擊／跳躍攻擊'), h('span', {}, '所有角色都會的基本攻擊。')));
      for (const s of c.skills) {
        const sk = SKILLS[s.id];
        const got = m.level >= s.level;
        list.append(h('div', { class: `skill-row${got ? '' : ' locked'}` }, h('b', {}, got ? `${sk.name}（SP ${sk.sp}）` : `？？？（Lv.${s.level} 解鎖）`), h('span', {}, got ? sk.desc : '繼續冒險就能學會。')));
      }
      el.append(list);
    }
  },

  quests(el) {
    const active = G.state.activeQuests.map((q) => QUESTS[q.id]).filter(Boolean);
    const done = G.state.completedQuests.map((q) => QUESTS[q]).filter(Boolean);
    el.append(h('h3', {}, '進行中'));
    if (!active.length) el.append(h('div', { class: 'muted' }, '目前沒有任務。'));
    for (const q of active) el.append(h('div', { class: `quest-row ${q.type}` }, h('span', { class: 'tag' }, q.type === 'main' ? '主線' : '支線'), h('b', {}, q.title), h('div', {}, q.desc)));
    el.append(h('h3', {}, `已完成（${done.length}）`));
    for (const q of done.slice(-12).reverse()) el.append(h('div', { class: 'quest-row done' }, h('span', { class: 'tag' }, uiIcon('check')), h('b', {}, q.title)));
  },

  map(el) {
    const cur = G.state.currentChapter;
    const cd = CHAPTERS[cur - 1];
    el.append(h('h3', {}, `目前位置：${cd.location}`));
    const m = h('div', { class: 'big-map' });
    const world = G.game.scene.getScene('World') as any;
    for (const n of cd.mapNodes) m.append(h('div', { class: 'big-node', style: { left: (n.x / cd.width) * 92 + 4 + '%' } }, h('i', {}), h('span', {}, n.name)));
    m.append(h('div', { class: 'big-me', style: { left: ((world?.playerX ?? 0) / cd.width) * 92 + 4 + '%' } }, uiIcon('more')));
    el.append(m);
    el.append(h('h3', {}, '拓麻歌子星球'));
    const chapters = h('div', { class: 'chapter-list' });
    for (const c of CHAPTERS) {
      const unlocked = G.state.unlockedAreas.includes(c.id);
      const shard = G.state.inventory.some((e) => e.id === `shard${c.num}`);
      chapters.append(h('div', { class: `chapter-row${unlocked ? '' : ' locked'}${c.num === cur ? ' here' : ''}` }, h('b', {}, unlocked ? c.title : `第${c.num}章：？？？`), h('span', {}, unlocked ? c.location : '尚未解鎖'), h('span', {}, ...(shard ? [uiIcon('shard'), '碎片'] : []))));
    }
    el.append(chapters);
  },

  partners(el, refresh) {
    const s = G.state;
    if (!s.partners.unlocked.length) { el.append(h('p', { class: 'muted' }, '還沒有夥伴。繼續冒險，就會遇到願意同行的朋友！')); return; }
    el.append(h('p', {}, '選擇一位夥伴一起行動（戰鬥中也會參戰）。'));
    const grid = h('div', { class: 'partner-grid' });
    for (const p of s.partners.unlocked as CharId[]) {
      const active = s.partners.active === p;
      const b = btn('', () => { G.dispatch({ a: 'setPartner', partner: p }); audio.sfx('join'); refresh(); }, { cls: `partner-card${active ? ' sel' : ''}` });
      b.append(h('img', { src: portraitURL({ charId: p }, active ? 'happy' : 'normal'), alt: '' }), h('b', {}, CHARACTERS[p].name), h('small', {}, active ? '同行中' : CHARACTERS[p].fieldAbility));
      grid.append(b);
    }
    el.append(grid);
  },

  system(el, _refresh, close) {
    const col = h('div', { class: 'col' });
    if (G.mode === 'single') col.append(btn('[floppy]手動保存', async () => { await saves.write('manual'); }));
    col.append(
      btn('[gear]遊戲設定', () => void openSettings()),
      btn('[folder]存檔管理（匯出／匯入）', () => void openSaveManager()),
      btn('[question]操作說明', () => void openTutorial()),
      btn('[house]返回主選單', async () => {
        const ok = await confirmDialog('返回主選單', G.mode === 'single' ? '目前進度會自動保存。確定要返回主選單嗎？' : '離開多人遊戲並返回主選單？');
        if (ok) { close(); bus.emit('app:title'); }
      }, { sfx: 'cancel' }),
    );
    el.append(col);
  },
};
