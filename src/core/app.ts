/** Top-level flow controller: boot → welcome → main menu → single / multiplayer → back to title. */
import Phaser from 'phaser';
import { BattleScene } from '../battle/battleScene';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { SKILLS } from '../data/skills';
import { input } from '../input/input';
import { session } from '../net/session';
import { registerServiceWorker, requestPersistence } from '../pwa/registerSW';
import { needsInstall, showInstallGate } from '../pwa/installGate';
import { initRotateLock, refreshRotateLock } from '../ui/rotateLock';
import { BootScene } from '../scenes/bootScene';
import { TitleScene } from '../scenes/titleScene';
import { OpeningScene } from '../scenes/openingScene';
import { audio } from '../systems/audio';
import { identity } from '../systems/identity';
import { prefs } from '../systems/localPrefs';
import { saves } from '../systems/saveManager';
import type { SaveData } from '../systems/saveSchema';
import { settings } from '../systems/settings';
import { dialogue } from '../ui/dialogueBox';
import { alertDialog, toast } from '../ui/dom';
import { openLobby } from '../ui/screens/lobby';
import { openMainMenu } from '../ui/screens/title';
import { openWelcome } from '../ui/screens/welcome';
import { touch } from '../ui/touch';
import { WorldScene } from '../world/worldScene';
import { FONT_FAMILY, GAME_H, GAME_W } from './config';
import { isCoarse, isPhone, viewWidth } from './device';
import { CHAPTERS } from '../data/chapters';
import { ENEMIES } from '../data/enemies';
import { wait } from './util';
import { bus } from './events';
import { G } from './game';

/** True when the system already has PingFang TC (Apple devices) — no web font needed. */
function hasPingFang(): boolean {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return false;
  const t = '麻美吉的冒險';
  g.font = '20px monospace';
  const a = g.measureText(t).width;
  g.font = '20px "PingFang TC", monospace';
  return g.measureText(t).width !== a;
}

/**
 * On devices without PingFang the web font is served in unicode-range slices; load the slices
 * for every glyph the game uses so canvas text (Phaser) draws with it too. Never blocks long.
 */
async function loadFonts(): Promise<void> {
  if (!document.fonts?.load || hasPingFang()) return;
  const msg = document.getElementById('boot-msg');
  if (msg) msg.textContent = '準備字體…';
  const corpus = JSON.stringify([CHAPTERS, ITEMS, SKILLS, QUESTS, ENEMIES]) + document.body.innerText;
  const glyphs = [...new Set(corpus.replace(/[\x00-\x7f]/g, ''))].join('') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.';
  const all = Promise.all([400, 500, 700].map((w) => document.fonts.load(`${w} 24px "${FONT_FAMILY}"`, glyphs))).catch(() => []);
  await Promise.race([all, wait(4000)]);
}

class App {
  private inMenu = false;

  async boot(): Promise<void> {
    settings.load();
    // phones must run the installed (home-screen) web app; in a phone browser show install steps instead
    if (needsInstall()) {
      registerServiceWorker();
      showInstallGate();
      return;
    }
    if (import.meta.env.DEV) (window as any).__tpa = { G, input, saves, session, bus };
    input.init();
    audio.init();
    touch.init();
    registerServiceWorker();
    void requestPersistence();
    this.wireEvents();
    saves.installLifecycleSaves(() => G.playing && G.mode === 'single');
    window.addEventListener('pagehide', () => { if (G.mode === 'multi') session.leave(true); });

    initRotateLock();
    await loadFonts();
    const boot = new BootScene();
    G.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: viewWidth(),
      height: GAME_H,
      backgroundColor: '#2b1d14',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
      fps: { target: 60, smoothStep: true, forceSetTimeOut: new URLSearchParams(location.search).has('sto') },
      input: { keyboard: false, mouse: true, touch: true },
      scene: [boot, TitleScene, WorldScene, BattleScene, OpeningScene],
      banner: false,
    });
    const layout = () => {
      const c = G.game.canvas?.getBoundingClientRect();
      if (!c) return;
      const st = document.documentElement.style;
      st.setProperty('--gx', `${c.left}px`);
      st.setProperty('--gy', `${c.top}px`);
      st.setProperty('--gw', `${c.width}px`);
      st.setProperty('--gh', `${c.height}px`);
      st.setProperty('--u', `${Math.max(0.45, c.height / GAME_H)}`);
      document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
      document.body.classList.toggle('phone', isPhone());
      document.body.classList.toggle('coarse', isCoarse());
    };
    const orient = () => {
      // portrait: game on top, touch controls in the free space below; landscape: centered
      const portrait = window.innerHeight > window.innerWidth;
      const want = portrait ? Phaser.Scale.CENTER_HORIZONTALLY : Phaser.Scale.CENTER_BOTH;
      const w = viewWidth();
      if (G.game.scale.gameSize.width !== w) G.game.scale.setGameSize(w, GAME_H);
      if (G.game.scale.autoCenter !== want) { G.game.scale.autoCenter = want; G.game.scale.refresh(); }
      requestAnimationFrame(layout);
    };
    window.addEventListener('resize', () => setTimeout(orient, 60));
    G.game.scale.on('resize', () => requestAnimationFrame(layout));
    window.addEventListener('resize', () => setTimeout(layout, 60));
    window.addEventListener('orientationchange', () => setTimeout(layout, 300));
    await new Promise<void>((r) => { boot.onDone = r; });
    orient();
    refreshRotateLock();
    const splash = document.getElementById('boot-splash');
    splash?.classList.add('hide');
    setTimeout(() => splash?.remove(), 600);
    if (!identity.exists) {
      G.game.scene.start('Title');
      await openWelcome();
    }
    void this.title();
  }

  private wireEvents(): void {
    bus.on('save:done', (reason: string) => { if (reason !== 'leave') toast('遊戲進度已保存！', 'save', 1600); audio.sfx('save'); });
    bus.on('save:error', () => toast('存檔失敗！請檢查瀏覽器的儲存空間，並記得匯出備份。', 'warn', 4000));
    bus.on('autosave', (reason: string) => { if (G.mode === 'single') saves.requestAutosave(reason); else if (G.local) saves.requestAutosave(reason); });
    bus.on('exp:apply', (n: number) => G.applyExp(n));
    bus.on('stats:changed', () => { if (G.mode === 'multi') session.pushLocalStats(); });
    bus.on('item:gained', (id: string, qty: number) => { if (G.playing) { toast(`取得 ${ITEMS[id]?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}！`, 'good', 1800); audio.sfx('item'); } });
    bus.on('coins:gained', (n: number) => { toast(`取得金幣 ${n}！`, 'good', 1400); audio.sfx('coin'); });
    bus.on('quest:started', (id: string) => { toast(`新任務：${QUESTS[id]?.title}`, 'quest', 2600); audio.sfx('menu'); });
    bus.on('quest:completed', (id: string) => { toast(`任務完成：${QUESTS[id]?.title}！`, 'quest', 2800); audio.sfx('quest'); });
    bus.on('levelup', (d: { level: number; newSkills: string[] }) => {
      toast(`等級提升！Lv.${d.level}${d.newSkills.length ? `　學會「${d.newSkills.map((s) => SKILLS[s]?.name).join('、')}」` : ''}`, 'quest', 3000);
    });
    bus.on('area:unlocked', (n: number) => { if (n > 1) toast(`第 ${n} 章已解鎖！`, 'quest'); });
    bus.on('equip:changed', () => bus.emit('stats:changed'));
    bus.on('net:useItem', (item: string, target: string) => session.useItem(item, target));
    bus.on('net:status', (t: string) => toast(t, 'warn', 3000));
    bus.on('app:title', (o?: { skipSave?: boolean }) => void this.title(o?.skipSave));
    bus.on('app:loadLast', () => void this.loadLast());
    bus.on('net:start', (state: SaveData) => void this.startMulti(state));
    bus.on('net:dissolved', () => { if (G.mode === 'multi' && G.playing) { void alertDialog('多人遊戲結束', '房間已解散或連線中斷，你的等級與經驗值已保存。').then(() => this.title()); } });
    bus.on('net:becameHost', () => { dialogue.hide(); });
  }

  private stopGameScenes(): void {
    for (const k of ['World', 'Battle']) if (G.game.scene.isActive(k) || G.game.scene.isPaused(k)) G.game.scene.stop(k);
  }

  async title(skipSave = false): Promise<void> {
    if (this.inMenu) return;
    this.inMenu = true;
    try {
      if (G.mode === 'single' && G.playing && !skipSave) await saves.write('title');
      if (G.mode === 'multi') { if (G.local) await saves.write('title', true); session.leave(); }
      saves.stopAutosaveTimer();
      dialogue.hide();
      this.stopGameScenes();
      G.stop();
      touch.setActive(false);
      document.querySelectorAll('#ui .layer, #ui .hud, #ui .battle-ui').forEach((e) => e.remove());
      input.clearBlockers();
      if (!G.game.scene.isActive('Title')) G.game.scene.start('Title');
      for (;;) {
        const r = await openMainMenu();
        if (r.kind === 'play') { this.startSingle(r.save); return; }
        // multiplayer: make sure a local save exists for EXP/levels
        if (!saves.current) {
          saves.current = (await saves.load(prefs.lastSlot)) ?? (await saves.newGame(prefs.lastSlot));
        }
        G.local = saves.current;
        const res = await openLobby();
        if (res === 'start') return;
      }
    } finally {
      this.inMenu = false;
    }
  }

  startSingle(save: SaveData): void {
    session.leave(true);
    G.startSingle(save);
    G.game.scene.stop('Title');
    touch.setActive(true);
    G.game.scene.start('World');
  }

  async loadLast(): Promise<void> {
    const slot = G.state?.slot ?? prefs.lastSlot;
    this.stopGameScenes();
    G.stop();
    const s = await saves.load(slot);
    if (s) this.startSingle(s);
    else void this.title(true);
  }

  async startMulti(state: SaveData): Promise<void> {
    document.querySelectorAll('#ui .layer').forEach((e) => e.remove());
    input.clearBlockers();
    this.stopGameScenes();
    G.startMulti(state, saves.current, session.bridge);
    session.attachGame();
    G.game.scene.stop('Title');
    touch.setActive(true);
    G.game.scene.start('World');
    toast(session.isHost ? '你是房主：劇情由你推進。' : '已加入冒險！劇情由房主推進。', 'info', 3000);
  }
}

export const app = new App();
