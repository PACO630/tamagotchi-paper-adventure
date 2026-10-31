/** 2.5D paper-diorama exploration: parallax layers, actors, interactions, mechanisms, story triggers. */
import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, GROUND_BOTTOM, GROUND_TOP, Z_TO_Y, FONT } from '../core/config';
import { bus } from '../core/events';
import { G } from '../core/game';
import { clamp, hashString } from '../core/util';
import type { DrawTarget } from '../art/characterArt';
import { canvas, shade } from '../art/paperArt';
import {
  ensureEnemySheet, ensureObject, ensurePlatform, ensureProp, ensureTheme, releaseNpcSheets, releaseTheme,
} from '../art/textures';
import { chapterByNum } from '../data/chapters';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import type { ChapterDef, CharId, ChestDef, NpcDef, ObjDef, Script, ZoneDef } from '../data/types';
import { input } from '../input/input';
import { runBattle } from '../battle/battleRunner';
import { battleActive } from '../battle/battleRunner';
import { audio } from '../systems/audio';
import { saves } from '../systems/saveManager';
import { settings } from '../systems/settings';
import { resetStory, runScript, storyIdleMs, storyRunning, type StoryHost } from '../systems/story';
import { dialogue } from '../ui/dialogueBox';
import { confirmDialog, toast } from '../ui/dom';
import { hud } from '../ui/hud';
import { showChapterCard, showChapterClear, showGameOver } from '../ui/screens/chapterCards';
import { playEnding } from '../ui/screens/ending';
import { openPauseMenu } from '../ui/screens/pauseMenu';
import { Actor, depthScale, zToY } from './actor';
import { worldNet } from './worldNet';
import { session } from '../net/session';
import { cinema } from '../ui/cinema';
import { touch } from '../ui/touch';
import { openTutorial } from '../ui/screens/tutorial';
import { CHARACTERS } from '../data/characters';
import { SPEAKERS } from '../data/chapters/helpers';
import { playBook } from '../ui/storybook';
import { ABILITIES, FieldPlay } from './fieldPlay';
import { EggWorld } from './eggWorld';
import { runNested } from '../systems/story';
import { portraitURL } from '../art/textures';
import { INTERLUDES } from '../data/interludes';
import type { StageScene } from '../scenes/stageScene';
import { playMinigame } from '../minigames';
import type { EnemyAI, NpcLook, PlatformDef, RoomDef } from '../data/types';

interface FieldEnemy {
  id: string; party: string[]; enemy: string; x0: number; z0: number; range: number; x: number; z: number; spr: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image;
  phase: number; chase: boolean; alive: boolean; hop: number; showIf?: string;
  ai: EnemyAI; small: boolean; awake: number; hidden: boolean; zzz?: Phaser.GameObjects.Text; alerted: boolean;
}
interface ObjView { def: ObjDef; img: Phaser.GameObjects.Image[]; label?: Phaser.GameObjects.Text; broken: boolean; open: boolean }
interface ChestView { def: ChestDef; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; revealed: boolean }
interface NpcView { def: NpcDef; actor: Actor; baseX: number; t: number; busy?: boolean }
interface PlatView { id: string; def: PlatformDef; x0: number; z0: number; w: number; d: number; dx: number; dz: number; period: number; img: Phaser.GameObjects.Image; x: number; z: number; vx: number; vz: number; on: boolean }
interface HazardView { zone: ZoneDef; piston: Phaser.GameObjects.Rectangle; active: boolean }

const WALK = 230, RUN = 330, ZSPEED = 150;

export class WorldScene extends Phaser.Scene implements StoryHost {
  chapter!: ChapterDef;
  player!: Actor;
  partner: Actor | null = null;
  private trail: { x: number; z: number; y: number }[] = [];
  private remotes = new Map<string, Actor>();
  private npcs: NpcView[] = [];
  private enemies: FieldEnemy[] = [];
  private objects: ObjView[] = [];
  private chests: ChestView[] = [];
  private plats: PlatView[] = [];
  private hazards: HazardView[] = [];
  private bossSprite: Phaser.GameObjects.Sprite | null = null;
  private interactBubble!: Phaser.GameObjects.Image;
  private interactText!: Phaser.GameObjects.Text;
  private darkMask!: Phaser.GameObjects.Image;
  private darkAlpha = 0;
  private lastSafe = { x: 0, z: 0 };
  private safeTimer = 0;
  private invuln = 0;
  private attackT = 0;
  private airVX = 0;
  private stepT = 0;
  private posT = 0;
  private busy = false;
  private time0 = 0;
  private offs: (() => void)[] = [];
  private onPlatform: PlatView | null = null;
  private healCooldown = 0;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private pitWater: { x: number; w: number; y: number }[] = [];
  private animatedTiles: { t: Phaser.GameObjects.TileSprite; vx: number; vy: number }[] = [];
  private spinners: { o: Phaser.GameObjects.Image; v: number }[] = [];
  private triggerCheckT = 0;
  private screenFill: (Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle)[] = [];
  private screenTiles: Phaser.GameObjects.TileSprite[] = [];
  private lastHp = -1;
  fp!: FieldPlay;
  /** Actors that only exist for cutscenes (henchmen, the villain, gathered partners…). */
  private extras = new Map<string, Actor>();
  private gathered: string[] = [];
  private sat = 0;
  private colorFx: Phaser.FX.ColorMatrix | null = null;
  egg!: EggWorld;
  private area: { x0: number; x1: number; room?: RoomDef } = { x0: 0, x1: 0 };
  private stage: StageScene | null = null;

  constructor() {
    super('World');
  }

  /* ======================= lifecycle ======================= */

  create(): void {
    this.chapter = chapterByNum(G.state.currentChapter);
    const cd = this.chapter;
    if (!this.scene.isActive('Battle') && !this.scene.isPaused('Battle')) {
      releaseTheme(this, cd.theme.id);
      releaseNpcSheets(this);
    }
    ensureTheme(this, cd.theme);
    this.screenFill = []; this.screenTiles = [];
    this.npcs = []; this.enemies = []; this.objects = []; this.chests = []; this.plats = []; this.hazards = [];
    this.remotes.clear(); this.pitWater = []; this.animatedTiles = []; this.spinners = []; this.trail = [];
    this.extras.clear(); this.gathered = []; this.colorFx = null; this.stage = null;
    this.busy = false;
    this.time0 = this.time.now;
    this.egg?.destroy();
    this.egg = new EggWorld(this, cd.eggDrain ?? 0.085);
    this.egg.onFlip = () => this.onWorldFlip();

    this.cameras.main.setBounds(0, 0, cd.width, GAME_H);
    this.area = { x0: 0, x1: cd.width };
    this.buildBackdrop();
    this.buildZones();
    this.buildProps();
    this.buildPlatforms();
    this.buildObjects();
    this.buildChests();
    this.buildNpcs();
    this.buildEnemies();
    this.buildBoss();

    // player
    const start = { ...this.safeStart() };
    // multiplayer: stagger spawn points by join order so players don't stand inside each other
    if (G.mode === 'multi') {
      const rank = [...session.roster].sort((x, y) => x.joinOrder - y.joinOrder).findIndex((r) => r.key === session.localKey);
      if (rank > 0) start.x = clamp(start.x + rank * 70, 40, this.chapter.width - 40);
    }
    this.player = new Actor(this, { charId: G.localChar }, start.x, clamp(start.z, 10, DEPTH - 10));
    if (worldNet.active) this.player.setLabel(G.local?.playerName ?? '', '#ffe680');
    if (cd.theme.underwater || cd.zones.some((z) => z.look === 'water' || z.look === 'choco')) this.player.enableReflection();
    this.lastSafe = { x: this.player.x, z: this.player.z };
    this.refreshPartner();
    this.updateArea(true);
    this.fp = new FieldPlay(this);
    // saves from before the egg device existed get it as soon as they reach chapter 2+
    if (cd.num > 1 && !G.cond('has_egg') && G.isAuthority) G.dispatch({ a: 'flag', k: 'has_egg', v: true });
    // the world has lost its colour until this chapter's guardian is calmed down
    this.sat = G.cond(cd.boss.flag) ? 0 : cd.grey ?? -0.5;
    if (this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.clearFX();
      this.colorFx = this.cameras.main.postFX.addColorMatrix();
      this.applySat();
    }

    this.onWorldFlip();

    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 120);
    this.cameras.main.setDeadzone(160, 400);
    this.cameras.main.fadeIn(500);

    // overlays (screen space)
    this.darkMask = this.add.image(GAME_W / 2, GAME_H / 2, this.darkTexture()).setScrollFactor(0).setDepth(8000).setAlpha(0);
    this.screenFill.push(this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(8100).setAlpha(0.55));
    if (cd.theme.sun === 'sun' || cd.theme.underwater) this.screenFill.push(this.add.image(0, 0, 'rays').setOrigin(0).setScrollFactor(0).setDepth(8050).setBlendMode(Phaser.BlendModes.ADD).setAlpha(cd.theme.underwater ? 0.6 : 0.4));
    this.screenFill.push(this.add.rectangle(0, 0, GAME_W, GAME_H, cd.theme.ambient, 0.06).setOrigin(0).setScrollFactor(0).setDepth(8020).setBlendMode(Phaser.BlendModes.MULTIPLY));
    // phones/tablets: the view is wider than 1280 — stretch screen-space layers to the real width
    this.fitScreen();
    this.scale.on('resize', this.fitScreen, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitScreen, this));
    this.buildWeather();

    this.interactBubble = this.add.image(0, 0, 'emote_bubble').setDepth(9500).setVisible(false).setScale(0.8);
    // touch: tapping the "…" / "!" bubble (or the thing under it) interacts
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.interactBubble.visible || input.blocked || storyRunning() || battleActive() || this.busy) return;
      const b = this.interactBubble;
      if (Math.abs(ptr.worldX - b.x) < 80 && ptr.worldY > b.y - 60 && ptr.worldY < b.y + 170) this.tryInteract();
    });
    touch.tapHook = (cx, cy) => this.tapBubbleAt(cx, cy);
    this.events.once('shutdown', () => { if (touch.tapHook) touch.tapHook = null; });
    this.interactText = this.add.text(0, 0, '!', { fontFamily: FONT, fontSize: '26px', color: '#e8203a' }).setOrigin(0.5).setDepth(9501).setVisible(false);

    audio.playMusic(cd.music);
    hud.mount(cd);
    hud.update();

    this.offs.push(bus.on('state:changed', (a: any) => this.onStateChanged(a)));
    this.offs.push(bus.on('partner:changed', () => this.refreshPartner()));
    this.offs.push(bus.on('partner:joined', (id: CharId) => { this.refreshPartner(); audio.sfx('join'); this.partnerJoinFx(id); }));
    this.offs.push(saves.onBeforeSave((s) => {
      // only record the position while this map is still the save's current chapter
      // (after a chapter ends the save already points at the next map)
      if (G.mode === 'single' && s === G.state && this.player && s.currentChapter === this.chapter.num) {
        s.position = { x: Math.round(this.player.x), z: Math.round(this.player.z) };
      }
    }));
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('destroy', () => this.cleanup());

    G.playing = true;
    if (G.mode === 'single') saves.startAutosaveTimer();
    // chapter title card, then intro (authority)
    void (async () => {
      // brand-new single-player game: the animated opening movie comes before everything else
      if (G.isAuthority && cd.num === 1 && G.mode === 'single' && !G.cond('opening_seen') && !G.cond(`intro:${cd.id}`)) {
        await this.runStory([{ do: 'opening' }, { do: 'flag', key: 'opening_seen', value: true }]);
      }
      this.busy = true;
      await showChapterCard(cd);
      this.busy = false;
      if (G.isAuthority && !G.cond(`intro:${cd.id}`)) {
        // the flag is the script's first step, so an intro that could not start is retried next time
        await this.runStory([{ do: 'flag', key: `intro:${cd.id}`, value: true }, ...this.establishingShot(), ...cd.intro]);
      }
      // first time actually playing: picture-based controls tutorial
      await this.maybeTutorial();
      // recovery: the shard was already taken (e.g. the page closed during the outro) → finish the chapter
      if (G.isAuthority && cd.num < 8 && G.cond(`shard${cd.num}_got`)) await this.chapterEnd();
      else if (G.isAuthority && cd.num === 8 && G.cond('boss8') && !G.cond('game_clear')) await this.runStory(cd.outro);
    })();
  }

  private cleanup(): void {
    if (storyRunning()) resetStory();
    this.egg?.destroy();
    for (const o of this.offs) o();
    this.offs = [];
    hud.unmount();
    G.playing = false;
    saves.stopAutosaveTimer();
  }

  /* ======================= building ======================= */

  private buildBackdrop(): void {
    const cd = this.chapter;
    const t = cd.theme;
    this.screenFill.push(this.add.image(0, 0, `sky:${t.id}`).setOrigin(0).setScrollFactor(0).setDepth(-100).setDisplaySize(GAME_W, GAME_H));
    // drifting paper clouds in the sky
    if (!t.underwater && t.id !== 'dark') {
      for (let i = 0; i < 5; i++) {
        const c = this.add.image(Math.random() * GAME_W, 60 + Math.random() * 160, 'p_cloud').setScrollFactor(0.05).setDepth(-95).setAlpha(0.8).setScale(0.8 + Math.random());
        this.tweens.add({ targets: c, x: c.x + 300, duration: 40000 + Math.random() * 30000, repeat: -1, yoyo: true });
      }
    }
    const far = this.add.tileSprite(0, 150, GAME_W, 360, `far:${t.id}`).setOrigin(0).setScrollFactor(0).setDepth(-90);
    const mid = this.add.tileSprite(0, GROUND_TOP - 280, GAME_W, 300, `mid:${t.id}`).setOrigin(0).setScrollFactor(0).setDepth(-80);
    this.screenTiles.push(far, mid);
    this.events.on('update', () => {
      const sx = this.cameras.main.scrollX;
      far.tilePositionX = sx * 0.12;
      mid.tilePositionX = sx * 0.35;
    });
    // ground
    const full = this.fullWidth();
    this.add.tileSprite(0, GROUND_TOP - 4, full, GROUND_BOTTOM - GROUND_TOP + 40, `ground:${t.id}`).setOrigin(0).setDepth(-50);
    this.add.tileSprite(0, GROUND_TOP - 28, full, 40, `gedge:${t.id}`).setOrigin(0).setDepth(-49);
    this.add.tileSprite(0, GROUND_BOTTOM + 30, full, 50, `fedge:${t.id}`).setOrigin(0).setDepth(7000);
    // soft ambient light pools along the floor
    for (let x = 300; x < full; x += 900) {
      this.add.image(x, GROUND_TOP + 100, 'p_warm').setScale(5, 1.6).setAlpha(0.18).setDepth(-45).setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  private pitTexture(look: string): string {
    const key = `pit:${look}`;
    if (this.textures.exists(key)) return key;
    const [c, g] = canvas(256, 256);
    const cols: Record<string, [string, string]> = {
      water: ['#7ac8f0', '#2a6ab0'], choco: ['#8a5a34', '#4a2a14'], sky: ['#d8f0ff', '#8ac8ff'], abyss: ['#0a3a6a', '#020a2a'],
      void: ['#1a0a2a', '#000000'], stars: ['#2a2060', '#05041a'],
    };
    const [a, b] = cols[look] ?? cols.water;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    if (look === 'water' || look === 'choco') {
      g.strokeStyle = look === 'water' ? 'rgba(255,255,255,0.45)' : 'rgba(255,220,180,0.35)';
      g.lineWidth = 3;
      for (let y = 20; y < 256; y += 32) { g.beginPath(); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 4) * 4); g.stroke(); }
    } else if (look === 'sky') {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse((i * 53) % 256, (i * 97) % 256, 40, 14, 0, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) g.fillRect((i * 73) % 256, (i * 151) % 256, 2, 2);
    }
    this.textures.addCanvas(key, c);
    return key;
  }

  private buildZones(): void {
    for (const z of this.chapter.zones) {
      const z0 = z.z0 ?? 0, z1 = z.z1 ?? DEPTH;
      const y0 = zToY(z0) - 6, y1 = zToY(z1) + 34;
      if (z.type === 'pit') {
        const key = this.pitTexture(z.look ?? 'water');
        const ts = this.add.tileSprite(z.x, y0, z.w, y1 - y0, key).setOrigin(0).setDepth(-40);
        if (z.look === 'water' || z.look === 'choco') { this.animatedTiles.push({ t: ts, vx: 12, vy: 4 }); this.pitWater.push({ x: z.x, w: z.w, y: GROUND_TOP }); }
        else this.animatedTiles.push({ t: ts, vx: 6, vy: 0 });
        // paper edges of the hole
        const edge = this.add.graphics().setDepth(-39);
        edge.fillStyle(0xfffdf6, 1).fillRect(z.x - 6, y0, 6, y1 - y0).fillRect(z.x + z.w, y0, 6, y1 - y0);
        edge.fillStyle(Phaser.Display.Color.HexStringToColor(shade('#' + this.chapter.theme.ground.toString(16).padStart(6, '0'), -0.4)).color, 1).fillRect(z.x, y0, z.w, 10);
      } else if (z.type === 'conveyor') {
        const [c, g] = canvas(64, 32);
        g.fillStyle = '#5a5a68'; g.fillRect(0, 0, 64, 32);
        g.fillStyle = '#ffc84a';
        for (let i = 0; i < 2; i++) { g.beginPath(); const x = i * 32 + (z.fx! > 0 ? 6 : 26); g.moveTo(x, 6); g.lineTo(x + (z.fx! > 0 ? 14 : -14), 16); g.lineTo(x, 26); g.fill(); }
        const key = `conv:${z.fx! > 0 ? 'r' : 'l'}`;
        if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
        const ts = this.add.tileSprite(z.x, y0 + 6, z.w, y1 - y0 - 10, key).setOrigin(0).setDepth(-40).setAlpha(0.9);
        this.animatedTiles.push({ t: ts, vx: -(z.fx ?? 0) * 0.6, vy: 0 });
      } else if (z.type === 'hazard') {
        const g = this.add.rectangle(z.x, y0, z.w, y1 - y0, 0xff4040, 0.12).setOrigin(0).setDepth(-40);
        void g;
        const piston = this.add.rectangle(z.x + z.w / 2, GROUND_TOP - 300, z.w - 10, 260, 0x8a8a98).setStrokeStyle(6, 0x3a3a44).setDepth(6000);
        this.hazards.push({ zone: z, piston, active: false });
      } else if (z.type === 'wind' || z.type === 'current') {
        const emitter = this.add.particles(0, 0, z.type === 'wind' ? 'p_dust' : 'p_bubble', {
          x: { min: z.x, max: z.x + z.w }, y: { min: GROUND_TOP - 120, max: GROUND_BOTTOM },
          speedX: (z.fx ?? 0) * 2.2, speedY: (z.fz ?? 0) * 1.2 - (z.type === 'current' ? 20 : 0), lifespan: 1400, frequency: 60, alpha: { start: 0.8, end: 0 }, scale: { start: 1.2, end: 0.6 },
        }).setDepth(6500);
        void emitter;
      } else if (z.type === 'dark') {
        // handled per frame via darkMask
      }
    }
  }

  private buildProps(): void {
    for (const p of this.chapter.props) {
      const key = ensureProp(this, p.t);
      const layer = p.layer ?? 'mid';
      if (layer === 'back') {
        const img = this.add.image(p.x, GROUND_TOP + 14, key).setOrigin(0.5, 1).setScrollFactor(0.82, 1).setScale((p.s ?? 1) * 0.92).setDepth(-60);
        if (p.flip) img.setFlipX(true);
      } else if (layer === 'front') {
        this.add.image(p.x, GROUND_BOTTOM + 90, key).setOrigin(0.5, 1).setScrollFactor(1.22, 1).setScale((p.s ?? 1) * 1.25).setDepth(7500).setAlpha(0.96);
      } else {
        const z = p.z ?? 20;
        const y = zToY(z);
        const sc = (p.s ?? 1) * depthScale(z) * 0.95;
        // projected shadow on the floor
        this.add.image(p.x + 14, y, key).setOrigin(0.5, 1).setScale(sc, -sc * 0.28).setTint(0x000000).setAlpha(0.16).setDepth(y - 2);
        const img = this.add.image(p.x, y, key).setOrigin(0.5, 1).setScale(sc).setDepth(y);
        if (p.flip) img.setFlipX(true);
        if (p.t === 'windmill') {
          const b = this.add.image(p.x, y - 230 * sc, ensureProp(this, 'blades')).setScale(sc).setDepth(y + 1);
          this.spinners.push({ o: b, v: 0.6 });
        }
        if (p.t === 'gear_big' || p.t === 'gear_small') this.spinners.push({ o: img, v: 0.3 });
        if (p.t === 'kelp') this.tweens.add({ targets: img, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 1800 + Math.random() * 800, ease: 'Sine.inOut' });
      }
    }
  }

  private buildPlatforms(): void {
    for (const p of this.chapter.platforms) {
      const key = ensurePlatform(this, p.look ?? 'plank');
      const img = this.add.image(p.x, zToY(p.z), key).setScale(p.w / 200, (p.d / 60) * 0.8);
      this.plats.push({ id: p.id, def: p, x0: p.x, z0: p.z, w: p.w, d: p.d, dx: p.dx ?? 0, dz: p.dz ?? 0, period: p.period ?? 3, img, x: p.x, z: p.z, vx: 0, vz: 0, on: true });
    }
  }

  private buildObjects(): void {
    for (const def of this.chapter.objects) {
      const v: ObjView = { def, img: [], broken: false, open: false };
      const y = zToY(def.z);
      const add = (key: string, x: number, yy: number, sc = 1) => {
        const img = this.add.image(x, yy, key).setOrigin(0.5, 1).setScale(sc).setDepth(yy);
        v.img.push(img);
        return img;
      };
      switch (def.type) {
        case 'breakable':
          if (def.w) for (const z of [30, 100, 170, 235]) add(ensureObject(this, 'breakable'), def.x, zToY(z), depthScale(z) * 0.95);
          else add(ensureObject(this, 'breakable'), def.x, y, depthScale(def.z) * 0.8);
          v.broken = !!def.flag && G.cond(def.flag);
          break;
        case 'gate':
          for (const z of [0, 50, 100, 150, 200, 240]) add(ensureObject(this, 'gate'), def.x, zToY(z) + 8, depthScale(z) * 0.5);
          break;
        case 'egg_wall':
          for (const z of [0, 50, 100, 150, 200, 240]) add(ensureObject(this, `egg_wall_${def.world ?? 'paper'}`), def.x, zToY(z) + 8, depthScale(z) * 0.55);
          break;
        case 'switch':
          add(ensureObject(this, 'switch_off'), def.x, y, depthScale(def.z));
          break;
        case 'sign': add(ensureObject(this, 'sign'), def.x, y, depthScale(def.z) * 0.85); break;
        case 'savepoint': {
          const img = add(ensureObject(this, 'save_block'), def.x, y - 70, depthScale(def.z) * 0.85);
          this.tweens.add({ targets: img, y: img.y - 10, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
          this.add.image(def.x, y, 'shadow').setScale(0.6, 0.6).setDepth(y - 1);
          break;
        }
        case 'shard': {
          const img = add(ensureObject(this, 'shard'), def.x, y - 60, depthScale(def.z));
          this.tweens.add({ targets: img, y: img.y - 16, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.inOut' });
          const glow = this.add.image(def.x, y - 100, 'p_warm').setScale(2).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 1);
          v.img.push(glow);
          break;
        }
        case 'door': add(ensureObject(this, 'door'), def.x, y, depthScale(def.z) * 0.8); break;
        case 'spring': add(ensureObject(this, 'spring'), def.x, y + 6, depthScale(def.z)); break;
        case 'heal': {
          const img = add(ensureObject(this, 'heal_pad'), def.x, y + 16, depthScale(def.z));
          img.setDepth(y - 30);
          this.tweens.add({ targets: img, alpha: 0.7, yoyo: true, repeat: -1, duration: 1000 });
          break;
        }
        case 'ability': {
          const look = def.look ?? 'spot';
          const key = ensureObject(this, `ab_${look}`);
          if (look === 'food_wall' || look === 'paint_wall') for (const z of [30, 100, 170, 235]) add(key, def.x, zToY(z), depthScale(z) * 0.95);
          else if (look === 'paint_bridge') { const img = add(key, def.x, GROUND_TOP + 130, 1); img.setOrigin(0.5).setDepth(-30); }
          else add(key, def.x, y, depthScale(def.z) * (look === 'bear' ? 1.15 : 0.9));
          if (look === 'bear') this.tweens.add({ targets: v.img[0], scaleY: v.img[0].scaleY * 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
          if (look === 'spot') this.tweens.add({ targets: v.img[0], alpha: 0.5, yoyo: true, repeat: -1, duration: 800 });
          if (def.need) {
            const tag = this.add.text(def.x, (look === 'paint_bridge' ? GROUND_TOP + 60 : y - 150 * depthScale(def.z)), `需要：${ABILITIES[def.need].name}`, { fontFamily: FONT, fontSize: '16px', color: '#fffdf6', stroke: '#3a2a1a', strokeThickness: 5 }).setOrigin(0.5).setDepth(y + 2);
            v.label = tag;
          }
          v.open = !!def.flag && G.cond(def.flag);
          break;
        }
        case 'vent': {
          const img = add(ensureObject(this, 'vent'), def.x, y + 6, depthScale(def.z));
          img.setDepth(y - 20);
          this.add.particles(def.x, y - 10, 'p_bubble', { speedY: { min: -140, max: -80 }, speedX: { min: -14, max: 14 }, lifespan: 1600, frequency: 120, scale: { start: 0.7, end: 1.3 }, alpha: { start: 0.9, end: 0 } }).setDepth(y + 1);
          break;
        }
        case 'plate': {
          const img = add(this.fp?.plateTex(def.by ?? 'hero', false) ?? FieldPlay.tex(this, 'fp:plate0', 4, 4, () => undefined), def.x, y + 14, depthScale(def.z));
          img.setDepth(y - 25);
          break;
        }
      }
      if (def.text && (def.type === 'switch' || def.type === 'door')) {
        v.label = this.add.text(def.x, y - 96 * depthScale(def.z), def.text, { fontFamily: FONT, fontSize: '18px', color: '#fffdf6', stroke: '#3a2a1a', strokeThickness: 5 }).setOrigin(0.5).setDepth(y + 1);
      }
      this.objects.push(v);
      this.refreshObject(v, true);
    }
  }

  private refreshObject(v: ObjView, instant = false): void {
    const d = v.def;
    const show = !d.showIf || G.cond(d.showIf);
    switch (d.type) {
      case 'breakable': {
        const broken = !!d.flag && G.cond(d.flag);
        if (broken && !v.broken && !instant) {
          for (const img of v.img) {
            this.paperBurst(img.x, img.y - 40);
            this.tweens.add({ targets: img, scaleX: 0, alpha: 0, duration: 250, onComplete: () => img.setVisible(false) });
          }
        } else if (broken) v.img.forEach((i) => i.setVisible(false));
        v.broken = broken;
        break;
      }
      case 'gate': {
        const open = G.cond(d.cond);
        if (open && !v.open && !instant) {
          audio.sfx('door');
          const view = this.cameras.main.worldView;
          if ((d.x < view.x + 40 || d.x > view.right - 40) && !this.area.room) this.showOffQueue.push(d.x);
          for (const img of v.img) this.tweens.add({ targets: img, y: img.y - 260, alpha: 0, delay: this.showOffQueue.length ? 1300 : 0, duration: 700, ease: 'Back.in' });
        } else if (open) v.img.forEach((i) => i.setVisible(false));
        v.open = open;
        break;
      }
      case 'switch': {
        const on = !!d.flag && G.cond(d.flag);
        v.img[0]?.setTexture(ensureObject(this, on ? 'switch_on' : 'switch_off'));
        if (!v.img[0]?.visible && show && !instant) { v.img[0]?.setScale(0.1); this.tweens.add({ targets: v.img[0], scale: depthScale(d.z), duration: 380, ease: 'Back.out' }); }
        v.img.forEach((i) => i.setVisible(show));
        v.label?.setVisible(show);
        break;
      }
      case 'ability': {
        const solved = !!d.flag && G.cond(d.flag);
        const visible = !d.showIf || G.cond(d.showIf);
        if (solved && !v.open && !instant) {
          v.label?.setVisible(false);
          for (const img of v.img) {
            if (d.look === 'bear') this.tweens.add({ targets: img, x: img.x + 520, y: img.y + 40, angle: 12, alpha: 0, duration: 1600, ease: 'Sine.in', onComplete: () => img.setVisible(false) });
            else if (d.look === 'paint_bridge') this.tweens.add({ targets: img, alpha: 0, duration: 600, onComplete: () => img.setVisible(false) });
            else { this.paperBurst(img.x, img.y - 50, d.look === 'food_wall' ? 0xffd08a : 0xb88cff); this.tweens.add({ targets: img, scaleX: 0, scaleY: 0, alpha: 0, duration: 450, ease: 'Back.in', onComplete: () => img.setVisible(false) }); }
          }
        } else if (solved || !visible) { v.img.forEach((i) => i.setVisible(false)); v.label?.setVisible(false); }
        else { v.img.forEach((i) => i.setVisible(true)); v.label?.setVisible(true); }
        v.open = solved;
        break;
      }
      case 'plate': case 'vent': break;
      default:
        v.img.forEach((i) => i.setVisible(show));
        v.label?.setVisible(show);
    }
    if (d.world && this.egg) this.applyWorldLook(v);
  }

  /** Things from the other world are only a faint outline. */
  private applyWorldLook(v: ObjView): void {
    const has = this.egg.has(v.def.world);
    v.img.forEach((i) => i.setAlpha(has ? 1 : 0.14));
    if (!has) v.label?.setVisible(false);
    else if (!v.def.showIf || G.cond(v.def.showIf)) v.label?.setVisible(true);
  }

  private onWorldFlip(): void {
    for (const v of this.objects) if (v.def.world) this.applyWorldLook(v);
    for (const c of this.chests) if (c.def.world) this.refreshChest(c);
    hud.update();
  }

  private buildChests(): void {
    for (const def of this.chapter.chests) {
      const y = zToY(def.z);
      const opened = G.cond(`chest:${def.id}`);
      const sc = depthScale(def.z) * 0.85;
      const shadow = this.add.image(def.x, y, 'shadow').setScale(0.55 * sc, 0.8).setDepth(y - 1);
      const img = this.add.image(def.x, y, ensureObject(this, opened ? 'chest_open' : 'chest')).setOrigin(0.5, 1).setScale(sc).setDepth(y);
      const cv: ChestView = { def, img, shadow, revealed: !def.hidden || opened };
      this.chests.push(cv);
      this.refreshChest(cv);
    }
  }

  private refreshChest(cv: ChestView): void {
    const visible = cv.revealed && this.egg.has(cv.def.world) && (!cv.def.showIf || G.cond(cv.def.showIf) || G.cond(`chest:${cv.def.id}`));
    cv.img.setVisible(visible);
    cv.shadow.setVisible(visible);
    if (G.cond(`chest:${cv.def.id}`)) cv.img.setTexture(ensureObject(this, 'chest_open'));
  }

  private npcTarget(def: NpcDef): DrawTarget {
    return typeof def.look === 'string' ? { charId: def.look, dark: def.dark } : { npc: def.look, dark: def.dark };
  }

  private buildNpcs(): void {
    for (const def of this.chapter.npcs) {
      const t = this.npcTarget(def);
      const actor = new Actor(this, t, def.x, def.z, 0.86, !!t.charId);
      actor.setLabel(def.name, '#fffdf6');
      this.npcs.push({ def, actor, baseX: def.x, t: Math.random() * 10 });
    }
    this.refreshNpcs();
  }

  private refreshNpcs(): void {
    for (const n of this.npcs) {
      n.actor.visible = !n.def.showIf || G.cond(n.def.showIf);
      n.actor.sync();
    }
  }

  private buildEnemies(): void {
    for (const e of this.chapter.enemies) {
      const key = ensureEnemySheet(this, e.enemy);
      const y = zToY(e.z);
      const flying = ENEMIES[e.enemy].traits.includes('flying');
      const shadow = this.add.image(e.x, y, 'shadow').setScale(0.6, 0.8);
      const spr = this.add.sprite(e.x, y - (flying ? 50 : 0), key, 'idle0').setOrigin(0.5, 0.96).setScale(0.8 * depthScale(e.z));
      spr.play(`${key}#idle`);
      const ai = e.ai ?? 'patrol';
      const fe: FieldEnemy = {
        id: e.id, party: e.party, enemy: e.enemy, x0: e.x, z0: e.z, range: e.range ?? 120, x: e.x, z: e.z, spr, shadow, phase: hashString(e.id) % 100, chase: false, alive: true, hop: 0, showIf: e.showIf,
        ai, small: !!e.small, awake: 0, hidden: ai === 'ambush', alerted: false,
      };
      if (ai === 'sleeper') fe.zzz = this.add.text(e.x, y - 90, 'Zz', { fontFamily: FONT, fontSize: '22px', color: '#8ab0ff', stroke: '#fffdf6', strokeThickness: 5 }).setOrigin(0.5);
      this.enemies.push(fe);
    }
  }

  private buildBoss(): void {
    const b = this.chapter.boss;
    if (G.cond(b.flag)) return;
    const key = ensureEnemySheet(this, b.enemy);
    const def = ENEMIES[b.enemy];
    const y = zToY(b.z);
    this.add.image(b.x, y, 'shadow').setScale(1.4, 1.2).setDepth(y - 1).setName('bossShadow');
    this.bossSprite = this.add.sprite(b.x, y - (def.traits.includes('flying') ? 60 : 0), key, 'idle0').setOrigin(0.5, 0.96).setScale(1.1 * (def.art.size ?? 1)).setDepth(y);
    this.bossSprite.play(`${key}#idle`);
  }

  private buildWeather(): void {
    const w = this.chapter.weather;
    if (w === 'none' || settings.current.quality === 'low') return;
    const map: Record<string, { tex: string; cfg: any }> = {
      leaves: { tex: 'p_leaf', cfg: { speedX: { min: -60, max: -20 }, speedY: { min: 30, max: 70 }, rotate: { min: 0, max: 360 }, frequency: 260 } },
      petals: { tex: 'p_petal', cfg: { speedX: { min: -50, max: 10 }, speedY: { min: 30, max: 60 }, rotate: { min: 0, max: 360 }, frequency: 200 } },
      candy: { tex: 'p_candy', cfg: { speedX: { min: -30, max: 30 }, speedY: { min: 40, max: 90 }, rotate: { min: 0, max: 360 }, frequency: 220 } },
      clouds: { tex: 'p_dust', cfg: { speedX: { min: 60, max: 140 }, speedY: { min: -10, max: 10 }, frequency: 120, alpha: { start: 0.8, end: 0 } } },
      sparks: { tex: 'p_star', cfg: { speedX: { min: -40, max: 40 }, speedY: { min: -60, max: -20 }, frequency: 300, tint: 0xffc84a, scale: { start: 0.6, end: 0 } } },
      bubbles: { tex: 'p_bubble', cfg: { speedX: { min: -10, max: 10 }, speedY: { min: -80, max: -40 }, frequency: 120 } },
      dust: { tex: 'p_dust', cfg: { speedX: { min: -10, max: 10 }, speedY: { min: 5, max: 20 }, frequency: 160, alpha: { start: 0.5, end: 0 } } },
      darkmotes: { tex: 'p_mote', cfg: { speedX: { min: -20, max: 20 }, speedY: { min: -40, max: -10 }, frequency: 120, alpha: { start: 0.9, end: 0 } } },
      stars: { tex: 'p_star', cfg: { speedX: { min: -20, max: 20 }, speedY: { min: 10, max: 40 }, frequency: 180, scale: { start: 0.7, end: 0.1 } } },
      snow: { tex: 'p_snow', cfg: { speedX: { min: -20, max: 20 }, speedY: { min: 40, max: 80 }, frequency: 80 } },
      rain: { tex: 'p_rain', cfg: { speedX: -40, speedY: { min: 600, max: 800 }, frequency: 20 } },
    };
    const m = map[w];
    if (!m) return;
    const rising = m.cfg.speedY && typeof m.cfg.speedY === 'object' && m.cfg.speedY.max < 0;
    this.weather = this.add.particles(0, 0, m.tex, {
      x: { min: -100, max: this.scale.width + 100 }, y: rising ? GAME_H + 10 : -20, lifespan: 9000, quantity: 1, ...m.cfg,
    }).setScrollFactor(0).setDepth(7900);
  }

  /** Stretch screen-space layers (sky, parallax, vignette, light) to the current view width. */
  private fitScreen(): void {
    const w = this.scale.width;
    for (const o of this.screenFill) o.setDisplaySize(w, GAME_H);
    for (const t of this.screenTiles) t.setSize(w, t.height);
  }

  private darkTexture(): string {
    const key = 'darkmask';
    if (this.textures.exists(key)) return key;
    const [c, g] = canvas(GAME_W * 2, GAME_H * 2);
    g.fillStyle = 'rgba(8,4,16,0.94)';
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-out';
    const rg = g.createRadialGradient(GAME_W, GAME_H, 40, GAME_W, GAME_H, 260);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, c.width, c.height);
    this.textures.addCanvas(key, c);
    return key;
  }

  refreshPartner(): void {
    this.partner?.destroy();
    this.partner = null;
    if (G.mode !== 'single') return;
    const p = G.state.partners.active;
    if (!p) return;
    this.partner = new Actor(this, { charId: p }, this.player.x - 70, this.player.z, 0.8);
    this.trail = [];
  }

  /* ======================= state reactions ======================= */

  private onStateChanged(a: any): void {
    if (!this.player) return;
    if (a.a === 'chapter') {
      if (G.mode === 'multi' && !G.isAuthority) this.reloadChapter();
      return;
    }
    for (const o of this.objects) this.refreshObject(o);
    for (const c of this.chests) this.refreshChest(c);
    this.refreshNpcs();
    if (this.bossSprite && G.cond(this.chapter.boss.flag)) {
      const b = this.bossSprite;
      this.bossSprite = null;
      this.tweens.add({ targets: b, scaleX: 0, alpha: 0, duration: 500, onComplete: () => b.destroy() });
      this.children.getByName('bossShadow')?.destroy();
    }
    hud.update();
  }

  /**
   * Saved position for this map, unless it is unusable: a position is rejected when a gate or
   * wall that is still closed lies between the map start and it (old saves could carry the
   * previous chapter's boss-room position into the next chapter).
   */
  private safeStart(): { x: number; z: number } {
    const cd = this.chapter;
    const p = G.state.position;
    // saved inside a side room: rooms are only reachable through their door, so the spot is fine
    if (cd.rooms?.some((r) => p.x >= r.x && p.x <= r.x + r.w)) return p;
    if (!(p.x >= 0) || p.x > cd.width) return cd.start;
    for (const o of cd.objects) {
      if (o.x <= cd.start.x || o.x >= p.x) continue;
      const closedGate = o.type === 'gate' && !G.cond(o.cond);
      const solidWall = o.type === 'breakable' && !!o.w && !(o.flag && G.cond(o.flag));
      if (closedGate || solidWall) return cd.start;
    }
    if (!G.cond(cd.boss.flag) && p.x > cd.boss.x - 300) return cd.start;
    return p;
  }

  reloadChapter(): void {
    this.cameras.main.fadeOut(300);
    this.time.delayedCall(320, () => this.scene.restart());
  }

  /* ======================= update ======================= */

  update(time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    const t = (time - this.time0) / 1000;
    for (const at of this.animatedTiles) { at.t.tilePositionX += at.vx * dt; at.t.tilePositionY += at.vy * dt; }
    for (const s of this.spinners) s.o.rotation += s.v * dt;
    this.updatePlatforms(t, dt);
    this.updateHazards(t);
    this.updateEnemies(t, dt);
    this.updateNpcs(dt);
    this.updateRemotes(dt);

    // safety net: nothing should keep the player frozen once all cutscenes are over
    if (this.player.locked && !cinema.active && !this.falling && !storyRunning()) this.player.locked = false;
    const canControl = !input.blocked && !this.busy && !storyRunning() && !battleActive() && !dialogue.open;
    this.updatePlayer(dt, canControl);
    this.updateArea();
    this.fp.update(t, dt, canControl);
    this.egg.update(canControl ? dt : 0);
    this.updatePartner();
    for (const a of this.extras.values()) a.sync();
    this.updateDarkness(dt);
    this.updateInteractPrompt(canControl);

    if (canControl) {
      if (input.justPressed('menu') || input.justPressed('cancel')) { audio.sfx('menu'); void openPauseMenu(this); }
      else if (input.justPressed('confirm')) this.tryInteract();
      else if (input.justPressed('item')) hud.quickUse();
      else if (input.justPressed('ability')) this.fp.use();
      else if (input.justPressed('partner')) this.cyclePartner();
      else if (input.justPressed('egg')) this.egg.toggle();
    }

    void this.processShowOff();
    this.healStuckState(dt);
    // watchdog: a script that has done nothing for a long time with nothing on screen is stuck → release the player
    if (storyRunning() && storyIdleMs() > 12000 && !dialogue.open && !battleActive() && !this.scene.isActive('Opening')
      && !this.scene.isActive('Stage') && !this.scene.isActive('SkyBattle')
      && !document.querySelector('#ui .layer:not(.out)') && !document.querySelector('.chapter-card, .storybook, .asm-root, .name-card')) {
      console.warn('story watchdog: resetting a stuck script');
      resetStory();
      this.cinema(false);
      void this.follow(0);
    }

    this.triggerCheckT -= dt;
    if (this.triggerCheckT <= 0 && G.isAuthority && !storyRunning() && !battleActive() && !this.busy) {
      this.triggerCheckT = 0.15;
      this.checkTriggers();
    }

    // network position (12 Hz)
    this.posT -= dt;
    if (worldNet.active && this.posT <= 0) {
      this.posT = 1 / 12;
      worldNet.sendPos({ key: G.net!.localKey, x: Math.round(this.player.x), z: Math.round(this.player.z), y: Math.round(this.player.y), f: this.player.facingX * (this.player.view === 'side' ? 1 : this.player.view === 'front' ? 2 : 3), a: this.player.state, t: Date.now() });
    }
    if (this.healCooldown > 0) this.healCooldown -= dt;
    if (this.invuln > 0) { this.invuln -= dt; this.player.sprite.setAlpha(Math.floor(this.invuln * 12) % 2 ? 0.4 : 1); }
    else this.player.sprite.setAlpha(1);
    if (G.mode === 'single' && G.local) G.local.totalPlayTime += dt;
    const hp = G.mode === 'single' ? G.state.playerHP : -2;
    if (hp !== this.lastHp) { this.lastHp = hp; hud.update(); }
    input.endFrame();
  }

  private stuckT = 0;

  /**
   * Safety net (seen on iPhones): a cutscene, menu or dialogue that ended abnormally can leave a
   * lock behind — dialogue box state, an input blocker, the cutscene lock or the busy flag — and the
   * player can no longer talk or move. If such a lock stays with nothing on screen to explain it,
   * release it.
   */
  private healStuckState(dt: number): void {
    // multiplayer guests show the host's dialogue / cutscenes without running a script themselves
    if (!G.isAuthority) return;
    const screenUp = battleActive() || this.showingOff || this.falling
      || this.scene.isActive('Opening') || this.scene.isActive('Stage') || this.scene.isActive('SkyBattle')
      || !!document.querySelector('#ui .layer:not(.out), .chapter-card, .storybook, .asm-root, .name-card, .ending, .rotate-lock.show');
    const lockedUp = dialogue.open || this.busy || cinema.active || input.blocked || this.player.locked;
    this.stuckT = !screenUp && !storyRunning() && lockedUp ? this.stuckT + dt : 0;
    if (this.stuckT < 1.5) return;
    console.warn('releasing a leftover lock', { dialogue: dialogue.open, busy: this.busy, cinema: cinema.active, blocked: input.blocked });
    this.stuckT = 0;
    if (dialogue.open) dialogue.hide();
    if (cinema.active) this.cinema(false);
    this.busy = false;
    this.player.locked = false;
    input.clearBlockers();
  }

  private platformAt(x: number, z: number): PlatView | null {
    for (const p of this.plats) if (p.on && Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2 + 6) return p;
    return null;
  }

  private updatePlatforms(t: number, dt: number): void {
    for (const p of this.plats) {
      const ph = Math.sin((t / p.period) * Math.PI * 2);
      const nx = p.x0 + p.dx * ph, nz = p.z0 + p.dz * ph;
      p.vx = (nx - p.x) / Math.max(dt, 0.001);
      p.vz = (nz - p.z) / Math.max(dt, 0.001);
      p.x = nx;
      p.z = nz;
      const y = zToY(nz);
      p.img.setPosition(nx, y).setDepth(y - 20);
      // painted / secret platforms only exist while their condition holds
      const shown = !p.def.showIf || G.cond(p.def.showIf);
      // (multiplayer: nobody may have the right partner, so secret paths simply stay visible)
      const secret = p.def.secret ? G.mode === 'multi' || (this.fp?.reveal[p.def.secret] ?? 0) > 0 : true;
      const on = shown && secret && this.egg.has(p.def.world);
      if (on !== p.on) {
        p.on = on;
        if (on) { p.img.setAlpha(0).setVisible(true); this.tweens.add({ targets: p.img, alpha: 1, duration: 350 }); this.paperBurst(nx, y - 10, 0xffffff, 6); }
      }
      if (!on) {
        // a faint shimmer hints at secret platforms (and at the other world's platforms)
        const hint = (p.def.secret || p.def.world) && shown ? 0.07 + Math.max(0, Math.sin(t * 2 + p.x0)) * 0.08 : 0;
        p.img.setVisible(hint > 0).setAlpha(hint);
      } else if (p.def.secret && (this.fp?.reveal[p.def.secret] ?? 0) < 2) p.img.setAlpha(Math.floor(t * 8) % 2 ? 0.5 : 1);
    }
  }

  private updateHazards(t: number): void {
    for (const h of this.hazards) {
      const per = h.zone.period ?? 2, duty = h.zone.duty ?? 0.4;
      const ph = (t % per) / per;
      const active = ph < duty && this.zoneOn(h.zone);
      if (active && !h.active) { audio.sfx('hammer', 0.6); if (settings.current.screenShake) this.cameras.main.shake(80, 0.004); }
      h.active = active;
      const target = active ? GROUND_TOP + 80 : GROUND_TOP - 300;
      h.piston.y += (target - h.piston.y) * (active ? 0.5 : 0.08);
    }
  }

  /** Zones tagged with a world only work there; in the pixel world every machine stops. */
  zoneOn(z: ZoneDef): boolean {
    if (!this.egg.has(z.world)) return false;
    if (this.egg.on && !z.world && (z.type === 'conveyor' || z.type === 'hazard')) return false;
    // …and there is no water: no currents, no need to hold your breath
    if (this.egg.on && !z.world && (z.type === 'current' || z.type === 'deep')) return false;
    return true;
  }

  private inZone(z: ZoneDef, x: number, zz: number): boolean {
    return x >= z.x && x <= z.x + z.w && zz >= (z.z0 ?? 0) && zz <= (z.z1 ?? DEPTH);
  }

  private updatePlayer(dt: number, canControl: boolean): void {
    const p = this.player;
    if (p.locked) { p.sync(); return; }
    const ax = canControl ? input.axis() : { x: 0, y: 0, run: false };
    const under = !!this.chapter.theme.underwater;
    const speed = (ax.run ? RUN : WALK) * (under ? 0.82 : 1);
    let vx = ax.x * speed, vz = ax.y * ZSPEED * (ax.run ? 1.3 : 1);
    if (p.y > 0 && this.airVX) vx = this.airVX;

    // environment forces
    let grounded = p.y <= 0.01;
    for (const z of this.chapter.zones) {
      if (!this.inZone(z, p.x, p.z) || !this.zoneOn(z)) continue;
      if (z.type === 'wind' || z.type === 'current') { vx += z.fx ?? 0; vz += z.fz ?? 0; }
      if (z.type === 'conveyor' && grounded) vx += z.fx ?? 0;
    }
    if (grounded && this.onPlatform) { vx += this.onPlatform.vx; vz += this.onPlatform.vz; }

    // jump
    if (canControl && grounded && input.justPressed('jump')) {
      p.vy = under ? 470 : 540;
      this.airVX = 0;
      audio.sfx('jump');
      p.spin();
      this.revealHiddenChests();
    }
    // gravity
    if (p.y > 0 || p.vy > 0) {
      p.vy -= (under ? 760 : 1450) * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0; p.vy = 0; this.airVX = 0;
        audio.sfx('land');
        this.landOnEnemyCheck(false);
      }
    }
    grounded = p.y <= 0.01;

    // attack
    if (canControl && input.justPressed('attack') && this.attackT <= 0) {
      this.attackT = 0.42;
      p.play('attack', true);
      audio.sfx('swing');
      this.time.delayedCall(170, () => this.hammerHit());
    }
    if (this.attackT > 0) this.attackT -= dt;

    // move with blockers
    let nx = p.x + vx * dt;
    const nz = clamp(p.z + vz * dt, 4, DEPTH - 4);
    nx = this.applyBlockers(p.x, nx, nz);
    nx = clamp(nx, this.area.x0 + 30, this.area.x1 - 30);
    p.x = nx;
    p.z = nz;

    // platforms & pits
    this.onPlatform = grounded ? this.platformAt(p.x, p.z) : null;
    if (grounded && !this.onPlatform) {
      const pit = this.chapter.zones.find((z) => z.type === 'pit' && this.zoneOn(z) && this.inZone(z, p.x, p.z));
      if (pit) { this.fallIntoPit(); return; }
      this.safeTimer -= dt;
      if (this.safeTimer <= 0) {
        this.safeTimer = 0.25;
        const nearPit = this.chapter.zones.some((z) => z.type === 'pit' && p.x > z.x - 60 && p.x < z.x + z.w + 60);
        if (!nearPit) this.lastSafe = { x: p.x, z: p.z };
      }
      // hazards
      for (const h of this.hazards) if (h.active && this.inZone(h.zone, p.x, p.z) && this.invuln <= 0 && !this.fp.shielded) this.hurtPlayer(h.zone.dmg ?? 1, -p.facingX);
      // springs
      const spring = this.objects.find((o) => o.def.type === 'spring' && Math.abs(o.def.x - p.x) < 34 && Math.abs(o.def.z - p.z) < 30);
      if (spring && p.vy === 0) {
        p.vy = 860;
        p.y = 1;
        this.airVX = (Math.abs(vx) > 10 ? Math.sign(vx) : p.facingX) * 430;
        audio.sfx('spring');
        p.spin();
        this.tweens.add({ targets: spring.img[0], scaleY: spring.img[0].scaleY * 0.6, yoyo: true, duration: 90 });
      }
      // heal pads
      const pad = this.objects.find((o) => o.def.type === 'heal' && Math.abs(o.def.x - p.x) < 60 && Math.abs(o.def.z - p.z) < 30);
      if (pad && this.healCooldown <= 0) { this.healCooldown = 4; this.healParty(); }
    }

    // animation
    const moving = Math.abs(ax.x) > 0.1 || Math.abs(ax.y) > 0.1;
    if (moving) p.face(ax.x, ax.y);
    if (this.attackT > 0) { /* keep attack anim */ }
    else if (!grounded) p.play(p.vy > 0 ? 'jump' : 'fall');
    else if (moving) {
      p.play(ax.run ? 'run' : 'walk');
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = ax.run ? 0.22 : 0.32; audio.sfx('step'); }
    } else p.play('idle');
    p.sync();
    this.reflect(p);
  }

  private reflect(a: Actor): void {
    if (!a.reflection) return;
    const w = this.pitWater.find((pw) => a.x > pw.x && a.x < pw.x + pw.w);
    if (w || this.chapter.theme.underwater) {
      a.showReflection(zToY(a.z) + 2);
      if (a.reflection) a.reflection.setAlpha(this.chapter.theme.underwater ? 0.12 : 0.3);
    }
  }

  private applyBlockers(ox: number, nx: number, z: number): number {
    for (const o of this.objects) {
      const d = o.def;
      let solid = false, r = 46;
      if (d.world && !this.egg.has(d.world)) continue;
      if (d.type === 'gate' && !o.open) solid = true;
      if (d.type === 'egg_wall' && (!d.showIf || G.cond(d.showIf))) solid = true;
      if (d.type === 'breakable' && !o.broken) { solid = true; if (!d.w) { r = 40; if (Math.abs(z - d.z) > 34) solid = false; } }
      if (d.type === 'ability' && !o.open && (d.look === 'food_wall' || d.look === 'paint_wall' || d.look === 'bear') && (!d.showIf || G.cond(d.showIf))) { solid = true; r = d.look === 'bear' ? 70 : 50; }
      if (!solid) continue;
      if (ox <= d.x - r && nx > d.x - r) nx = d.x - r;
      else if (ox >= d.x + r && nx < d.x + r) nx = d.x + r;
      else if (Math.abs(nx - d.x) < r) nx = ox < d.x ? d.x - r : d.x + r;
    }
    return nx;
  }

  private falling = false;

  private fallIntoPit(): void {
    const p = this.player;
    p.locked = true;
    this.falling = true;
    audio.sfx('hurt');
    this.tweens.add({
      targets: p.sprite, y: p.sprite.y + 80, alpha: 0, scaleX: p.sprite.scaleX * 0.5, duration: 350, ease: 'Quad.in',
      onComplete: () => {
        p.x = this.lastSafe.x; p.z = this.lastSafe.z; p.y = 0; p.vy = 0;
        p.sprite.setAlpha(1);
        p.locked = false;
        this.falling = false;
        p.sync();
        this.damageHero(1);
        this.invuln = 1.2;
        toast('掉下去了！被送回岸邊。', 'warn', 1500);
      },
    });
  }

  private hurtPlayer(dmg: number, dir: number): void {
    this.invuln = 1.3;
    this.player.x += dir * 70;
    this.player.play('hurt', true);
    audio.sfx('hurt');
    if (settings.current.screenShake) this.cameras.main.shake(120, 0.006);
    this.damageHero(dmg);
  }

  private damageHero(dmg: number): void {
    if (G.mode !== 'single') return;
    const hp = Math.max(1, G.state.playerHP - dmg);
    G.dispatch({ a: 'partyVitals', hp: { hero: hp }, sp: {} });
    hud.update();
  }

  private healParty(): void {
    audio.sfx('heal');
    this.paperBurst(this.player.x, zToY(this.player.z) - 60, 0x8affa0);
    if (G.mode === 'single') {
      const party = G.buildParty();
      const hp: Record<string, number> = {}, sp: Record<string, number> = {};
      for (const m of party) { hp[m.key] = m.stats.maxHP; sp[m.key] = m.stats.maxSP; }
      G.dispatch({ a: 'partyVitals', hp, sp });
    } else if (G.net?.isHost) {
      for (const r of G.net.roster) { r.hp = r.stats.maxHP; r.sp = r.stats.maxSP; }
      bus.emit('net:rosterDirty');
    } else worldNet.requestInteract('heal', 'pad');
    toast('HP 和技能點數全部回復了！', 'good', 1600);
    hud.update();
  }

  private updatePartner(): void {
    const pa = this.partner;
    if (!pa) return;
    const p = this.player;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 6 || Math.abs(last.y - p.y) > 4) this.trail.push({ x: p.x, z: p.z, y: p.y });
    if (this.trail.length > 400) this.trail.shift();
    const idx = Math.max(0, this.trail.length - 14);
    const tgt = this.trail[idx] ?? { x: p.x - 60, z: p.z, y: 0 };
    const dx = tgt.x - pa.x, dz = tgt.z - pa.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 600) { pa.x = p.x - 50; pa.z = p.z; }
    if (dist > 4) {
      pa.x += dx * 0.18; pa.z += dz * 0.18;
      pa.face(dx / Math.max(dist, 1), dz / Math.max(dist, 1));
      pa.play(dist > 40 ? 'run' : 'walk');
    } else pa.play('idle');
    pa.y = tgt.y;
    pa.sync();
  }

  private updateRemotes(dt: number): void {
    if (!worldNet.active) {
      if (this.remotes.size) { for (const r of this.remotes.values()) r.destroy(); this.remotes.clear(); }
      return;
    }
    for (const [key, rp] of worldNet.remotes) {
      if (key === G.net?.localKey) continue;
      let a = this.remotes.get(key);
      if (!a) {
        a = new Actor(this, { charId: rp.charId as any }, rp.x, rp.z);
        a.setLabel(rp.name, '#9fd8ff');
        this.remotes.set(key, a);
      }
      const k = Math.min(1, dt * 12);
      a.x += (rp.x - a.x) * k;
      a.z += (rp.z - a.z) * k;
      a.y += (rp.y - a.y) * k;
      const view = Math.abs(rp.f) === 1 ? 'side' : Math.abs(rp.f) === 2 ? 'front' : 'back';
      if (view === 'side') a.face(Math.sign(rp.f), 0); else a.face(0, view === 'front' ? 1 : -1);
      a.play((rp.a as any) || 'idle');
      a.sprite.setAlpha(rp.connected ? 1 : 0.4);
      a.label?.setText(rp.connected ? rp.name : `${rp.name}（斷線）`);
      a.sync();
    }
    for (const [key, a] of this.remotes) if (!worldNet.remotes.has(key)) { a.destroy(); this.remotes.delete(key); }
  }

  private updateNpcs(dt: number): void {
    for (const n of this.npcs) {
      if (!n.actor.visible) continue;
      const dx = this.player.x - n.actor.x;
      if (cinema.active || n.busy) { n.actor.sync(); continue; }
      if (Math.abs(dx) < 160 && Math.abs(this.player.z - n.actor.z) < 80) { n.actor.face(Math.sign(dx), 0); n.actor.play('idle'); }
      else if (n.def.wander) {
        n.t += dt;
        const nx = n.baseX + Math.sin(n.t * 0.6) * n.def.wander;
        n.actor.face(nx - n.actor.x, 0);
        n.actor.x = nx;
        n.actor.play('walk');
      }
      n.actor.sync();
    }
  }

  private updateEnemies(t: number, dt: number): void {
    const chasing = !!this.fp?.chase;
    for (const e of this.enemies) {
      const visible = e.alive && (!e.showIf || G.cond(e.showIf)) && !(G.mode === 'multi' && G.cond(`defeated:${e.id}`));
      e.spr.setVisible(visible);
      e.shadow.setVisible(visible && !e.hidden);
      e.zzz?.setVisible(visible && e.ai === 'sleeper' && e.awake <= 0);
      if (!visible) continue;
      const px = this.player.x, pz = this.player.z;
      const dist = Math.hypot(px - e.x, (pz - e.z) * 1.5);
      const blocked = this.busy || storyRunning() || battleActive() || input.blocked || chasing || this.egg.on;
      const hiddenPlayer = !!this.fp?.hidden;
      const lure = this.fp?.lureFor(e.x, e.z) ?? null;
      const running = input.axis().run && (Math.abs(input.axis().x) > 0.2 || Math.abs(input.axis().y) > 0.2);
      let speed = 95, sight = 230;
      if (e.ai === 'chaser') { speed = 150; sight = 380; }
      // ambushers wait out of sight until you come close
      if (e.hidden) {
        e.spr.setAlpha(0.0);
        if (!blocked && dist < 170 && !hiddenPlayer) {
          e.hidden = false;
          e.spr.setAlpha(1);
          this.emoteAt(e.x, zToY(e.z) - 110, '!');
          audio.sfx('warning');
          this.tweens.add({ targets: e.spr, scaleY: { from: 0.2, to: e.spr.scaleY }, duration: 260, ease: 'Back.out' });
          e.awake = 3;
        } else {
          // a rustle gives the hiding place away
          if (Math.random() < dt * 1.2) this.paperBurst(e.x, zToY(e.z) - 10, 0xc8b8a0, 3);
          continue;
        }
      }
      if (e.ai === 'sleeper' && e.awake <= 0) {
        e.zzz?.setPosition(e.x + 30 + Math.sin(t * 2) * 6, zToY(e.z) - 100 - (t * 20) % 20);
        e.spr.setAngle(Math.sin(t * 1.5) * 4);
        const wakes = !blocked && !hiddenPlayer && (dist < 70 || (running && dist < 240));
        if (wakes) { e.awake = 4; this.emoteAt(e.x, zToY(e.z) - 110, '!'); audio.sfx('warning'); e.spr.setAngle(0); }
        else {
          // jumping on a sleeping enemy still starts a first-strike battle
          if (!blocked && dist < 52 && this.player.y > 5 && this.player.vy < 0 && this.invuln <= 0) this.startFieldBattle(e, 'jump');
          const y0 = zToY(e.z);
          e.spr.setPosition(e.x, y0).setDepth(y0);
          e.shadow.setPosition(e.x, y0).setDepth(y0 - 1);
          continue;
        }
      }
      if (e.awake > 0) { e.awake -= dt; speed = Math.max(speed, 140); sight = 420; }
      const wasChasing = e.chase;
      e.chase = !blocked && !hiddenPlayer && !lure && dist < sight && Math.abs(px - e.x0) < e.range + sight + 30;
      if (e.chase && !wasChasing && e.ai === 'chaser' && !e.alerted) { e.alerted = true; this.emoteAt(e.x, zToY(e.z) - 110, '!'); }
      if (!e.chase && dist > sight + 200) e.alerted = false;
      if (lure && !blocked) {
        // distracted by Memetchi's cake
        const dx = lure.x - e.x, dz = lure.z - e.z;
        if (Math.hypot(dx, dz) > 40) { e.x += Math.sign(dx) * 120 * dt; e.z += Math.sign(dz) * 70 * dt; }
        else if (Math.random() < dt * 2) this.paperBurst(e.x, zToY(e.z) - 40, 0xff8ac4, 2);
      } else if (e.chase) {
        e.x += Math.sign(px - e.x) * speed * dt;
        e.z += Math.sign(pz - e.z) * speed * 0.6 * dt;
      } else {
        const tx = e.x0 + Math.sin(t * 0.7 + e.phase) * e.range;
        e.x += (tx - e.x) * Math.min(1, dt * 2);
        e.z += (e.z0 - e.z) * Math.min(1, dt * 1.5);
      }
      e.z = clamp(e.z, 6, DEPTH - 6);
      e.hop = Math.abs(Math.sin(t * (e.chase ? 9 : 6) + e.phase)) * (e.chase ? 12 : 4);
      const flying = ENEMIES[e.enemy].traits.includes('flying');
      const y = zToY(e.z);
      e.spr.setPosition(e.x, y - e.hop - (flying ? 50 : 0)).setDepth(y).setScale(0.8 * depthScale(e.z));
      e.spr.setFlipX((lure ? lure.x : px) < e.x);
      e.shadow.setPosition(e.x, y).setDepth(y - 1).setScale(0.55 * depthScale(e.z), 0.8);
      // contact
      if (!blocked && dist < 52 && this.player.y < 40 && this.invuln <= 0) {
        this.startFieldBattle(e, this.player.vy < 0 && this.player.y > 5 ? 'jump' : null);
      }
    }
  }

  /** A "!" bubble at a world position (enemies spotting you). */
  private emoteAt(x: number, y: number, emote: string): void {
    const b = this.add.image(x + 26, y, 'emote_bubble').setDepth(9600).setScale(0.1);
    const t = this.add.text(x + 26, y - 4, emote, { fontFamily: FONT, fontSize: '28px', color: '#e8203a' }).setOrigin(0.5).setDepth(9601).setScale(0.1);
    this.tweens.add({ targets: [b, t], scale: 0.8, duration: 180, ease: 'Back.out' });
    this.time.delayedCall(900, () => { b.destroy(); t.destroy(); });
  }

  private landOnEnemyCheck(_: boolean): void {
    for (const e of this.enemies) {
      if (!e.alive || !e.spr.visible) continue;
      if (Math.abs(e.x - this.player.x) < 50 && Math.abs(e.z - this.player.z) < 30) { this.startFieldBattle(e, 'jump'); return; }
    }
  }

  private updateDarkness(dt: number): void {
    const inDark = this.chapter.zones.some((z) => z.type === 'dark' && this.player.x >= z.x && this.player.x <= z.x + z.w);
    this.darkAlpha += ((inDark ? 1 : 0) - this.darkAlpha) * Math.min(1, dt * 3);
    this.darkMask.setAlpha(this.darkAlpha);
    if (this.darkAlpha > 0.01) {
      const cam = this.cameras.main;
      this.darkMask.setPosition(this.player.x - cam.scrollX, zToY(this.player.z) - 50 - this.player.y);
    }
  }

  /* ======================= interactions ======================= */

  private nearest(): { kind: string; id: string; x: number; y: number } | null {
    const p = this.player;
    let best: { kind: string; id: string; x: number; y: number; d: number } | null = null;
    const consider = (kind: string, id: string, x: number, z: number, yOff: number, range = 90, bias = 0) => {
      const raw = Math.hypot(x - p.x, (z - p.z) * (kind === 'npc' ? 0.8 : 1.2));
      const d = raw - bias;
      if (raw < range && (!best || d < best.d)) best = { kind, id, x, y: zToY(z) - yOff, d };
    };
    // NPCs: generous range (any depth in front of / behind them) and priority over nearby props
    for (const n of this.npcs) if (n.actor.visible) consider('npc', n.def.id, n.actor.x, n.actor.z, 130, 140, 30);
    for (const c of this.chests) if (c.img.visible && !G.cond(`chest:${c.def.id}`)) consider('chest', c.def.id, c.def.x, c.def.z, 90);
    for (const o of this.objects) {
      const d = o.def;
      if (d.showIf && !G.cond(d.showIf)) continue;
      if (d.world && !this.egg.has(d.world)) continue;
      if (d.type === 'sign' || d.type === 'savepoint' || d.type === 'door' || d.type === 'shard' || d.type === 'switch') consider(d.type, d.id, d.x, d.z, d.type === 'savepoint' ? 170 : 110);
      if (d.type === 'ability' && !o.open) consider('ability', d.id, d.x, d.look === 'paint_bridge' || d.look === 'food_wall' || d.look === 'paint_wall' ? p.z : d.z, 140, d.look === 'paint_bridge' ? 200 : 130);
    }
    return best;
  }

  /** Screen tap (client coordinates) on the interact bubble → interact. */
  private tapBubbleAt(clientX: number, clientY: number): boolean {
    const b = this.interactBubble;
    if (!b?.visible || input.blocked || storyRunning() || battleActive() || this.busy) return false;
    const r = this.game.canvas.getBoundingClientRect();
    const gx = ((clientX - r.left) / r.width) * this.scale.width;
    const gy = ((clientY - r.top) / r.height) * this.scale.height;
    const p = this.cameras.main.getWorldPoint(gx, gy);
    if (Math.abs(p.x - b.x) < 90 && p.y > b.y - 70 && p.y < b.y + 170) { this.tryInteract(); return true; }
    return false;
  }

  private updateInteractPrompt(can: boolean): void {
    const n = can ? this.nearest() : null;
    this.interactBubble.setVisible(!!n);
    this.interactText.setVisible(!!n);
    if (n) {
      const bob = Math.sin(this.time.now / 160) * 4;
      this.interactBubble.setPosition(n.x, n.y - 10 + bob);
      this.interactText.setPosition(n.x, n.y - 14 + bob).setText(n.kind === 'npc' ? '…' : n.kind === 'chest' ? '?' : n.kind === 'ability' ? '★' : '!');
    }
  }

  private tryInteract(): void {
    const n = this.nearest();
    if (!n) return;
    if (n.kind === 'ability') { void this.tryAbilitySpot(n.id); return; }
    if (G.mode === 'multi' && !G.isAuthority && n.kind !== 'savepoint' && n.kind !== 'sign') {
      worldNet.requestInteract(n.kind, n.id);
      audio.sfx('click');
      return;
    }
    void this.interact(n.kind, n.id, G.localMemberKey());
  }

  /** Authority-side interaction handler (also called for remote players' requests). */
  async interact(kind: string, id: string, _who: string, extra?: any): Promise<void> {
    if (storyRunning() || battleActive()) return;
    switch (kind) {
      case 'npc': {
        const n = this.npcs.find((x) => x.def.id === id);
        if (!n || !n.actor.visible) return;
        const rule = n.def.talk.find((r) => G.cond(r.if)) ?? n.def.talk[n.def.talk.length - 1];
        n.actor.play('talk');
        await this.runStory(rule.script);
        n.actor.play('idle');
        break;
      }
      case 'chest': {
        const c = this.chests.find((x) => x.def.id === id);
        if (!c || G.cond(`chest:${id}`)) return;
        audio.sfx('chest');
        this.broadcastFx('sfx', 'chest');
        c.img.setTexture(ensureObject(this, 'chest_open'));
        this.paperBurst(c.def.x, zToY(c.def.z) - 60, 0xfff6a0);
        G.dispatch({ a: 'chest', id, items: c.def.items ?? [], coins: c.def.coins ?? 0 });
        break;
      }
      case 'sign': {
        const o = this.objects.find((x) => x.def.id === id);
        if (o?.def.text) await this.runStory([{ who: 'narrator', text: o.def.text }], true);
        break;
      }
      case 'savepoint': {
        audio.sfx('save');
        if (G.mode === 'multi') { await saves.write('manual'); toast('你的等級與經驗值已保存！（多人進度由房主管理）', 'save'); return; }
        const ok = await confirmDialog('存檔方塊', '要保存目前的冒險進度嗎？', '保存', '不要');
        if (ok) await saves.write('manual');
        break;
      }
      case 'door': {
        const o = this.objects.find((x) => x.def.id === id);
        if (!o?.def.to) return;
        audio.sfx('door');
        this.busy = true;
        this.cameras.main.fadeOut(250);
        await new Promise((r) => this.time.delayedCall(260, r));
        this.player.x = o.def.to.x; this.player.z = o.def.to.z;
        if (this.partner) { this.partner.x = o.def.to.x - 50; this.partner.z = o.def.to.z; this.trail = []; }
        if (o.def.flag) G.dispatch({ a: 'flag', k: o.def.flag, v: true });
        else if (o.def.look !== 'room') toast('……好像回到了起點。', 'warn', 1500);
        this.updateArea();
        this.cameras.main.fadeIn(250);
        this.busy = false;
        break;
      }
      case 'switch': this.activateSwitch(id); break;
      case 'shard': {
        const o = this.objects.find((x) => x.def.id === id);
        if (!o || (o.def.showIf && !G.cond(o.def.showIf))) return;
        audio.sfx('shard');
        const n = this.chapter.num;
        await this.runStory([
          { do: 'cinema', on: true },
          { do: 'follow', ms: 300 },
          { do: 'fx', name: 'shardRise', x: o.def.x },
          { do: 'anim', actor: 'hero', anim: 'win', ms: 1500 },
          { do: 'banner', title: '取得星之心碎片！', sub: `${n} / 8` },
          { do: 'wait', ms: 1200 },
          ...this.chapter.outro,
        ]);
        break;
      }
      case 'heal': this.healParty(); break;
      case 'ability': await this.abilitySpot(id, extra?.who); break;
      case 'eat': this.eatEnemy(id); break;
      case 'chaseDone': { const c = this.chapter.chases?.find((x) => x.id === id); if (c) G.dispatch({ a: 'flag', k: c.flag, v: true }); break; }
      case 'mirrorDone': if (this.chapter.mirror?.flag === id) G.dispatch({ a: 'flag', k: id, v: true }); break;
      case 'hammer': this.hammerAt(Number(id), Number(extra?.z ?? 120)); break;
      case 'enemy': await this.fieldBattle(id, extra?.kind ?? null); break;
    }
  }

  private activateSwitch(id: string): void {
    const o = this.objects.find((x) => x.def.id === id);
    if (!o) return;
    const d = o.def;
    if (d.flag && G.cond(d.flag)) return;
    audio.sfx('switch');
    this.broadcastFx('sfx', 'switch');
    if (!d.group) {
      if (d.flag) G.dispatch({ a: 'flag', k: d.flag, v: true });
      toast(`「${d.text ?? '開關'}」啟動了！`, 'good', 1400);
      return;
    }
    const groupSw = this.objects.filter((x) => x.def.group === d.group).sort((a, b) => (a.def.order ?? 0) - (b.def.order ?? 0));
    const progress = Number(G.state.storyFlags[`seq:${d.group}`] ?? 0);
    if ((d.order ?? 0) === progress + 1) {
      G.dispatch({ a: 'flag', k: `seq:${d.group}`, v: progress + 1 });
      if (d.flag) G.dispatch({ a: 'flag', k: d.flag, v: true });
      if (progress + 1 === groupSw.length) { audio.sfx('quest'); toast('機關解開了！', 'quest'); }
      else toast(`「${d.text}」亮起來了！（${progress + 1}/${groupSw.length}）`, 'good', 1400);
    } else {
      audio.sfx('error');
      toast('順序不對！機關重置了。', 'warn');
      G.dispatch({ a: 'flag', k: `seq:${d.group}`, v: 0 });
      for (const s of groupSw) if (s.def.flag) G.dispatch({ a: 'flag', k: s.def.flag, v: false });
    }
  }

  private hammerHit(): void {
    const p = this.player;
    const hx = p.x + p.facingX * 60;
    this.paperBurst(hx, zToY(p.z) - 30, 0xffffff, 4);
    if (G.mode === 'multi' && !G.isAuthority) {
      // breakables/switches are host-side; enemies start battles via the host
      worldNet.requestInteract('hammer', String(Math.round(hx)), { z: p.z });
      for (const e of this.enemies) if (e.alive && Math.abs(e.x - hx) < 60 && Math.abs(e.z - p.z) < 45) this.startFieldBattle(e, 'hammer');
      return;
    }
    this.hammerAt(hx, p.z);
  }

  hammerAt(hx: number, z: number): void {
    for (const o of this.objects) {
      const d = o.def;
      if (Math.abs(d.x - hx) > 70) continue;
      if (d.type === 'breakable' && !o.broken && (d.w || Math.abs(d.z - z) < 50)) {
        audio.sfx('break');
        this.broadcastFx('sfx', 'break');
        if (d.flag) G.dispatch({ a: 'flag', k: d.flag, v: true });
        else { o.broken = true; o.img.forEach((i) => i.setVisible(false)); }
        return;
      }
      if (d.type === 'switch' && Math.abs(d.z - z) < 50 && (!d.showIf || G.cond(d.showIf))) { this.activateSwitch(d.id); return; }
    }
    for (const e of this.enemies) if (e.alive && e.spr.visible && Math.abs(e.x - hx) < 60 && Math.abs(e.z - z) < 45) { this.startFieldBattle(e, 'hammer'); return; }
    audio.sfx('hammer', 1.3);
  }

  private revealHiddenChests(): void {
    for (const c of this.chests) {
      if (c.revealed || !c.def.hidden) continue;
      if (Math.abs(c.def.x - this.player.x) < 70 && Math.abs(c.def.z - this.player.z) < 50) {
        c.revealed = true;
        this.refreshChest(c);
        c.img.setScale(0.1);
        this.tweens.add({ targets: c.img, scale: depthScale(c.def.z) * 0.85, duration: 400, ease: 'Back.out' });
        audio.sfx('item');
        this.emote('player', '!');
        toast('發現了隱藏寶箱！', 'good', 1500);
      }
    }
  }

  /* ======================= story / battle ======================= */

  private checkTriggers(): void {
    const xs = [this.player.x, ...[...worldNet.remotes.values()].filter((r) => r.connected).map((r) => r.x)];
    const near = (x: number, w: number) => xs.some((px) => px >= x && px <= x + w);
    for (const t of this.chapter.triggers) {
      if (t.once !== false && G.cond(`trig:${t.id}`)) continue;
      if (!G.cond(t.if)) continue;
      if (!near(t.x, t.w ?? 80)) continue;
      if (t.once !== false) G.dispatch({ a: 'flag', k: `trig:${t.id}`, v: true });
      void this.runStory(t.script);
      return;
    }
    const b = this.chapter.boss;
    if (!G.cond(b.flag) && xs.some((x) => x > b.x - 260)) void this.bossSequence();
  }

  private async bossSequence(): Promise<void> {
    const b = this.chapter.boss;
    this.player.x = Math.min(this.player.x, b.x - 280);
    const def = ENEMIES[b.enemy];
    const bossName = def?.name ?? '';
    // Paper-style boss entrance: the camera pushes in, the boss roars, a name card slides in
    const entrance: Script = [
      { do: 'cinema', on: true },
      { do: 'gather', on: true },
      { do: 'pan', x: b.x - 160, ms: 1400 },
      { do: 'zoom', z: 1.18, ms: 500 },
      { do: 'fx', name: 'bossRoar' },
      { do: 'card', title: bossName, sub: def?.epithet ?? 'BOSS', enemy: b.enemy, color: '#e8203a' },
      { do: 'zoom', z: 1, ms: 400 },
      { do: 'follow', ms: 500 },
    ];
    const ok = await this.runStory([...entrance, ...b.pre]);
    if (!ok || !G.cond(b.flag)) return;
    bus.emit('boss:defeated', b.id);
    bus.emit('autosave', 'boss');
    // the guardian calms down and the colour floods back into the world
    const victory: Script = [
      { do: 'cinema', on: true }, { do: 'gather', on: true }, { do: 'follow', ms: 0 },
      { do: 'anim', actor: 'hero', anim: 'win', ms: 1200 }, { do: 'fx', name: 'bossFade' },
      { do: 'color', sat: 0, ms: 2400, wave: true },
    ];
    await this.runStory([...victory, ...b.post]);
    if (!this.chapter.objects.some((o) => o.type === 'shard')) await this.runStory([{ do: 'cinema', on: true }, { do: 'fx', name: 'starburst', actor: 'hero' }, { do: 'anim', actor: 'hero', anim: 'win', ms: 1600 }, ...this.chapter.outro]);
  }

  async runStory(script: Script, silent = false): Promise<boolean> {
    if (!G.isAuthority) return false;
    void silent;
    return runScript(script, this);
  }

  private startFieldBattle(e: FieldEnemy, kind: 'hammer' | 'jump' | null): void {
    if (battleActive() || storyRunning() || this.busy) return;
    if (G.mode === 'multi' && !G.isAuthority) {
      e.alive = false; // optimistic; host decides
      worldNet.requestInteract('enemy', e.id, { kind });
      this.time.delayedCall(4000, () => { if (!G.cond(`defeated:${e.id}`)) e.alive = true; });
      return;
    }
    void this.fieldBattle(e.id, kind);
  }

  async fieldBattle(enemyId: string, kind: 'hammer' | 'jump' | null): Promise<void> {
    const e = this.enemies.find((x) => x.id === enemyId);
    if (!e || battleActive() || storyRunning()) return;
    e.alive = false;
    const firstStrikeBadge = G.mode === 'single' && G.state.equipment.badges.includes('b_first');
    const first = kind || firstStrikeBadge ? 'party' : 'enemy';
    const res = await this.battle(e.party, { first, firstKind: kind ?? 'hammer' });
    if (res === 'win') { this.paperBurst(e.x, zToY(e.z) - 40); if (G.mode === 'multi') G.dispatch({ a: 'flag', k: `defeated:${e.id}`, v: true }); }
    else if (res === 'flee') { e.alive = true; e.x = e.x0 + 200; this.invuln = 2; }
    else e.alive = true;
  }

  /** StoryHost + field battles. */
  async battle(encounter: string[], opts: { boss?: boolean; music?: string; first?: 'party' | 'enemy' | null; firstKind?: 'hammer' | 'jump' }): Promise<'win' | 'lose' | 'flee'> {
    if (cinema.active) { this.cinema(false); this.broadcastFx('cinema', false); }
    await this.follow(0);
    this.player.play('idle');
    for (;;) {
      const snapshot = JSON.parse(JSON.stringify({ hp: G.state.playerHP, sp: G.state.playerSP, php: G.state.partners.hp, psp: G.state.partners.sp }));
      const out = await runBattle({ encounter, boss: opts.boss, music: opts.music, themeId: this.chapter.theme.id, first: opts.first ?? null, firstKind: opts.firstKind });
      this.invuln = 1.5;
      hud.update();
      if (out.result !== 'lose') return out.result;
      if (G.mode === 'multi') return 'lose';
      const choice = await showGameOver();
      if (choice === 'retry') {
        // restore pre-battle vitals and fight again
        const hp: Record<string, number> = { hero: Math.max(1, snapshot.hp) }, sp: Record<string, number> = { hero: snapshot.sp };
        for (const k of Object.keys(snapshot.php)) hp[k] = Math.max(1, snapshot.php[k]);
        for (const k of Object.keys(snapshot.psp)) sp[k] = snapshot.psp[k];
        G.dispatch({ a: 'partyVitals', hp, sp });
        continue;
      }
      if (choice === 'load') { bus.emit('app:loadLast'); return 'lose'; }
      bus.emit('app:title');
      return 'lose';
    }
  }

  async chapterEnd(): Promise<void> {
    const cd = this.chapter;
    this.busy = true;
    if (G.mode === 'single') G.state.storyFlags[`clear:${cd.id}`] = true;
    else G.dispatch({ a: 'flag', k: `clear:${cd.id}`, v: true });
    bus.emit('chapter:complete', cd.num);
    this.broadcastFx('chapterClear', cd.num);
    await showChapterClear(cd);
    // between chapters: what the villain is up to, then the airship ride to the next place
    for (const k of [cd.id, `${cd.id}b`]) if (INTERLUDES[k]) await this.interlude(k);
    const next = cd.num + 1;
    if (G.local && G.mode === 'multi') G.local.mpHighestChapter = Math.max(G.local.mpHighestChapter, next);
    G.dispatch({ a: 'chapter', n: next });
    if (G.mode === 'single') await saves.write('chapter');
    this.busy = false;
    this.reloadChapter();
  }

  async ending(): Promise<void> {
    this.busy = true;
    G.dispatch({ a: 'flag', k: 'game_clear', v: true });
    if (G.mode === 'single') await saves.write('clear');
    this.broadcastFx('ending', null);
    await playEnding();
    this.busy = false;
    bus.emit('app:title');
  }

  save(): void { void saves.write('story'); }

  shake(ms: number): void {
    if (settings.current.screenShake) this.cameras.main.shake(ms, 0.01);
    audio.sfx('shake');
  }

  flash(color: number): void {
    const c = Phaser.Display.Color.IntegerToRGB(color);
    this.cameras.main.flash(400, c.r, c.g, c.b);
  }

  emote(actor: string, emote: string): void {
    const a = this.actorOf(actor);
    if (!a) return;
    const y = a.sprite.y - 120 * a.scaleNow();
    const b = this.add.image(a.x + 30, y, 'emote_bubble').setDepth(9600).setScale(0.1);
    const t = this.add.text(a.x + 30, y - 4, emote, { fontFamily: FONT, fontSize: '28px', color: '#e8203a' }).setOrigin(0.5).setDepth(9601).setScale(0.1);
    this.tweens.add({ targets: [b, t], scale: 0.9, duration: 200, ease: 'Back.out' });
    this.time.delayedCall(1300, () => { b.destroy(); t.destroy(); });
  }

  moveActor(actor: string, x: number, z?: number): Promise<void> {
    const a = this.actorOf(actor);
    if (!a) return Promise.resolve();
    const npc = this.npcs.find((n) => n.actor === a);
    if (npc) npc.busy = true;
    a.face(Math.sign(x - a.x) || a.facingX, 0);
    a.play('walk');
    return new Promise((r) => this.tweens.add({
      targets: a, x, z: z ?? a.z, duration: Math.abs(x - a.x) * 4 + 200,
      onUpdate: () => a.sync(),
      onComplete: () => { a.play('idle'); if (npc) npc.busy = false; r(); },
    }));
  }

  /* ======================= cutscene host ======================= */

  private actorOf(name: string): Actor | null {
    if (name === 'player' || name === 'hero') return this.player;
    if (name === 'partner') return this.partner;
    const extra = this.extras.get(name);
    if (extra) return extra;
    if (name in CHARACTERS) {
      if (this.partner && G.state.partners.active === name) return this.partner;
      if (G.mode === 'multi') for (const [key, a] of this.remotes) if (worldNet.remotes.get(key)?.charId === name) return a;
    }
    return this.npcs.find((n) => n.def.id === name)?.actor ?? null;
  }

  cinema(on: boolean): void {
    if (on) cinema.on(); else cinema.off();
    if (!on && this.gathered.length) this.gather(false);
    this.player.locked = on;
    hud.setVisible(!on);
  }

  pan(x: number, ms: number): Promise<void> {
    const cam = this.cameras.main;
    cam.stopFollow();
    const tx = clamp(x, this.area.x0 + cam.width / 2, this.area.x1 - cam.width / 2);
    if (ms <= 0) { cam.centerOn(tx, cam.midPoint.y); return Promise.resolve(); }
    return new Promise((r) => {
      cam.pan(tx, cam.midPoint.y, ms, 'Sine.easeInOut', true);
      this.time.delayedCall(ms + 30, () => r());
    });
  }

  async follow(ms: number): Promise<void> {
    if (!this.player) return;
    if (ms > 0) await this.pan(this.player.x, ms);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 120);
  }

  zoom(z: number, ms: number): Promise<void> {
    const cam = this.cameras.main;
    if (ms <= 0) { cam.setZoom(z); return Promise.resolve(); }
    return new Promise((r) => { cam.zoomTo(z, ms, 'Sine.easeInOut', true); this.time.delayedCall(ms + 30, () => r()); });
  }

  placeActor(actor: string, x: number, z?: number): void {
    const a = this.actorOf(actor);
    if (!a) return;
    a.x = x;
    if (z !== undefined) a.z = z;
    a.y = 0;
    a.sync();
    if (a === this.player) this.trail = [];
    if (a === this.player && this.partner) { this.partner.x = x - 60; this.partner.z = a.z; this.partner.sync(); }
  }

  jumpActor(actor: string): Promise<void> {
    if (actor === 'boss' && this.bossSprite) {
      const b = this.bossSprite;
      audio.sfx('jump', 0.7);
      return new Promise((r) => this.tweens.add({ targets: b, y: b.y - 90, yoyo: true, duration: 320, ease: 'Quad.out', onComplete: () => { this.shake(250); r(); } }));
    }
    const a = this.actorOf(actor);
    if (!a) return Promise.resolve();
    audio.sfx('jump');
    a.spin();
    a.play('jump', true);
    const o = { y: 0 };
    return new Promise((r) => this.tweens.add({
      targets: o, y: 110, yoyo: true, duration: 300, ease: 'Quad.out',
      onUpdate: () => { a.y = o.y; a.sync(); },
      onComplete: () => { a.y = 0; a.play('idle', true); a.sync(); audio.sfx('land'); r(); },
    }));
  }

  animActor(actor: string, anim: string, ms: number): Promise<void> {
    const a = this.actorOf(actor);
    if (!a) return Promise.resolve();
    a.play(anim as any, true);
    if (anim === 'win') { a.spin(); this.paperBurst(a.x, zToY(a.z) - 80, 0xfff6a0, 18); audio.sfx('levelup'); }
    if (ms <= 0) { a.play('idle', true); return Promise.resolve(); }
    return new Promise((r) => this.time.delayedCall(ms, () => { a.play('idle', true); r(); }));
  }

  faceActor(actor: string, dir: 1 | -1): void {
    this.actorOf(actor)?.face(dir, 0);
  }

  /** Named visual effects used by cutscenes. */
  fx(name: string, actor?: string, x?: number): Promise<void> {
    const a = actor ? this.actorOf(actor) : null;
    const px = x ?? a?.x ?? this.player.x;
    const py = a ? zToY(a.z) - 80 : GROUND_TOP + 40;
    const delay = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
    switch (name) {
      case 'bossRoar': {
        const b = this.bossSprite;
        audio.sfx('shake');
        this.shake(600);
        if (b) {
          const s = b.scaleX;
          this.tweens.add({ targets: b, scaleX: s * 1.25, scaleY: s * 0.8, yoyo: true, repeat: 2, duration: 140 });
          this.paperBurst(b.x, b.y - 80, 0xff6060, 24);
        }
        return delay(900);
      }
      case 'bossFade': {
        const b = this.bossSprite;
        if (b) this.tweens.add({ targets: b, alpha: 0.25, scaleX: b.scaleX * 0.6, duration: 900 });
        return delay(600);
      }
      case 'shardRise': {
        const img = this.add.image(px, GROUND_TOP + 40, ensureObject(this, 'shard')).setDepth(9400).setScale(0.6);
        const glow = this.add.image(px, GROUND_TOP + 40, 'p_warm').setDepth(9399).setBlendMode(Phaser.BlendModes.ADD).setScale(1);
        audio.sfx('shard');
        this.tweens.add({ targets: [img, glow], y: GROUND_TOP - 150, duration: 1100, ease: 'Sine.out' });
        this.tweens.add({ targets: img, angle: 360, scale: 1.2, duration: 1100 });
        this.tweens.add({ targets: glow, scale: 4, alpha: 0.9, duration: 1100 });
        return delay(1150).then(async () => {
          this.flash(0xfff6c0);
          this.paperBurst(img.x, img.y, 0xfff6a0, 30);
          this.tweens.add({ targets: [img, glow], x: this.player.x, y: zToY(this.player.z) - 70, scale: 0.1, alpha: 0, duration: 600, ease: 'Quad.in', onComplete: () => { img.destroy(); glow.destroy(); } });
          await delay(650);
        });
      }
      case 'starburst': {
        this.flash(0xffffff);
        const p = this.add.particles(px, py, 'p_star', { speed: { min: 120, max: 420 }, lifespan: 1200, quantity: 40, scale: { start: 1.4, end: 0 }, emitting: false }).setDepth(9400);
        p.explode(48);
        audio.sfx('shard');
        this.time.delayedCall(1400, () => p.destroy());
        return delay(1000);
      }
      case 'sparkle': {
        const p = this.add.particles(px, py, 'p_star', { speed: { min: 40, max: 160 }, lifespan: 800, quantity: 16, scale: { start: 1, end: 0 }, emitting: false }).setDepth(9400);
        p.explode(18);
        audio.sfx('magic');
        this.time.delayedCall(1000, () => p.destroy());
        return delay(500);
      }
      case 'darkPuff': {
        const p = this.add.particles(px, py, 'p_mote', { speed: { min: 60, max: 220 }, lifespan: 1000, quantity: 30, scale: { start: 2, end: 0 }, emitting: false }).setDepth(9400);
        p.explode(36);
        audio.sfx('shake');
        this.time.delayedCall(1200, () => p.destroy());
        return delay(700);
      }
      case 'ab_kuchipatchi': case 'ab_memetchi': case 'ab_mimitchi': case 'ab_violetchi':
      case 'ab_oyajitchi': case 'ab_gozarutchi': case 'ab_maskutchi': case 'ab_mametchi': {
        const who = name.slice(3);
        const doer = this.partner ?? this.player;
        const ox = doer.x, oy = zToY(doer.z) - 70;
        const ty = GROUND_TOP + 60;
        if (who === 'kuchipatchi') {
          // everything gets sucked into the big mouth
          audio.sfx('bite');
          const pe = this.add.particles(px, ty, 'p_paper', { x: { min: -60, max: 60 }, y: { min: -120, max: 60 }, moveToX: ox, moveToY: oy, lifespan: 700, frequency: 18, scale: { start: 1.2, end: 0.2 }, tint: [0xffd08a, 0xff8ac4, 0xffffff] }).setDepth(9000);
          if (settings.current.screenShake) this.cameras.main.shake(700, 0.004);
          return delay(900).then(() => { pe.stop(); audio.sfx('bite'); this.time.delayedCall(800, () => pe.destroy()); return delay(300); });
        }
        if (who === 'memetchi') {
          const cake = this.add.image(ox, oy, FieldPlay.tex(this, 'fp:cake', 70, 64, () => undefined)).setDepth(9000);
          audio.sfx('swing');
          this.tweens.add({ targets: cake, x: px + 160, duration: 600 });
          this.tweens.add({ targets: cake, y: { from: oy, to: oy - 140 }, duration: 300, yoyo: true, ease: 'Quad.out' });
          return delay(700).then(() => { audio.sfx('item'); this.paperBurst(px + 160, oy, 0xff8ac4, 14); this.time.delayedCall(1800, () => cake.destroy()); return delay(400); });
        }
        if (who === 'violetchi') {
          audio.sfx('magic');
          const pe = this.add.particles(px, ty, 'p_paper', { x: { min: -140, max: 140 }, y: { min: -160, max: 120 }, speed: { min: 20, max: 120 }, lifespan: 900, frequency: 14, scale: { start: 1.4, end: 0.3 }, tint: [0xff5a8a, 0xffd23a, 0x5ac8ff, 0x8aff7a, 0xb88cff] }).setDepth(9000);
          return delay(1000).then(() => { pe.stop(); this.flash(0xffffff); this.time.delayedCall(1000, () => pe.destroy()); return delay(200); });
        }
        if (who === 'mimitchi' || who === 'mametchi') {
          audio.sfx('magic');
          for (let i = 0; i < 3; i++) {
            const ring = this.add.circle(px, ty, 20, 0, 0).setStrokeStyle(5, 0x9fd8ff).setDepth(9000);
            this.tweens.add({ targets: ring, radius: 300, alpha: 0, delay: i * 250, duration: 900, onComplete: () => ring.destroy() });
          }
          return delay(1000);
        }
        if (who === 'oyajitchi') {
          audio.sfx('magic');
          const glow = this.add.image(px, ty, 'p_warm').setBlendMode(Phaser.BlendModes.ADD).setDepth(8990).setScale(1);
          this.tweens.add({ targets: glow, scale: 10, alpha: 0, duration: 1300, onComplete: () => glow.destroy() });
          return delay(1000);
        }
        this.paperBurst(px, ty, 0x9fd8ff, 20);
        audio.sfx('magic');
        return delay(600);
      }
      case 'poof': {
        this.paperBurst(px, py, 0x6a4a9a, 22);
        audio.sfx('whoosh');
        return delay(300);
      }
      case 'colorWave': this.colorWave(1600); return delay(1600);
      default:
        this.paperBurst(px, py);
        return delay(300);
    }
  }

  opening(): Promise<void> {
    return new Promise((resolve) => {
      const sc = this.scene.get('Opening') as any;
      sc.onDone = () => { this.scene.stop('Opening'); this.scene.resume(); hud.setVisible(!cinema.active); audio.playMusic(this.chapter.music); resolve(); };
      hud.setVisible(false);
      this.scene.pause();
      this.scene.run('Opening');
    });
  }

  /** Establishing shot for a chapter's first visit: pan over the map, then the hero walks in. */
  private establishingShot(): Script {
    const cd = this.chapter;
    return [
      { do: 'cinema', on: true },
      { do: 'place', actor: 'hero', x: Math.max(40, cd.start.x - 280), z: cd.start.z },
      { do: 'pan', x: cd.boss.x, ms: 0 },
      { do: 'pan', x: cd.start.x + 300, ms: 4200, nowait: true },
      { do: 'caption', text: `${cd.location}——${cd.summary}`, ms: 3900 },
      { do: 'move', actor: 'hero', x: cd.start.x, z: cd.start.z },
      { do: 'jump', actor: 'hero' },
      { do: 'follow', ms: 400 },
      { do: 'cinema', on: false },
    ];
  }

  private partnerJoinFx(id: CharId): void {
    const pa = this.partner;
    void cinema.nameCard(`${CHARACTERS[id]?.name ?? ''}`, `夥伴加入！能力：${ABILITIES[id]?.name ?? ''}（${G.mode === 'multi' ? '' : '按 C 使用'}）`, portraitURL({ charId: id }, 'happy'), CHARACTERS[id]?.color ?? '#ff8ac4', 2600);
    if (!pa) return;
    this.paperBurst(pa.x, zToY(pa.z) - 60, 0xfff6a0, 22);
    pa.spin();
    const o = { y: 0 };
    this.tweens.add({ targets: o, y: 90, yoyo: true, duration: 280, ease: 'Quad.out', onUpdate: () => { pa.y = o.y; pa.sync(); }, onComplete: () => { pa.y = 0; pa.sync(); } });
  }


  /* ======================= staging v2 ======================= */

  private lookTarget(look: string | NpcLook, dark?: boolean): DrawTarget {
    if (typeof look !== 'string') return { npc: look, dark };
    if (look in CHARACTERS) return { charId: look as CharId, dark };
    const sp = SPEAKERS[look];
    if (sp) return typeof sp.look === 'string' ? { charId: sp.look, dark: dark ?? sp.dark } : { npc: sp.look, dark: dark ?? sp.dark };
    const npc = this.chapter.npcs.find((n) => n.id === look);
    if (npc) return this.npcTarget(npc);
    return { npc: { color: '#ffffff', accent: '#c0c0c0' }, dark };
  }

  private lookName(look: string | NpcLook): string {
    if (typeof look !== 'string') return '';
    return CHARACTERS[look as CharId]?.name ?? SPEAKERS[look]?.name ?? this.chapter.npcs.find((n) => n.id === look)?.name ?? '';
  }

  spawnActor(actor: string, look: string | NpcLook, x: number, z: number, dark?: boolean, dir?: 1 | -1, fx?: string): void {
    this.extras.get(actor)?.destroy();
    const t = this.lookTarget(look, dark);
    const a = new Actor(this, t, x, clamp(z, 6, DEPTH - 6), 0.86, !!t.charId);
    const name = this.lookName(look);
    if (name) a.setLabel(name, '#fffdf6');
    if (dir) { a.facingX = dir; a.view = 'side'; a.sprite.setFlipX(dir < 0); a.play('idle', true); }
    this.extras.set(actor, a);
    a.sync();
    if (fx === 'poof' || fx === 'pop') {
      this.paperBurst(x, zToY(z) - 50, fx === 'poof' ? 0x6a4a9a : 0xfff6a0, 16);
      const s = a.scaleNow();
      a.sprite.setScale(0.05);
      this.tweens.add({ targets: a.sprite, scale: s, duration: 260, ease: 'Back.out' });
      audio.sfx(fx === 'poof' ? 'whoosh' : 'flip');
    } else if (fx === 'drop') {
      const o = { y: 520 };
      a.y = o.y;
      this.tweens.add({ targets: o, y: 0, duration: 520, ease: 'Bounce.out', onUpdate: () => { a.y = o.y; a.sync(); }, onComplete: () => { a.y = 0; a.sync(); audio.sfx('land'); } });
    }
  }

  despawnActor(actor: string, fx?: string): void {
    const a = this.extras.get(actor);
    if (!a) return;
    this.extras.delete(actor);
    this.tweens.killTweensOf(a);
    if (fx) {
      this.paperBurst(a.x, zToY(a.z) - 50, fx === 'poof' ? 0x6a4a9a : 0xfff6a0, 14);
      audio.sfx(fx === 'poof' ? 'whoosh' : 'flip');
      a.label?.setVisible(false);
      this.tweens.add({ targets: [a.sprite, a.shadow], scaleX: 0.02, alpha: 0, duration: 260, onComplete: () => a.destroy() });
    } else a.destroy();
  }

  walkActor(actor: string, x: number, z: number | undefined, run: boolean): Promise<void> {
    const a = this.actorOf(actor);
    if (!a) return Promise.resolve();
    const npc = this.npcs.find((n) => n.actor === a);
    if (npc) npc.busy = true;
    const tz = z === undefined ? a.z : clamp(z, 6, DEPTH - 6);
    const dx = x - a.x, dz = tz - a.z;
    if (Math.abs(dx) > 4) a.face(Math.sign(dx), 0); else if (Math.abs(dz) > 4) a.face(0, Math.sign(dz));
    a.play(run ? 'run' : 'walk', true);
    const dist = Math.hypot(dx, dz * 1.5);
    this.tweens.killTweensOf(a);
    return new Promise((r) => this.tweens.add({
      targets: a, x, z: tz, duration: dist * (run ? 2.3 : 4.2) + 120,
      onUpdate: () => { if (a.sprite.active) a.sync(); },
      onComplete: () => {
        if (npc) npc.busy = false;
        if (!a.sprite.active) { r(); return; } // despawned while walking
        a.play('idle'); a.sync(); if (a === this.player) this.trail = []; r();
      },
    }));
  }

  /** Single player: every partner who has joined steps out for the scene (only the active one follows normally). */
  gather(on: boolean): void {
    if (G.mode !== 'single' || !this.player) return;
    if (on) {
      if (this.gathered.length) return;
      const ids = (G.state.partners.unlocked as CharId[]).filter((id) => id !== G.state.partners.active && id !== 'mametchi' && !G.cond(`away:${id}`));
      ids.forEach((id, i) => {
        // stand a little behind the hero (further back = not hidden by the dialogue box)
        const x = this.player.x - (this.partner ? 120 : 70) - Math.floor(i / 2) * 64 + (i % 2) * 30;
        const z = clamp(Math.min(this.player.z, 120) - 40 - (i % 2) * 34, 10, DEPTH - 10);
        this.spawnActor(id, id, x, z, false, 1, 'pop');
        this.gathered.push(id);
      });
    } else {
      for (const id of this.gathered) this.despawnActor(id, 'pop');
      this.gathered = [];
    }
  }

  private applySat(): void {
    if (!this.colorFx) return;
    this.colorFx.reset();
    if (this.sat < -0.001) this.colorFx.saturate(this.sat);
  }

  color(sat: number, ms: number, wave: boolean): Promise<void> {
    if (wave) this.colorWave(ms || 1600);
    if (!this.colorFx || ms <= 0) { this.sat = sat; this.applySat(); return Promise.resolve(); }
    return new Promise((r) => this.tweens.addCounter({
      from: this.sat, to: sat, duration: ms, ease: 'Sine.inOut',
      onUpdate: (tw) => { this.sat = tw.getValue() ?? sat; this.applySat(); },
      onComplete: () => { this.sat = sat; this.applySat(); r(); },
    }));
  }

  /** A bright band sweeps across the screen as the world gets its colours back. */
  private colorWave(ms: number): void {
    const key = 'colorband';
    if (!this.textures.exists(key)) {
      const [c, g] = canvas(260, 8);
      const gr = g.createLinearGradient(0, 0, 260, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,250,210,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 260, 8);
      this.textures.addCanvas(key, c);
    }
    const w = this.scale.width;
    const band = this.add.image(-200, GAME_H / 2, key).setScrollFactor(0).setDepth(8600).setDisplaySize(380, GAME_H).setBlendMode(Phaser.BlendModes.ADD);
    const stars = this.add.particles(0, 0, 'p_star', { x: { min: -10, max: 10 }, y: { min: 0, max: GAME_H }, speedX: { min: -60, max: 60 }, speedY: { min: -80, max: 40 }, lifespan: 1100, frequency: 25, scale: { start: 1.1, end: 0 }, tint: [0xfff6a0, 0xff8ac4, 0x8ad8ff, 0x8aff9a] }).setScrollFactor(0).setDepth(8601);
    audio.sfx('shard');
    this.time.delayedCall(300, () => audio.sfx('magic'));
    this.tweens.add({
      targets: band, x: w + 200, duration: ms, ease: 'Sine.inOut',
      onUpdate: () => { stars.setPosition(band.x, 0); },
      onComplete: () => { band.destroy(); stars.stop(); this.time.delayedCall(1200, () => stars.destroy()); },
    });
  }

  bounceActor(actor: string, n: number): Promise<void> {
    const a = this.actorOf(actor);
    if (!a) return Promise.resolve();
    const o = { y: 0 };
    return new Promise((r) => this.tweens.add({
      targets: o, y: 34, yoyo: true, repeat: Math.max(0, n - 1), duration: 150, ease: 'Quad.out',
      onUpdate: () => { a.y = o.y; a.sync(); }, onComplete: () => { a.y = 0; a.sync(); r(); },
    }));
  }

  shiverActor(actor: string, ms: number): Promise<void> {
    const a = this.actorOf(actor);
    if (!a) return Promise.resolve();
    const x0 = a.x;
    return new Promise((r) => this.tweens.add({
      targets: a, x: x0 + 5, yoyo: true, repeat: Math.max(1, Math.floor(ms / 80)), duration: 40,
      onUpdate: () => a.sync(), onComplete: () => { a.x = x0; a.sync(); r(); },
    }));
  }

  async interlude(id: string): Promise<void> {
    const def = INTERLUDES[id];
    if (!def) return;
    hud.setVisible(false);
    this.broadcastFx('stage', { kind: 'start', data: { id } });
    const st = await this.openStage(id, false);
    try {
      await runNested(def.script, st);
    } finally {
      st.finish();
      this.stage = null;
      this.broadcastFx('stage', { kind: 'end' });
    }
  }

  private openStage(id: string, mirror: boolean): Promise<StageScene> {
    return new Promise((resolve) => {
      const sc = this.scene.get('Stage') as StageScene;
      sc.events.once(Phaser.Scenes.Events.CREATE, () => resolve(sc));
      this.stage = sc;
      this.scene.launch('Stage', { id, mirror, chapter: this.chapter });
    });
  }

  private remoteStage(kind: string, data: any): void {
    if (kind === 'start') { void this.openStage(data.id, true); hud.setVisible(false); }
    else if (kind === 'end') { this.stage?.finish(); this.stage = null; }
    else if (kind === 'fx') this.stage?.applyRemoteFx(data.kind, data.data);
  }

  startChase(id: string): void {
    this.broadcastFx('chase', id);
    this.fp.startChase(id);
  }

  async minigame(id: string): Promise<void> {
    this.broadcastFx('minigame', id);
    hud.setVisible(false);
    await playMinigame(this, id);
    hud.setVisible(!cinema.active);
  }

  /** Single player: switch the active partner (R / tap the partner card). */
  cyclePartner(): void {
    if (G.mode !== 'single') return;
    const list = (G.state.partners.unlocked as CharId[]).filter((id) => !G.cond(`away:${id}`));
    if (list.length < 2) { toast(list.length ? '目前只有一位夥伴。' : '還沒有夥伴。', 'info', 1200); return; }
    const i = list.indexOf(G.state.partners.active as CharId);
    const next = list[(i + 1) % list.length];
    G.dispatch({ a: 'setPartner', partner: next });
    audio.sfx('join');
    toast(`換成 ${CHARACTERS[next].name}！能力：${ABILITIES[next].name}`, 'good', 1500);
  }

  areaRight(): number { return this.area.x1; }

  fullWidth(): number {
    return Math.max(this.chapter.width, ...(this.chapter.rooms ?? []).map((r) => r.x + r.w));
  }

  /** Main map or one of the side rooms: camera bounds and walking limits follow the player. */
  private updateArea(force = false): void {
    const x = this.player.x;
    const room = this.chapter.rooms?.find((r) => x >= r.x && x <= r.x + r.w);
    const a = room ? { x0: room.x, x1: room.x + room.w, room } : { x0: 0, x1: this.chapter.width };
    if (!force && a.x0 === this.area.x0 && a.x1 === this.area.x1) return;
    this.area = a;
    this.cameras.main.setBounds(a.x0, 0, a.x1 - a.x0, GAME_H);
    if (room && !force) toast(`進入：${room.name}`, 'info', 1400);
  }

  revealChestsNear(x: number, r: number): number {
    let n = 0;
    for (const c of this.chests) {
      if (c.revealed || !c.def.hidden || Math.abs(c.def.x - x) > r) continue;
      c.revealed = true;
      this.refreshChest(c);
      c.img.setScale(0.1);
      this.tweens.add({ targets: c.img, scale: depthScale(c.def.z) * 0.85, duration: 400, ease: 'Back.out' });
      this.paperBurst(c.def.x, zToY(c.def.z) - 50, 0xfff6a0, 12);
      n++;
    }
    if (n) audio.sfx('item');
    return n;
  }

  /** Kuchipatchi swallowed a small field enemy: it counts as beaten. */
  eatEnemy(id: string): void {
    const e = this.enemies.find((x) => x.id === id);
    if (!e) return;
    e.alive = false;
    const def = ENEMIES[e.enemy];
    const exp = Math.max(1, Math.round(def.exp * e.party.length * 0.6));
    if (G.mode === 'multi') G.dispatch({ a: 'flag', k: `defeated:${e.id}`, v: true });
    else { G.dispatch({ a: 'exp', n: exp }); G.dispatch({ a: 'coins', n: def.coins }); }
    toast(`大嘴吉一口吞掉了 ${def.name}！（EXP +${exp}）`, 'good', 1600);
  }

  /** Player asked to use an ability spot (confirm near it, or the ability button). */
  async tryAbilitySpot(id: string): Promise<void> {
    const o = this.objects.find((x) => x.def.id === id);
    if (!o || o.open || !o.def.need) return;
    const need = o.def.need;
    if (G.mode === 'single') {
      if (!G.state.partners.unlocked.includes(need) || G.cond(`away:${need}`)) {
        audio.sfx('error');
        toast(G.cond(`away:${need}`) ? `${CHARACTERS[need].name}被帶走了……先去救出大家吧！` : `這裡需要${FieldPlay.needText(need)}。先繼續冒險吧！`, 'warn', 2000);
        return;
      }
      if (G.state.partners.active !== need) {
        G.dispatch({ a: 'setPartner', partner: need });
        await new Promise((r) => this.time.delayedCall(250, r));
      }
      await this.interact('ability', id, G.localMemberKey(), { who: need });
    } else if (!G.isAuthority) worldNet.requestInteract('ability', id, { who: G.localChar });
    else await this.interact('ability', id, G.localMemberKey(), { who: G.localChar });
  }

  private async abilitySpot(id: string, _who?: string): Promise<void> {
    const o = this.objects.find((x) => x.def.id === id);
    if (!o || o.open || !o.def.need) return;
    const d = o.def;
    const need = d.need!;
    const say: Record<CharId, string> = {
      kuchipatchi: '交給我吧！大口吸——啊嗯！', memetchi: '來～剛烤好的蛋糕，香香的喔！', mimitchi: '噓……我聽到了！就在這裡！',
      violetchi: '灰灰的輪廓……讓我把顏色畫回去！', oyajitchi: '星之燈啊，照亮孩子們的路吧。', gozarutchi: '泡泡忍術・浮之卷！',
      maskutchi: '正義的變裝，啟動！', mametchi: '感應器，掃描！',
    };
    const doer = G.mode === 'single' ? 'partner' : 'hero';
    await this.runStory([
      { do: 'cinema', on: true },
      { do: 'pan', x: d.x - 80, ms: 500 },
      { who: need, text: say[need], face: 'determined' },
      { do: 'walk', actor: doer, x: d.x - 110, z: d.look === 'bear' || d.look === 'spot' ? d.z : undefined },
      { do: 'fx', name: `ab_${need}`, x: d.x },
      { do: 'flag', key: d.flag ?? `ab:${d.id}`, value: true },
      { do: 'wait', ms: 500 },
      ...(d.script ?? []),
      { do: 'follow', ms: 500 },
    ]);
  }

  /** Small local ability effects (from the ability button). */
  abilityFx(name: string): void {
    const p = this.partner ?? this.player;
    const x = p.x, y = zToY(p.z) - 70;
    const tint: Record<string, number> = { suck: 0xffd08a, listen: 0x9fd8ff, paint: 0xb88cff, light: 0xfff6a0 };
    const tex = name === 'listen' ? 'p_star' : name === 'light' ? 'p_star' : 'p_paper';
    const pe = this.add.particles(x, y, tex, {
      speed: name === 'suck' ? { min: -260, max: -120 } : { min: 80, max: 260 }, lifespan: 700, scale: { start: 1, end: 0 },
      tint: tint[name] ?? 0xffffff, emitting: false,
    }).setDepth(9000);
    pe.explode(name === 'light' ? 30 : 18);
    if (name === 'listen') for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(x, y, 20, 0, 0).setStrokeStyle(4, 0x9fd8ff).setDepth(9000);
      this.tweens.add({ targets: ring, radius: 360, alpha: 0, delay: i * 220, duration: 900, onComplete: () => ring.destroy() });
    }
    if (name === 'light') { const glow = this.add.image(x, y, 'p_warm').setScale(1).setBlendMode(Phaser.BlendModes.ADD).setDepth(8990); this.tweens.add({ targets: glow, scale: 9, alpha: 0, duration: 1200, onComplete: () => glow.destroy() }); }
    this.time.delayedCall(900, () => pe.destroy());
  }

  /** Off-screen events (a gate opening) are shown with a short camera pan. */
  private showOffQueue: number[] = [];
  private showingOff = false;

  private async processShowOff(): Promise<void> {
    if (this.showingOff || !this.showOffQueue.length || storyRunning() || battleActive() || this.busy || dialogue.open) return;
    this.showingOff = true;
    const x = this.showOffQueue.shift()!;
    this.cinema(true);
    await this.pan(x, 900);
    await new Promise((r) => this.time.delayedCall(1400, r));
    await this.follow(700);
    this.cinema(false);
    this.showingOff = false;
  }

  /** Picture-based controls tutorial, shown once when a new game actually becomes playable. */
  private async maybeTutorial(): Promise<void> {
    const seenLocal = (() => { try { return localStorage.getItem('tpa.tutorialSeen') === '1'; } catch { return false; } })();
    const seen = G.mode === 'single' ? G.cond('tutorial_shown') : seenLocal;
    if (seen) return;
    while (storyRunning() || battleActive() || dialogue.open) await new Promise((r) => setTimeout(r, 300));
    this.busy = true;
    await openTutorial();
    this.busy = false;
    if (G.mode === 'single') G.dispatch({ a: 'flag', k: 'tutorial_shown', v: true });
    try { localStorage.setItem('tpa.tutorialSeen', '1'); } catch { /* ignore */ }
  }

  setActorVisible(actor: string, v: boolean): void {
    const a = this.actorOf(actor);
    if (a) { a.visible = v; a.sync(); }
  }

  tint(color: number): void {
    this.cameras.main.setBackgroundColor(color);
  }

  broadcastDialogue(kind: 'line' | 'adv' | 'choice' | 'pick' | 'end' | 'skip', data?: any): void {
    if (worldNet.active) worldNet.broadcastDialogue(kind, data);
  }

  broadcastFx(kind: string, data: any): void {
    if (worldNet.active && G.net?.isHost) worldNet.broadcastField(kind, data);
  }

  /** Client side: visual effects mirrored from the host. */
  applyRemoteFx(kind: string, data: any): void {
    switch (kind) {
      case 'shake': this.shake(data); break;
      case 'flash': this.flash(data); break;
      case 'sfx': audio.sfx(data); break;
      case 'music': audio.playMusic(data); break;
      case 'emote': this.emote(data.actor, data.emote); break;
      case 'chapterClear': void showChapterClear(chapterByNum(data)); break;
      case 'ending': void playEnding().then(() => bus.emit('app:title')); break;
      case 'cinema': this.cinema(!!data); break;
      case 'pan': void this.pan(data.x, data.ms); break;
      case 'follow': void this.follow(data); break;
      case 'zoom': void this.zoom(data.z, data.ms); break;
      case 'jump': void this.jumpActor(data); break;
      case 'anim': void this.animActor(data.actor, data.anim, data.ms); break;
      case 'caption': void cinema.caption(data.text, data.ms); break;
      case 'banner': cinema.flashBanner(data.title, data.sub ?? ''); break;
      case 'fx': void this.fx(data.name, data.actor, data.x); break;
      case 'item': toast(`${G.local?.playerName ?? ''} 取得 ${ITEMS[data]?.name ?? data}`, 'good'); break;
      case 'walk': void this.walkActor(data.actor, data.x, data.z, !!data.run); break;
      case 'place': this.placeActor(data.actor, data.x, data.z); break;
      case 'face': this.faceActor(data.actor, data.dir); break;
      case 'spawn': this.spawnActor(data.actor, data.look, data.x, data.z ?? 130, data.dark, data.dir, data.fx); break;
      case 'despawn': this.despawnActor(data.actor, data.fx); break;
      case 'visible': this.setActorVisible(data.actor, !!data.v); break;
      case 'bounce': void this.bounceActor(data.actor, data.n ?? 2); break;
      case 'shiver': void this.shiverActor(data.actor, data.ms ?? 700); break;
      case 'card': void cinema.nameCard(data.title, data.sub, data.img, data.color); break;
      case 'book': void playBook(data, this.chapter); break;
      case 'color': void this.color(data.sat, data.ms, !!data.wave); break;
      case 'chase': this.fp.startChase(data); break;
      case 'minigame': hud.setVisible(false); void playMinigame(this, data).then(() => hud.setVisible(!cinema.active)); break;
      case 'stage': this.remoteStage(data.kind, data.data); break;
    }
  }

  paperBurst(x: number, y: number, tint = 0xffffff, n = 14): void {
    const p = this.add.particles(x, y, 'p_paper', { speed: { min: 80, max: 240 }, lifespan: 600, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.2 }, gravityY: 500, tint, emitting: false }).setDepth(9000);
    p.explode(n);
    this.time.delayedCall(800, () => p.destroy());
  }

  get playerX(): number { return this.player?.x ?? 0; }
  get zToYFactor(): number { return Z_TO_Y; }
}
