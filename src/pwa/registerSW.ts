/** Service worker registration (production only) + persistent storage request. */
import { toast } from '../ui/dom';
import { G } from '../core/game';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      // look for a newer version every time the game is opened / brought back
      void reg.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void reg.update().catch(() => undefined); });
      // the new version took over while nobody is playing yet (title screen): switch to it right away
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || G.mode !== 'none') return;
        reloading = true;
        location.reload();
      });
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            // a new version is ready; it takes over on next launch (saves in IndexedDB are untouched)
            toast('遊戲有新版本！重新開啟後就會更新（存檔不受影響）。', 'info', 5000);
            w.postMessage('SKIP_WAITING');
          }
        });
      });
    } catch (e) {
      console.warn('SW registration failed', e);
    }
  });
}

/** Ask the browser to keep our IndexedDB data; never assume it's granted. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
