/** Fullscreen + landscape lock helpers (best effort; iOS Safari ignores both). */
export async function toggleFullscreen(): Promise<void> {
  const doc = document as any;
  try {
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as any;
    await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
    const o = (screen as any).orientation;
    if (o?.lock) await o.lock('landscape').catch(() => {});
  } catch {
    /* not supported */
  }
}
