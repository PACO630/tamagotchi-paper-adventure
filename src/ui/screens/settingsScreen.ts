/** Game settings: audio, text, controls, graphics, network (TURN) and storage info. */
import { audio } from '../../systems/audio';
import { settings } from '../../systems/settings';
import type { GameSettings } from '../../systems/saveSchema';
import { btn, h, iconLabel, Layer } from '../dom';
import { openSaveManager } from './saveManagerScreen';

function stepper(label: string, get: () => number, set: (v: number) => void): HTMLElement {
  const val = h('span', { class: 'step-val' });
  const bar = h('i');
  const upd = () => { const v = get(); val.textContent = `${Math.round(v * 100)}%`; bar.style.width = v * 100 + '%'; };
  const minus = btn('－', () => { set(Math.max(0, Math.round((get() - 0.1) * 10) / 10)); upd(); }, { cls: 'small', sfx: 'click' });
  const plus = btn('＋', () => { set(Math.min(1, Math.round((get() + 0.1) * 10) / 10)); upd(); }, { cls: 'small', sfx: 'click' });
  upd();
  return h('div', { class: 'set-row' }, h('label', {}, label), h('div', { class: 'stepper' }, minus, h('div', { class: 'bar vol' }, bar), val, plus));
}

function choice<K extends keyof GameSettings>(label: string, key: K, opts: [GameSettings[K], string][]): HTMLElement {
  const row = h('div', { class: 'choice' });
  const draw = () => {
    row.innerHTML = '';
    for (const [v, t] of opts) {
      row.append(btn(t, () => { settings.update({ [key]: v } as Partial<GameSettings>); draw(); }, { cls: `small chip${settings.current[key] === v ? ' sel' : ''}`, sfx: 'click' }));
    }
  };
  draw();
  return h('div', { class: 'set-row' }, h('label', {}, label), row);
}

export function openSettings(): Promise<void> {
  return new Promise((resolve) => {
    const layer = new Layer('screen settings-screen');
    const close = () => { layer.close(); resolve(); };
    layer.onCancel = close;
    const c = settings.current;
    const turnUrl = h('input', { class: 'text-input', placeholder: 'turn:example.com:3478（選填）', value: c.turnUrl, maxlength: '200' }) as HTMLInputElement;
    const turnUser = h('input', { class: 'text-input', placeholder: '使用者名稱', value: c.turnUser, maxlength: '100' }) as HTMLInputElement;
    const turnPass = h('input', { class: 'text-input', placeholder: '密碼', value: c.turnPass, type: 'password', maxlength: '100' }) as HTMLInputElement;
    const saveTurn = () => settings.update({ turnUrl: turnUrl.value.trim(), turnUser: turnUser.value.trim(), turnPass: turnPass.value });
    for (const i of [turnUrl, turnUser, turnPass]) i.addEventListener('change', saveTurn);
    const storageInfo = h('div', { class: 'muted' }, '正在查詢儲存空間狀態…');
    void (async () => {
      try {
        const persisted = await navigator.storage?.persisted?.();
        const est = await navigator.storage?.estimate?.();
        storageInfo.textContent = `持久性儲存：${persisted ? '已核准' : '未核准（瀏覽器可能在空間不足時清除資料，建議定期匯出存檔）'}${est ? `　已使用 ${(Number(est.usage ?? 0) / 1024 / 1024).toFixed(1)} MB` : ''}`;
      } catch { storageInfo.textContent = '此瀏覽器不支援儲存空間查詢。'; }
    })();
    layer.el.append(h('div', { class: 'paper-card wide settings-card' },
      h('h2', {}, '遊戲設定'),
      h('h3', {}, ...iconLabel('[speaker]聲音')),
      stepper('音樂音量', () => settings.current.musicVolume, (v) => settings.update({ musicVolume: v })),
      stepper('音效音量', () => settings.current.sfxVolume, (v) => { settings.update({ sfxVolume: v }); audio.sfx('coin'); }),
      choice('靜音', 'muted', [[false, '開啟聲音'], [true, '靜音']]),
      h('h3', {}, ...iconLabel('[chat]文字與畫面')),
      choice('文字速度', 'textSpeed', [['slow', '慢'], ['normal', '普通'], ['fast', '快']]),
      choice('畫面品質', 'quality', [['high', '高（天氣特效）'], ['low', '省電']]),
      choice('畫面震動', 'screenShake', [[true, '開'], [false, '關']]),
      h('h3', {}, ...iconLabel('[gamepad]操作')),
      choice('觸控按鈕', 'touchControls', [['auto', '自動'], ['on', '一直顯示'], ['off', '隱藏']]),
      h('h3', {}, ...iconLabel('[globe]多人連線（NAT 穿透）')),
      choice('公用 TURN 中繼', 'useTurn', [[true, '使用'], [false, '不使用']]),
      h('div', { class: 'muted' }, '若 P2P 連線常失敗，可填入自己的 TURN 伺服器：'),
      h('div', { class: 'turn-fields' }, turnUrl, turnUser, turnPass),
      h('h3', {}, ...iconLabel('[floppy]資料')),
      storageInfo,
      h('div', { class: 'row' }, btn('存檔管理（匯出／匯入）', () => void openSaveManager()), btn('完成', () => { saveTurn(); close(); }, { cls: 'primary' }))));
    layer.open();
  });
}
