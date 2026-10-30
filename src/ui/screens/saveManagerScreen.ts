/** Save management: overview, manual save, JSON export/import, rename, reset (with double confirmation). */
import { bus } from '../../core/events';
import { G } from '../../core/game';
import { formatDate, formatTime } from '../../core/util';
import { chapterByNum } from '../../data/chapters';
import { identity } from '../../systems/identity';
import { prefs } from '../../systems/localPrefs';
import { saves } from '../../systems/saveManager';
import { applyImport, exportCurrentSave, ImportError, readImportFile } from '../../systems/saveIO';
import { validatePlayerName, type SaveData } from '../../systems/saveSchema';
import { audio } from '../../systems/audio';
import { alertDialog, btn, confirmDialog, h, Layer, promptDialog, toast } from '../dom';

export function openSaveManager(): Promise<void> {
  return new Promise((resolve) => {
    const layer = new Layer('screen save-screen');
    const close = () => { layer.close(); resolve(); };
    layer.onCancel = close;
    const body = h('div', { class: 'save-body' });
    const card = h('div', { class: 'paper-card wide' }, h('h2', {}, '存檔管理'), body);
    layer.el.append(card);
    layer.open();

    const inGame = G.mode === 'single' && G.playing;
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
    card.append(fileInput);

    const draw = async () => {
      body.innerHTML = '';
      const slot = saves.current?.slot ?? prefs.lastSlot;
      const s: SaveData | null = saves.current && saves.current.slot === slot ? saves.current : await saves.readSlot(slot);
      body.append(h('div', { class: 'save-summary' },
        h('div', {}, h('b', {}, '玩家名稱：'), identity.name || '—'),
        h('div', {}, h('b', {}, '存檔欄位：'), `第 ${slot} 格`),
        h('div', {}, h('b', {}, '目前章節：'), s ? chapterByNum(s.currentChapter).title : '（沒有存檔）'),
        h('div', {}, h('b', {}, '等級：'), s ? `Lv.${s.playerLevel}` : '—'),
        h('div', {}, h('b', {}, '遊戲時間：'), s ? formatTime(s.totalPlayTime) : '—'),
        h('div', {}, h('b', {}, '最後存檔：'), s ? formatDate(s.savedAt || s.lastPlayedAt) : '—')));
      const slots = await saves.listSlots();
      body.append(h('div', { class: 'slot-mini' }, ...slots.map((x, i) => h('div', { class: `slot-chip${i + 1 === slot ? ' sel' : ''}` }, `第${i + 1}格：${x ? `${x.playerName} 第${x.currentChapter}章 Lv.${x.playerLevel}` : '空'}`))));

      const actions = h('div', { class: 'col' });
      if (inGame) actions.append(btn('[floppy]手動保存', async () => { await saves.write('manual'); void draw(); }, { cls: 'primary' }));
      actions.append(
        btn('[upload]匯出遊戲存檔', async () => {
          try {
            const name = await exportCurrentSave(slot);
            audio.sfx('save');
            await alertDialog('匯出完成', `冒險紀錄已成功保存到你的裝置！\n檔名：${name}`);
          } catch (e) {
            await alertDialog('匯出失敗', (e as Error).message);
          }
        }, { disabled: !s }),
        btn('[download]匯入遊戲存檔', () => { fileInput.value = ''; fileInput.click(); }),
        btn('[pencil]修改玩家名稱', async () => {
          const v = await promptDialog('修改玩家名稱', '新的名稱（1～12 個中文字或英文字母）', identity.name, (x) => { const r = validatePlayerName(x); return r.ok ? null : r.error; });
          if (!v) return;
          const r = identity.rename(v);
          if (!r.ok) return;
          await saves.renameEverywhere(r.name);
          if (G.local) G.local.playerName = r.name;
          toast(`名稱已改為「${r.name}」！遊戲進度沒有任何改變。`, 'good');
          bus.emit('identity:changed');
          void draw();
        }),
        btn('[trash]重設遊戲進度', async () => {
          if (!s) return;
          const ok1 = await confirmDialog('重設遊戲進度', `確定要刪除第 ${slot} 格的冒險紀錄嗎？（${chapterByNum(s.currentChapter).title}・Lv.${s.playerLevel}）`, '刪除', '取消', true);
          if (!ok1) return;
          const ok2 = await confirmDialog('真的要刪除嗎？', '這個動作無法復原！建議先「匯出遊戲存檔」備份。', '確定刪除', '我再想想', true);
          if (!ok2) return;
          await saves.backup(slot, 'pre-reset');
          await saves.resetSlot(slot);
          audio.sfx('break');
          toast('遊戲進度已重設。', 'warn');
          if (inGame) { close(); bus.emit('app:title', { skipSave: true }); return; }
          void draw();
        }, { cls: 'danger', disabled: !s }),
        btn('返回', close, { sfx: 'cancel' }));
      body.append(actions);
      body.append(h('p', { class: 'muted' }, '提示：存檔保存在這個瀏覽器裡。要換電腦或手機玩，請先「匯出」JSON 檔，再到另一台裝置「匯入」。'));
      layer.focusFirst();
    };

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const slot = saves.current?.slot ?? prefs.lastSlot;
      try {
        const pv = await readImportFile(file);
        const info = h('div', { class: 'import-preview' },
          h('div', {}, h('b', {}, '存檔玩家名稱：'), pv.playerName),
          h('div', {}, h('b', {}, '遊戲章節：'), chapterByNum(pv.chapter).title),
          h('div', {}, h('b', {}, '玩家等級：'), `Lv.${pv.level}`),
          h('div', {}, h('b', {}, '最後遊玩時間：'), formatDate(pv.lastPlayedAt)),
          h('div', {}, h('b', {}, '存檔匯出時間：'), formatDate(pv.exportedAt)),
          pv.migratedFrom ? h('div', { class: 'muted' }, `（舊版存檔 v${pv.migratedFrom}，已自動轉換到新格式）`) : null,
          h('p', { class: 'warn-text' }, `將覆蓋第 ${slot} 格的存檔。目前的存檔會先自動備份。`));
        const ok = await confirmDialog('確認匯入', info, '確認匯入', '取消');
        if (!ok) return;
        if (inGame) saves.stopAutosaveTimer();
        await applyImport(pv, slot);
        audio.sfx('levelup');
        await alertDialog('匯入成功', '歡迎回來！你的冒險紀錄已成功恢復！');
        if (inGame) { close(); bus.emit('app:title', { skipSave: true }); return; }
        bus.emit('identity:changed');
        void draw();
      } catch (e) {
        audio.sfx('error');
        await alertDialog('匯入失敗', e instanceof ImportError ? e.message : `無法讀取檔案：${(e as Error).message}`);
        if (inGame) saves.startAutosaveTimer();
      }
    });

    void draw();
  });
}
