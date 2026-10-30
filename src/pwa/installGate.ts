/**
 * Phones must play the installed web app (home-screen PWA): it runs full screen, keeps the
 * landscape orientation and its own storage. Opening the game in a phone browser shows this
 * gate with platform-specific install steps instead of starting the game.
 */
import { isPhone } from '../core/device';
import { uiIcon, type UiIconName } from '../art/uiIcons';
import { portraitURL } from '../art/textures';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const onDeferred: (() => void)[] = [];

// Chrome / Edge / Samsung Internet on Android hand us an install prompt we can trigger from a button.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  onDeferred.forEach((f) => f());
});

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: fullscreen)').matches
    || matchMedia('(display-mode: minimal-ui)').matches
    || (navigator as any).standalone === true;
}

/** ?nopwa=1 skips the gate (automated testing only). */
export function needsInstall(): boolean {
  if (new URLSearchParams(location.search).has('nopwa')) return false;
  return isPhone() && !isStandalone();
}

type Platform = 'ios' | 'android' | 'inapp' | 'other';

function platform(): Platform {
  const ua = navigator.userAgent;
  if (/Line\/|FBAN|FBAV|Instagram|MicroMessenger|Twitter|; wv\)/i.test(ua)) return 'inapp';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

function step(n: number, icon: UiIconName | null, ...text: (Node | string)[]): HTMLElement {
  return el('li', 'ig-step', el('span', 'ig-num', String(n)), icon ? uiIcon(icon) : null, el('span', 'ig-text', ...text));
}

/** Shows the gate. The game is not started while it is visible. */
export function showInstallGate(): void {
  document.getElementById('boot-splash')?.remove();
  const p = platform();
  const steps = el('ol', 'ig-steps');
  const action = el('div', 'ig-action');
  const note = el('p', 'ig-note');

  const renderAndroidButton = () => {
    action.innerHTML = '';
    if (!deferred) return;
    const b = el('button', 'btn primary big ig-install', uiIcon('download'), el('span', '', '安裝遊戲'));
    b.addEventListener('click', async () => {
      const ev = deferred;
      if (!ev) return;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      deferred = null;
      if (outcome === 'accepted') {
        action.innerHTML = '';
        action.append(el('div', 'ig-done', uiIcon('check'), el('span', '', '安裝完成！請到手機主畫面點開「紙片大冒險」開始遊戲。')));
      } else renderAndroidButton();
    });
    action.append(b);
  };

  if (p === 'ios') {
    steps.append(
      step(1, 'share', '用 ', el('b', '', 'Safari'), ' 開啟這個網頁，點下方工具列的「分享」按鈕'),
      step(2, 'addSquare', '往下滑，選擇「', el('b', '', '加入主畫面'), '」'),
      step(3, 'check', '點右上角「', el('b', '', '新增'), '」'),
      step(4, 'play', '回到主畫面，點開「', el('b', '', '紙片大冒險'), '」圖示開始遊戲'),
    );
  } else if (p === 'android') {
    steps.append(
      step(1, 'download', '點下方的「', el('b', '', '安裝遊戲'), '」按鈕；如果沒有出現，點瀏覽器右上角的選單'),
      step(2, 'dots', '在選單中選擇「', el('b', '', '安裝應用程式'), '」或「', el('b', '', '加到主畫面'), '」'),
      step(3, 'play', '回到主畫面，點開「', el('b', '', '紙片大冒險'), '」圖示開始遊戲'),
    );
    renderAndroidButton();
    onDeferred.push(renderAndroidButton);
  } else if (p === 'inapp') {
    steps.append(
      step(1, 'dots', '你正在 App 內建的瀏覽器裡，請點右上角選單'),
      step(2, 'globe', '選擇「', el('b', '', '用瀏覽器開啟'), '」（iPhone 請用 Safari，Android 請用 Chrome）'),
      step(3, 'addSquare', '再依照畫面提示把遊戲「', el('b', '', '加入主畫面'), '」'),
    );
  } else {
    steps.append(
      step(1, 'dots', '點瀏覽器的選單'),
      step(2, 'addSquare', '選擇「', el('b', '', '安裝應用程式'), '」或「', el('b', '', '加到主畫面'), '」'),
      step(3, 'play', '從主畫面點開「', el('b', '', '紙片大冒險'), '」開始遊戲'),
    );
  }
  note.append('安裝後遊戲會以全螢幕、橫向方式執行。已經有存檔的話，可以先在電腦或其他裝置「匯出遊戲存檔」，再到安裝好的 App 裡「匯入」。');

  const mascot = el('img', 'ig-mascot');
  try { mascot.src = portraitURL({ charId: 'mametchi' }, 'happy'); } catch { /* art not ready */ }
  const card = el('div', 'paper-card ig-card',
    mascot,
    el('h1', '', '把遊戲加到主畫面吧！'),
    el('p', 'ig-lead', '在手機上，請先把《拓麻歌子紙片大冒險》安裝成網頁 App，才能用全螢幕橫向模式正常遊玩。'),
    action,
    steps,
    note);
  const gate = el('div', 'install-gate', card);
  document.body.append(gate);

  // If the app gets launched in standalone later (e.g. Android opens it right after installing), reload into the game.
  matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => { if (e.matches) location.reload(); });
}
