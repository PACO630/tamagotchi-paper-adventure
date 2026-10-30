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
import type { ChapterDef, ChestDef, NpcDef, ObjDef, Script, ZoneDef } from '../data/types';
import { input } from '../input/input';
import { runBattle } from '../battle/battleRunner';
import { battleActive } from '../battle/battleRunner';
import { audio } from '../systems/audio';
import { saves } from '../systems/saveManager';
import { settings } from '../systems/settings';
import { runScript, storyRunning, type StoryHost } from '../systems/story';
import { dialogue } from '../ui/dialogueBox';
import { confirmDialog, toast } from '../ui/dom';
import { hud } from '../ui/hud';
import { showChapterCard, showChapterClear, showGameOver } from '../ui/screens/chapterCards';
import { playEnding } from '../ui/screens/ending';
import { openPauseMenu } from '../ui/screens/pauseMenu';
import { Actor, depthScale, zToY } from './actor';
import { worldNet } from './worldNet';

interface FieldEnemy { id: string; party: string[]; enemy: string; x0: number; z0: number; range: number; x: number; z: number; spr: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; phase: number; chase: boolean; alive: boolean; hop: number; showIf?: string }
interface ObjView { def: ObjDef; img: Phaser.GameObjects.Image[]; label?: Phaser.GameObjects.Text; broken: boolean; open: boolean }
interface ChestView { def: ChestDef; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; revealed: boolean }
interface NpcView { def: NpcDef; actor: Actor; baseX: number; t: number }
interface PlatView { id: string; x0: number; z0: number; w: number; d: number; dx: number; dz: number; period: number; img: Phaser.GameObjects.Image; x: number; z: number; vx: number; vz: number }
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
    this.busy = false;
    this.time0 = this.time.now;

    this.cameras.main.setBounds(0, 0, cd.width, GAME_H);
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
    const start = G.state.position.x >= 0 ? G.state.position : cd.start;
    this.player = new Actor(this, { charId: G.localChar }, start.x, clamp(start.z, 10, DEPTH - 10));
    if (worldNet.active) this.player.setLabel(G.local?.playerName ?? '', '#ffe680');
    if (cd.theme.underwater || cd.zones.some((z) => z.look === 'water' || z.look === 'choco')) this.player.enableReflection();
    this.lastSafe = { x: this.player.x, z: this.player.z };
    this.refreshPartner();

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
    this.interactText = this.add.text(0, 0, '!', { fontFamily: FONT, fontSize: '26px', color: '#e8203a' }).setOrigin(0.5).setDepth(9501).setVisible(false);

    audio.playMusic(cd.music);
    hud.mount(cd);
    hud.update();

    this.offs.push(bus.on('state:changed', (a: any) => this.onStateChanged(a)));
    this.offs.push(bus.on('partner:changed', () => this.refreshPartner()));
    this.offs.push(bus.on('partner:joined', () => { this.refreshPartner(); audio.sfx('join'); }));
    this.offs.push(saves.onBeforeSave((s) => {
      if (G.mode === 'single' && s === G.state && this.player) s.position = { x: Math.round(this.player.x), z: Math.round(this.player.z) };
    }));
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('destroy', () => this.cleanup());

    G.playing = true;
    if (G.mode === 'single') saves.startAutosaveTimer();
    // chapter title card, then intro (authority)
    void (async () => {
      this.busy = true;
      await showChapterCard(cd);
      this.busy = false;
      if (G.isAuthority && !G.cond(`intro:${cd.id}`)) {
        G.dispatch({ a: 'flag', k: `intro:${cd.id}`, v: true });
        await this.runStory(cd.intro);
      }
      // recovery: the shard was already taken (e.g. the page closed during the outro) → finish the chapter
      if (G.isAuthority && cd.num < 8 && G.cond(`shard${cd.num}_got`)) await this.chapterEnd();
      else if (G.isAuthority && cd.num === 8 && G.cond('boss8') && !G.cond('game_clear')) await this.runStory(cd.outro);
    })();
  }

  private cleanup(): void {
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
    this.add.tileSprite(0, GROUND_TOP - 4, cd.width, GROUND_BOTTOM - GROUND_TOP + 40, `ground:${t.id}`).setOrigin(0).setDepth(-50);
    this.add.tileSprite(0, GROUND_TOP - 28, cd.width, 40, `gedge:${t.id}`).setOrigin(0).setDepth(-49);
    this.add.tileSprite(0, GROUND_BOTTOM + 30, cd.width, 50, `fedge:${t.id}`).setOrigin(0).setDepth(7000);
    // soft ambient light pools along the floor
    for (let x = 300; x < cd.width; x += 900) {
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
      this.plats.push({ id: p.id, x0: p.x, z0: p.z, w: p.w, d: p.d, dx: p.dx ?? 0, dz: p.dz ?? 0, period: p.period ?? 3, img, x: p.x, z: p.z, vx: 0, vz: 0 });
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
          for (const img of v.img) this.tweens.add({ targets: img, y: img.y - 260, alpha: 0, duration: 700, ease: 'Back.in' });
        } else if (open) v.img.forEach((i) => i.setVisible(false));
        v.open = open;
        break;
      }
      case 'switch': {
        const on = !!d.flag && G.cond(d.flag);
        v.img[0]?.setTexture(ensureObject(this, on ? 'switch_on' : 'switch_off'));
        break;
      }
      default:
        v.img.forEach((i) => i.setVisible(show));
        v.label?.setVisible(show);
    }
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
    const visible = cv.revealed && (!cv.def.showIf || G.cond(cv.def.showIf) || G.cond(`chest:${cv.def.id}`));
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
      const fe: FieldEnemy = { id: e.id, party: e.party, enemy: e.enemy, x0: e.x, z0: e.z, range: e.range ?? 120, x: e.x, z: e.z, spr, shadow, phase: hashString(e.id) % 100, chase: false, alive: true, hop: 0, showIf: e.showIf };
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

    const canControl = !input.blocked && !this.busy && !storyRunning() && !battleActive() && !dialogue.open;
    this.updatePlayer(dt, canControl);
    this.updatePartner();
    this.updateDarkness(dt);
    this.updateInteractPrompt(canControl);

    if (canControl) {
      if (input.justPressed('menu') || input.justPressed('cancel')) { audio.sfx('menu'); void openPauseMenu(this); }
      else if (input.justPressed('confirm')) this.tryInteract();
      else if (input.justPressed('item')) hud.quickUse();
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

  private platformAt(x: number, z: number): PlatView | null {
    for (const p of this.plats) if (Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2 + 6) return p;
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
    }
  }

  private updateHazards(t: number): void {
    for (const h of this.hazards) {
      const per = h.zone.period ?? 2, duty = h.zone.duty ?? 0.4;
      const ph = (t % per) / per;
      const active = ph < duty;
      if (active && !h.active) { audio.sfx('hammer', 0.6); if (settings.current.screenShake) this.cameras.main.shake(80, 0.004); }
      h.active = active;
      const target = active ? GROUND_TOP + 80 : GROUND_TOP - 300;
      h.piston.y += (target - h.piston.y) * (active ? 0.5 : 0.08);
    }
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
      if (!this.inZone(z, p.x, p.z)) continue;
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
    nx = clamp(nx, 30, this.chapter.width - 30);
    p.x = nx;
    p.z = nz;

    // platforms & pits
    this.onPlatform = grounded ? this.platformAt(p.x, p.z) : null;
    if (grounded && !this.onPlatform) {
      const pit = this.chapter.zones.find((z) => z.type === 'pit' && this.inZone(z, p.x, p.z));
      if (pit) { this.fallIntoPit(); return; }
      this.safeTimer -= dt;
      if (this.safeTimer <= 0) {
        this.safeTimer = 0.25;
        const nearPit = this.chapter.zones.some((z) => z.type === 'pit' && p.x > z.x - 60 && p.x < z.x + z.w + 60);
        if (!nearPit) this.lastSafe = { x: p.x, z: p.z };
      }
      // hazards
      for (const h of this.hazards) if (h.active && this.inZone(h.zone, p.x, p.z) && this.invuln <= 0) this.hurtPlayer(h.zone.dmg ?? 1, -p.facingX);
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
      if (d.type === 'gate' && !o.open) solid = true;
      if (d.type === 'breakable' && !o.broken) { solid = true; if (!d.w) { r = 40; if (Math.abs(z - d.z) > 34) solid = false; } }
      if (!solid) continue;
      if (ox <= d.x - r && nx > d.x - r) nx = d.x - r;
      else if (ox >= d.x + r && nx < d.x + r) nx = d.x + r;
      else if (Math.abs(nx - d.x) < r) nx = ox < d.x ? d.x - r : d.x + r;
    }
    return nx;
  }

  private fallIntoPit(): void {
    const p = this.player;
    p.locked = true;
    audio.sfx('hurt');
    this.tweens.add({
      targets: p.sprite, y: p.sprite.y + 80, alpha: 0, scaleX: p.sprite.scaleX * 0.5, duration: 350, ease: 'Quad.in',
      onComplete: () => {
        p.x = this.lastSafe.x; p.z = this.lastSafe.z; p.y = 0; p.vy = 0;
        p.sprite.setAlpha(1);
        p.locked = false;
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
    for (const e of this.enemies) {
      const visible = e.alive && (!e.showIf || G.cond(e.showIf)) && !(G.mode === 'multi' && G.cond(`defeated:${e.id}`));
      e.spr.setVisible(visible);
      e.shadow.setVisible(visible);
      if (!visible) continue;
      const px = this.player.x, pz = this.player.z;
      const dist = Math.hypot(px - e.x, (pz - e.z) * 1.5);
      const blocked = this.busy || storyRunning() || battleActive() || input.blocked;
      e.chase = !blocked && dist < 230 && Math.abs(px - e.x0) < e.range + 260;
      if (e.chase) {
        const sp = 95;
        e.x += Math.sign(px - e.x) * sp * dt;
        e.z += Math.sign(pz - e.z) * sp * 0.6 * dt;
      } else {
        const tx = e.x0 + Math.sin(t * 0.7 + e.phase) * e.range;
        e.x += (tx - e.x) * Math.min(1, dt * 2);
        e.z += (e.z0 - e.z) * Math.min(1, dt * 1.5);
      }
      e.hop = Math.abs(Math.sin(t * 6 + e.phase)) * (e.chase ? 10 : 4);
      const flying = ENEMIES[e.enemy].traits.includes('flying');
      const y = zToY(e.z);
      e.spr.setPosition(e.x, y - e.hop - (flying ? 50 : 0)).setDepth(y).setScale(0.8 * depthScale(e.z));
      e.spr.setFlipX(px < e.x);
      e.shadow.setPosition(e.x, y).setDepth(y - 1).setScale(0.55 * depthScale(e.z), 0.8);
      // contact
      if (!blocked && dist < 52 && this.player.y < 40 && this.invuln <= 0) {
        this.startFieldBattle(e, this.player.vy < 0 && this.player.y > 5 ? 'jump' : null);
      }
    }
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
    const consider = (kind: string, id: string, x: number, z: number, yOff: number, range = 90) => {
      const d = Math.hypot(x - p.x, (z - p.z) * 1.4);
      if (d < range && (!best || d < best.d)) best = { kind, id, x, y: zToY(z) - yOff, d };
    };
    for (const n of this.npcs) if (n.actor.visible) consider('npc', n.def.id, n.actor.x, n.actor.z, 130);
    for (const c of this.chests) if (c.img.visible && !G.cond(`chest:${c.def.id}`)) consider('chest', c.def.id, c.def.x, c.def.z, 90);
    for (const o of this.objects) {
      const d = o.def;
      if (d.showIf && !G.cond(d.showIf)) continue;
      if (d.type === 'sign' || d.type === 'savepoint' || d.type === 'door' || d.type === 'shard' || d.type === 'switch') consider(d.type, d.id, d.x, d.z, d.type === 'savepoint' ? 170 : 110);
    }
    return best;
  }

  private updateInteractPrompt(can: boolean): void {
    const n = can ? this.nearest() : null;
    this.interactBubble.setVisible(!!n);
    this.interactText.setVisible(!!n);
    if (n) {
      const bob = Math.sin(this.time.now / 160) * 4;
      this.interactBubble.setPosition(n.x, n.y - 10 + bob);
      this.interactText.setPosition(n.x, n.y - 14 + bob).setText(n.kind === 'npc' ? '…' : n.kind === 'chest' ? '?' : '!');
    }
  }

  private tryInteract(): void {
    const n = this.nearest();
    if (!n) return;
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
        else toast('……好像回到了起點。', 'warn', 1500);
        this.cameras.main.fadeIn(250);
        this.busy = false;
        break;
      }
      case 'switch': this.activateSwitch(id); break;
      case 'shard': {
        const o = this.objects.find((x) => x.def.id === id);
        if (!o || (o.def.showIf && !G.cond(o.def.showIf))) return;
        audio.sfx('shard');
        await this.runStory(this.chapter.outro);
        break;
      }
      case 'heal': this.healParty(); break;
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
      if (d.type === 'switch' && Math.abs(d.z - z) < 50) { this.activateSwitch(d.id); return; }
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
    const ok = await this.runStory(b.pre);
    if (!ok || !G.cond(b.flag)) return;
    bus.emit('boss:defeated', b.id);
    bus.emit('autosave', 'boss');
    await this.runStory(b.post);
    if (!this.chapter.objects.some((o) => o.type === 'shard')) await this.runStory(this.chapter.outro);
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
    const a = actor === 'player' || actor === 'hero' ? this.player : this.npcs.find((n) => n.def.id === actor)?.actor;
    if (!a) return;
    const y = a.sprite.y - 120 * a.scaleNow();
    const b = this.add.image(a.x + 30, y, 'emote_bubble').setDepth(9600).setScale(0.1);
    const t = this.add.text(a.x + 30, y - 4, emote, { fontFamily: FONT, fontSize: '28px', color: '#e8203a' }).setOrigin(0.5).setDepth(9601).setScale(0.1);
    this.tweens.add({ targets: [b, t], scale: 0.9, duration: 200, ease: 'Back.out' });
    this.time.delayedCall(1300, () => { b.destroy(); t.destroy(); });
  }

  moveActor(actor: string, x: number, z?: number): Promise<void> {
    const a = actor === 'player' || actor === 'hero' ? this.player : this.npcs.find((n) => n.def.id === actor)?.actor;
    if (!a) return Promise.resolve();
    a.face(Math.sign(x - a.x), 0);
    a.play('walk');
    return new Promise((r) => this.tweens.add({ targets: a, x, z: z ?? a.z, duration: Math.abs(x - a.x) * 4 + 200, onUpdate: () => a.sync(), onComplete: () => { a.play('idle'); r(); } }));
  }

  setActorVisible(actor: string, v: boolean): void {
    const a = this.npcs.find((n) => n.def.id === actor)?.actor;
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
      case 'item': toast(`${G.local?.playerName ?? ''} 取得 ${ITEMS[data]?.name ?? data}`, 'good'); break;
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
