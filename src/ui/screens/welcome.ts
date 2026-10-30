/** First launch: create the local player identity (no accounts). */
import { identity } from '../../systems/identity';
import { validatePlayerName } from '../../systems/saveSchema';
import { audio } from '../../systems/audio';
import { portraitURL } from '../../art/textures';
import { btn, h, Layer } from '../dom';

export function openWelcome(): Promise<void> {
  return new Promise((resolve) => {
    const layer = new Layer('screen welcome-screen');
    const inp = h('input', { class: 'text-input name-input nav', maxlength: '12', placeholder: '你的名字', autocomplete: 'off', 'aria-label': '玩家名稱' }) as HTMLInputElement;
    const msg = h('div', { class: 'error-text' });
    let confirmed = false;
    const enter = btn('[play]進入遊戲', () => {
      if (!confirmed) return;
      const r = identity.create(inp.value);
      if (!r.ok) { msg.textContent = r.error; return; }
      audio.sfx('levelup');
      layer.close();
      resolve();
    }, { cls: 'primary big', disabled: true });
    const confirmBtn = btn('確認', () => {
      const v = validatePlayerName(inp.value);
      if (!v.ok) { msg.textContent = v.error; msg.className = 'error-text'; audio.sfx('error'); confirmed = false; enter.setAttribute('disabled', ''); return; }
      inp.value = v.name;
      msg.textContent = `你好，${v.name}！準備好了就按「進入遊戲」吧！`;
      msg.className = 'ok-text';
      confirmed = true;
      enter.removeAttribute('disabled');
      layer.focusFirst();
    });
    inp.addEventListener('input', () => { confirmed = false; enter.setAttribute('disabled', ''); msg.textContent = ''; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { confirmBtn.click(); if (confirmed) setTimeout(() => enter.click(), 250); } });
    layer.el.append(h('div', { class: 'paper-card welcome-card' },
      h('img', { class: 'welcome-mascot', src: portraitURL({ charId: 'mametchi' }, 'happy'), alt: '' }),
      h('h1', {}, '歡迎來到拓麻歌子世界！'),
      h('p', {}, '在開始冒險之前，先告訴我們你叫什麼名字吧！'),
      h('div', { class: 'name-row' }, inp, confirmBtn),
      h('div', { class: 'muted' }, '1～12 個中文字或英文字母（可含數字），不能有空格或符號。'),
      msg,
      enter));
    layer.open();
    setTimeout(() => inp.focus(), 200);
  });
}
