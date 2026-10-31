/** Multiplayer lobby: create/join room, room code, roster with status, unique character selection. */
import { bus } from '../../core/events';
import { G } from '../../core/game';
import { portraitURL } from '../../art/textures';
import { uiIcon } from '../../art/uiIcons';
import { CHAPTERS } from '../../data/chapters';
import { CHAR_IDS, CHARACTERS } from '../../data/characters';
import type { CharId } from '../../data/types';
import { session } from '../../net/session';
import { audio } from '../../systems/audio';
import { saves } from '../../systems/saveManager';
import { alertDialog, btn, confirmDialog, h, Layer, toast } from '../dom';

/** Opens the lobby flow. Resolves 'start' when the game begins, or 'back'. */
export function openLobby(): Promise<'start' | 'back'> {
  return new Promise((resolve) => {
    audio.playMusic('lobby');
    const layer = new Layer('screen lobby-screen');
    const card = h('div', { class: 'paper-card wide lobby-card' });
    layer.el.append(card);
    let offs: (() => void)[] = [];
    const finish = (v: 'start' | 'back') => { offs.forEach((o) => o()); offs = []; layer.close(); resolve(v); };

    const entry = () => {
      layer.onCancel = () => finish('back');
      card.innerHTML = '';
      const codeInput = h('input', { class: 'text-input code-input nav', maxlength: '6', placeholder: '房間代碼', autocomplete: 'off', autocapitalize: 'characters' }) as HTMLInputElement;
      const status = h('div', { class: 'net-status' });
      const busy = (b: boolean, text = '') => { status.textContent = text; card.classList.toggle('busy', b); };
      card.append(
        h('h2', {}, '多人模式'),
        h('p', {}, '透過 P2P（WebRTC）和朋友一起冒險，最多 4 人。不需要帳號，也沒有遊戲伺服器。'),
        h('div', { class: 'lobby-entry' },
          h('div', { class: 'lobby-box' }, h('h3', {}, '建立房間'), h('p', { class: 'muted' }, '你會成為房主，負責推進劇情。'),
            btn('建立房間', async () => {
              busy(true, '正在建立房間…');
              try { await session.createRoom(); room(); }
              catch (e) { busy(false); await alertDialog('建立失敗', (e as Error).message); }
            }, { cls: 'primary' })),
          h('div', { class: 'lobby-box' }, h('h3', {}, '加入房間'), h('p', { class: 'muted' }, '輸入朋友給你的 6 位房間代碼。'), codeInput,
            btn('加入', async () => {
              busy(true, '正在連線…（最多約 12 秒）');
              try { await session.joinRoom(codeInput.value); room(); }
              catch (e) { busy(false); await alertDialog('加入失敗', (e as Error).message); }
            }))),
        status,
        h('div', { class: 'row' }, btn('返回', () => finish('back'), { sfx: 'cancel' })));
      codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      layer.focusFirst();
    };

    const room = () => {
      // the create/join step marked the card busy (buttons disabled); the room view must be interactive
      card.classList.remove('busy');
      card.innerHTML = '';
      const rosterEl = h('div', { class: 'roster' });
      const chars = h('div', { class: 'char-grid' });
      const footer = h('div', { class: 'row' });
      const chapterRow = h('div', { class: 'row tight' });
      const leave = async () => {
        const msg = session.isHost ? '解散房間？所有玩家都會離開。' : '離開房間？';
        if (!(await confirmDialog(session.isHost ? '解散房間' : '離開房間', msg, session.isHost ? '解散' : '離開', '取消', true))) return;
        if (session.isHost) session.dissolve(); else session.leave();
        entry();
      };
      layer.onCancel = () => void leave();
      const codeEl = h('div', { class: 'room-code', title: '點擊複製' }, session.room);
      codeEl.addEventListener('click', () => { void navigator.clipboard?.writeText(session.room).then(() => toast('房間代碼已複製！', 'good')); });
      card.append(h('h2', {}, session.isHost ? '你的房間' : '已加入房間'), h('div', { class: 'room-head' }, h('span', {}, '房間代碼'), codeEl, h('span', { class: 'muted' }, '把代碼告訴朋友！')), rosterEl, h('h3', {}, session.isHost ? `選擇角色（房主固定是${CHARACTERS.mametchi.name}，朋友選其他角色）` : '選擇角色（每人不能重複，麻每吉是房主）'), chars, chapterRow, footer);

      const draw = () => {
        rosterEl.innerHTML = '';
        for (let i = 0; i < 4; i++) {
          const r = session.roster[i];
          if (!r) { rosterEl.append(h('div', { class: 'roster-slot empty' }, '等待玩家加入…')); continue; }
          rosterEl.append(h('div', { class: `roster-slot${r.key === session.localKey ? ' me' : ''}` },
            r.charId ? h('img', { src: portraitURL({ charId: r.charId }, 'happy'), alt: '' }) : h('div', { class: 'no-char' }, '?'),
            h('div', {}, h('b', {}, r.name, r.isHost ? uiIcon('crown') : null), h('div', { class: 'muted' }, `Lv.${r.level}　${r.charId ? CHARACTERS[r.charId].name : '選擇中…'}`)),
            h('span', { class: `conn ${r.connected ? 'on' : 'off'}` }, h('i', { class: 'dot' }), r.connected ? '連線中' : '斷線')));
        }
        chars.innerHTML = '';
        const mine = session.me()?.charId ?? null;
        for (const id of CHAR_IDS) {
          const owner = session.roster.find((r) => r.charId === id);
          const taken = !!owner && owner.key !== session.localKey;
          const b = btn('', () => {
            if (session.isHost) { audio.sfx(id === 'mametchi' ? 'click' : 'error'); if (id !== 'mametchi') toast(`房主固定是${CHARACTERS.mametchi.name}！其他角色給朋友選，或在冒險中加入當跟班。`, 'info', 2400); return; }
            if (taken) { audio.sfx('error'); toast(`${owner!.name} 已經選了 ${CHARACTERS[id].name}！`, 'warn'); return; }
            session.pickChar(mine === id ? null : (id as CharId));
            audio.sfx('join');
          }, { cls: `char-pick${mine === id ? ' sel' : ''}${taken ? ' taken' : ''}`, sfx: 'click' });
          b.append(h('img', { src: portraitURL({ charId: id }, mine === id ? 'happy' : 'normal'), alt: '' }), h('b', {}, CHARACTERS[id].name), h('small', {}, taken ? `${owner!.name} 已選` : CHARACTERS[id].title));
          chars.append(b);
        }
        chapterRow.innerHTML = '';
        if (session.isHost) {
          const max = Math.max(G.local?.mpHighestChapter ?? 1, G.local?.currentChapter ?? 1);
          chapterRow.append(h('span', {}, '開始章節：'));
          for (const c of CHAPTERS.slice(0, Math.min(8, max))) chapterRow.append(btn(`第${c.num}章`, () => { session.setChapter(c.num); draw(); }, { cls: `small chip${session.chapter === c.num ? ' sel' : ''}`, sfx: 'click' }));
        } else chapterRow.append(h('span', { class: 'muted' }, `房主選擇的章節：${CHAPTERS[session.chapter - 1]?.title ?? ''}`));
        footer.innerHTML = '';
        footer.append(btn(session.isHost ? '解散房間' : '離開房間', () => void leave(), { cls: 'danger', sfx: 'cancel' }));
        if (session.isHost) {
          const err = session.canStart();
          footer.append(btn('開始遊戲', () => {
            try { session.startGame(); } catch (e) { void alertDialog('還不能開始', (e as Error).message); }
          }, { cls: 'primary', disabled: !!err, title: err ?? '' }));
          if (err) footer.append(h('span', { class: 'muted' }, err));
        } else footer.append(h('span', { class: 'muted' }, '等待房主開始遊戲…'));
      };
      offs.push(bus.on('net:roster', draw));
      offs.push(bus.on('net:dissolved', () => { void alertDialog('房間已關閉', '房間已經解散或連線中斷了。'); entry(); }));
      offs.push(bus.on('net:start', () => finish('start')));
      draw();
      layer.focusFirst();
    };

    layer.open();
    if (!saves.current) toast('多人模式的經驗值會保存到你的存檔。', 'info');
    entry();
  });
}
