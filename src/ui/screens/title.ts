/** Main menu, slot picker and player profile. */
import { GAME_TITLE } from '../../core/config';
import { formatDate, formatTime } from '../../core/util';
import { iconURL } from '../../art/iconArt';
import { portraitURL } from '../../art/textures';
import { chapterByNum } from '../../data/chapters';
import { ITEMS, STICKER_COUNT } from '../../data/items';
import { identity } from '../../systems/identity';
import { prefs } from '../../systems/localPrefs';
import { saves } from '../../systems/saveManager';
import type { SaveData } from '../../systems/saveSchema';
import { validatePlayerName } from '../../systems/saveSchema';
import { audio } from '../../systems/audio';
import { btn, confirmDialog, h, Layer, promptDialog, toast } from '../dom';
import { toggleFullscreen } from '../fullscreen';
import { uiIcon } from '../../art/uiIcons';
import { openCredits } from './credits';
import { openHelp } from './help';
import { openSaveManager } from './saveManagerScreen';
import { openSettings } from './settingsScreen';

export type MenuResult = { kind: 'play'; save: SaveData } | { kind: 'multi' };

export function openMainMenu(): Promise<MenuResult> {
  return new Promise((resolve) => {
    audio.playMusic('title');
    const layer = new Layer('screen title-screen');
    const done = (r: MenuResult) => { layer.close(); resolve(r); };
    const build = async () => {
      layer.el.innerHTML = '';
      const slots = await saves.listSlots();
      const last = slots[prefs.lastSlot - 1] ?? slots.find(Boolean) ?? null;
      const hasSave = slots.some(Boolean);
      const returning = hasSave || !identity.justCreated;
      const logo = h('div', { class: 'logo' },
        h('div', { class: 'logo-main' }, ...[...GAME_TITLE].map((ch, i) => h('span', { style: { animationDelay: `${i * 0.08}s` } }, ch))),
        h('div', { class: 'logo-sub' }, 'Tamagotchi Paper Adventure'),
        h('div', { class: 'logo-story' }, '～ 失落的星之心 The Lost Star Heart ～'));
      const greet = h('div', { class: 'greet' }, returning ? `歡迎回來，${identity.name}！` : `你好，${identity.name}！`);
      const menu = h('div', { class: 'main-menu' });
      const play = async (save: SaveData | null) => { if (save) done({ kind: 'play', save }); };
      if (returning && last) {
        menu.append(btn('[play]繼續冒險', async () => play(await saves.load(last.slot)), { cls: 'primary big' }));
        menu.append(h('div', { class: 'continue-info' }, `第${last.slot}格・${chapterByNum(last.currentChapter).title}・Lv.${last.playerLevel}・${formatTime(last.totalPlayTime)}`));
        menu.append(btn('[plus]開始新遊戲', async () => { const s = await pickSlot('new'); if (s) play(s); }));
      } else {
        menu.append(btn('[play]開始冒險', async () => { const s = await saves.newGame(prefs.lastSlot); play(s); }, { cls: 'primary big' }));
      }
      menu.append(
        btn('[person]單人模式', async () => { const s = await pickSlot('any'); if (s) play(s); }),
        btn('[people]多人模式', () => done({ kind: 'multi' })),
        btn('[gear]遊戲設定', () => void openSettings()),
        btn('[folder]存檔管理', () => void openSaveManager().then(build)),
        btn('[question]操作說明', () => void openHelp()),
        btn('[film]製作人員', () => void openCredits()),
      );
      if (returning) menu.insertBefore(btn('[notebook]玩家資料', () => void openProfile().then(build)), menu.querySelector('.btn:nth-last-child(4)'));
      const fs = h('button', { class: 'corner-btn', type: 'button', title: '全螢幕' }, uiIcon('fullscreen'));
      fs.addEventListener('click', () => void toggleFullscreen());
      layer.el.append(h('div', { class: 'title-wrap' }, logo, greet, menu), fs);
      layer.focusFirst();
    };
    layer.open();
    void build();
  });
}

/** Slot picker. mode 'new' = choose a slot for a new game, 'any' = load or start. */
export function pickSlot(mode: 'new' | 'any'): Promise<SaveData | null> {
  return new Promise((resolve) => {
    const layer = new Layer('screen slot-screen', true);
    const done = (v: SaveData | null) => { layer.close(); resolve(v); };
    layer.onCancel = () => done(null);
    const card = h('div', { class: 'paper-card wide' });
    layer.el.append(card);
    const build = async () => {
      card.innerHTML = '';
      card.append(h('h2', {}, mode === 'new' ? '選擇存檔欄位（新遊戲）' : '單人模式：選擇存檔'));
      card.append(h('p', { class: 'muted' }, '單人模式固定使用麻美吉展開冒險。'));
      const slots = await saves.listSlots();
      const grid = h('div', { class: 'slot-grid' });
      slots.forEach((s, i) => {
        const n = i + 1;
        const box = h('div', { class: `slot-card${s ? '' : ' empty'}` });
        if (s) {
          box.append(h('img', { src: portraitURL({ charId: 'mametchi' }, 'happy'), alt: '' }), h('h3', {}, `第 ${n} 格`),
            h('div', {}, chapterByNum(s.currentChapter).title), h('div', {}, `Lv.${s.playerLevel}　遊戲時間 ${formatTime(s.totalPlayTime)}`),
            h('div', { class: 'muted' }, `最後存檔 ${formatDate(s.savedAt || s.lastPlayedAt)}`));
          if (mode === 'any') box.append(btn('讀取', async () => done(await saves.load(n)), { cls: 'primary small' }));
          box.append(btn('覆蓋成新遊戲', async () => {
            if (!(await confirmDialog('覆蓋存檔', `第 ${n} 格的冒險紀錄會被刪除，確定嗎？`, '覆蓋', '取消', true))) return;
            await saves.backup(n, 'pre-overwrite');
            done(await saves.newGame(n));
          }, { cls: 'small danger' }));
        } else {
          box.append(h('h3', {}, `第 ${n} 格`), h('div', { class: 'muted' }, '（空的）'), btn('新遊戲', async () => done(await saves.newGame(n)), { cls: 'primary small' }));
        }
        grid.append(box);
      });
      card.append(grid, h('div', { class: 'row' }, btn('返回', () => done(null), { sfx: 'cancel' })));
      layer.focusFirst();
    };
    layer.open();
    void build();
  });
}

export function openProfile(): Promise<void> {
  return new Promise((resolve) => {
    const layer = new Layer('screen profile-screen');
    const close = () => { layer.close(); resolve(); };
    layer.onCancel = close;
    const card = h('div', { class: 'paper-card wide' });
    layer.el.append(card);
    const build = async () => {
      card.innerHTML = '';
      const slots = (await saves.listSlots()).filter(Boolean) as SaveData[];
      const best = slots.sort((a, b) => b.currentChapter - a.currentChapter || b.playerLevel - a.playerLevel)[0];
      const total = slots.reduce((s, x) => s + x.totalPlayTime, 0);
      const created = slots.reduce((m, x) => Math.min(m, x.createdAt), Date.now());
      card.append(h('h2', {}, '玩家資料'),
        h('div', { class: 'profile-head' }, h('img', { src: portraitURL({ charId: 'mametchi' }, 'happy'), alt: '' }),
          h('div', {}, h('h3', {}, identity.name), h('div', { class: 'muted' }, `玩家 ID：${identity.id.slice(0, 10)}…`),
            h('div', {}, `首次遊玩：${slots.length ? formatDate(created) : '—'}`), h('div', {}, `總遊戲時間：${formatTime(total)}`),
            h('div', {}, `最佳進度：${best ? `${chapterByNum(best.currentChapter).title}・Lv.${best.playerLevel}` : '—'}`),
            best ? h('div', {}, `戰鬥勝利 ${best.stats.battlesWon}・打倒敵人 ${best.stats.enemiesDefeated}・開啟寶箱 ${best.stats.chestsOpened}・完美防禦 ${best.stats.perfectGuards}`) : null)));
      const got = new Set(best?.collectedItems ?? []);
      const grid = h('div', { class: 'sticker-grid' });
      for (let i = 1; i <= STICKER_COUNT; i++) {
        const id = `sticker_${i}`;
        const it = ITEMS[id];
        grid.append(h('div', { class: `sticker${got.has(id) ? '' : ' missing'}`, title: got.has(id) ? it.name : '？？？' }, h('img', { src: iconURL(it.icon, id), alt: '' }), h('small', {}, got.has(id) ? it.name.replace('貼紙：', '') : '？？？')));
      }
      card.append(h('h3', {}, `收藏貼紙 ${[...got].filter((x) => x.startsWith('sticker_')).length}/${STICKER_COUNT}`), grid,
        h('div', { class: 'row' },
          btn('修改名稱', async () => {
            const v = await promptDialog('修改玩家名稱', '新的名稱', identity.name, (x) => { const r = validatePlayerName(x); return r.ok ? null : r.error; });
            if (!v) return;
            const r = identity.rename(v);
            if (r.ok) { await saves.renameEverywhere(r.name); toast('名稱已更新！進度不受影響。', 'good'); void build(); }
          }),
          btn('返回', close, { cls: 'primary', sfx: 'cancel' })));
      layer.focusFirst();
    };
    layer.open();
    void build();
  });
}
