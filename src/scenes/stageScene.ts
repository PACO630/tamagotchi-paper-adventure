/**
 * Interlude stage: a small set that plays between chapters on top of the world —
 *  - "lair":    meanwhile, in the crowned shadow's star palace (the cracked Star Heart shows how
 *               many shards the party has recovered)
 *  - "airship": the party on the deck of the flying ship, chatting on the way to the next place
 * It is a StoryHost, so interludes are written with the same script steps as the chapters.
 */
import Phaser from 'phaser';
import { DEPTH, FONT, GAME_H, GROUND_BOTTOM, GROUND_TOP } from '../core/config';
import { G } from '../core/game';
import { clamp } from '../core/util';
import type { DrawTarget } from '../art/characterArt';
import { canvas } from '../art/paperArt';
import { CHARACTERS } from '../data/characters';
import { SPEAKERS } from '../data/chapters/helpers';
import { INTERLUDES } from '../data/interludes';
import type { ChapterDef, CharId, NpcLook } from '../data/types';
import { audio } from '../systems/audio';
import { settings } from '../systems/settings';
import type { StoryHost } from '../systems/story';
import { cinema } from '../ui/cinema';
import { dialogue } from '../ui/dialogueBox';
import { Actor, zToY } from '../world/actor';
import { worldNet } from '../world/worldNet';
import { playMinigame } from '../minigames';

const STAGE_W = 2400;
/** The stage is shallow: scripts use the usual 0–240 depth, squeezed into the back half so the dialogue box never covers anyone. */
const sz = (z: number) => clamp(z * 0.45, 6, DEPTH - 6);

export class StageScene extends Phaser.Scene implements StoryHost {
  chapter!: ChapterDef;
  private set: 'lair' | 'airship' = 'lair';
  private mirror = false;
  private actors = new Map<string, Actor>();
  private clouds: { o: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private ship: Phaser.GameObjects.Container | null = null;
  private deck: Phaser.GameObjects.GameObject[] = [];
  private done = false;

  constructor() {
    super('Stage');
  }

  init(data: { id: string; mirror: boolean; chapter: ChapterDef }): void {
    this.set = INTERLUDES[data.id]?.set ?? 'lair';
    this.mirror = data.mirror;
    this.chapter = data.chapter;
    this.actors = new Map();
    this.clouds = [];
    this.deck = [];
    this.ship = null;
    this.done = false;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, STAGE_W, GAME_H);
    cam.centerOn(STAGE_W / 2, GAME_H / 2);
    if (this.set === 'lair') this.buildLair(); else this.buildAirship();
    cam.fadeIn(500);
    audio.playMusic(this.set === 'lair' ? 'dark' : 'sky');
    cinema.on();
  }

  /** Fade out and remove the stage. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    if (this.mirror) cinema.off();
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
    this.cameras.main.fadeOut(400);
    this.time.delayedCall(420, () => this.scene.stop());
  }

  update(_t: number, dms: number): void {
    const dt = dms / 1000;
    for (const c of this.clouds) c.o.tilePositionX += c.v * dt;
    for (const a of this.actors.values()) a.sync();
  }

  /* ======================= sets ======================= */

  private tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): string {
    if (this.textures.exists(key)) return key;
    const [c, g] = canvas(w, h);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g);
    this.textures.addCanvas(key, c);
    return key;
  }

  private buildLair(): void {
    const sky = this.tex('stage:lairsky', 64, 720, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 720);
      gr.addColorStop(0, '#0a0620'); gr.addColorStop(0.6, '#2a1450'); gr.addColorStop(1, '#4a2a6a');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 720);
    });
    this.add.image(0, 0, sky).setOrigin(0).setScrollFactor(0).setDisplaySize(this.scale.width, GAME_H).setDepth(-100);
    // the cracked Star Heart hanging in the dark, one glowing slot per recovered shard
    const shards = G.state?.inventory.filter((e) => e.id.startsWith('shard')).length ?? 0;
    const heart = this.tex(`stage:heart:${shards}`, 520, 480, (g) => {
      g.translate(260, 250);
      g.beginPath();
      g.moveTo(0, 170); g.bezierCurveTo(-300, -20, -200, -280, 0, -130); g.bezierCurveTo(200, -280, 300, -20, 0, 170);
      g.fillStyle = 'rgba(40,20,70,0.85)'; g.fill();
      g.setLineDash([16, 12]); g.lineWidth = 6; g.strokeStyle = '#8a6ad8'; g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
        const x = Math.cos(a) * 120, y = Math.sin(a) * 100 + 10;
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(0, -26); g.lineTo(18, 0); g.lineTo(3, 28); g.lineTo(-18, 6); g.closePath();
        const lit = i >= 8 - shards;
        g.fillStyle = lit ? '#2a1a3a' : '#ffb0d8';
        g.fill(); g.lineWidth = 3; g.strokeStyle = lit ? '#5a3a8a' : '#ffffff'; g.stroke(); g.restore();
      }
      g.font = 'bold 26px sans-serif'; g.fillStyle = '#c8a8ff'; g.textAlign = 'center';
    });
    const h = this.add.image(this.scale.width / 2, 200, heart).setScrollFactor(0).setDepth(-80).setAlpha(0.95);
    this.tweens.add({ targets: h, y: 225, yoyo: true, repeat: -1, duration: 2600, ease: 'Sine.inOut' });
    // pillars and floor
    const pillar = this.tex('stage:pillar', 90, 420, (g) => {
      const gr = g.createLinearGradient(0, 0, 90, 0); gr.addColorStop(0, '#3a2a5a'); gr.addColorStop(0.5, '#6a5a9a'); gr.addColorStop(1, '#2a1a4a');
      g.fillStyle = gr; g.fillRect(14, 30, 62, 380); g.fillStyle = '#8a7ac0'; g.fillRect(4, 10, 82, 26); g.fillRect(4, 396, 82, 24);
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(45, 22, 6, 0, Math.PI * 2); g.fill();
    });
    for (let x = 200; x < STAGE_W; x += 420) this.add.image(x, GROUND_TOP + 10, pillar).setOrigin(0.5, 1).setDepth(-60).setScrollFactor(0.85, 1);
    const floor = this.tex('stage:lairfloor', 256, 300, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#3a2a5a'); gr.addColorStop(1, '#1a0e2a');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 300);
      g.strokeStyle = 'rgba(200,170,255,0.18)'; g.lineWidth = 2;
      for (let y = 20; y < 300; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
      for (let x = 0; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 30, 300); g.stroke(); }
    });
    this.add.tileSprite(0, GROUND_TOP - 6, STAGE_W, GROUND_BOTTOM - GROUND_TOP + 60, floor).setOrigin(0).setDepth(-50);
    // the throne
    const throne = this.tex('stage:throne', 260, 300, (g) => {
      g.fillStyle = '#b89ae8'; g.strokeStyle = '#2a1a4a'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(30, 300); g.lineTo(40, 60); g.quadraticCurveTo(130, -20, 220, 60); g.lineTo(230, 300); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e8d8ff'; g.fillRect(60, 170, 140, 60); g.strokeRect(60, 170, 140, 60);
      g.fillStyle = '#ffd23a'; for (const x of [40, 130, 220]) { g.beginPath(); g.moveTo(x - 14, 60); g.lineTo(x, 26); g.lineTo(x + 14, 60); g.fill(); }
    });
    this.add.image(STAGE_W / 2, zToY(30) + 6, throne).setOrigin(0.5, 1).setDepth(zToY(30) - 2);
    this.add.particles(0, 0, 'p_mote', { x: { min: 0, max: STAGE_W }, y: { min: 0, max: GAME_H }, speedY: { min: -30, max: -8 }, lifespan: 6000, frequency: 90, alpha: { start: 0.8, end: 0 }, scale: { start: 1.3, end: 0.3 } }).setDepth(7000);
    const label = this.add.text(30, 26, '與此同時……', { fontFamily: FONT, fontSize: '34px', color: '#e8d8ff', stroke: '#1a0a2a', strokeThickness: 8 }).setScrollFactor(0).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: label, alpha: 1, duration: 600, hold: 2600, yoyo: true });
  }

  private buildAirship(): void {
    const n = this.chapter?.num ?? 1;
    const tones: [string, string][] = [['#ff9a6a', '#ffe0b0'], ['#5ab0ff', '#e8f6ff'], ['#ffb07a', '#fff0d0'], ['#4a7ad8', '#c8e8ff'], ['#7a5ad8', '#ffc8e0'], ['#1a1a4a', '#5a4a9a'], ['#2a2060', '#8a7ae0']];
    const [top, bottom] = tones[(n - 1) % tones.length];
    const sky = this.tex(`stage:shipsky:${n}`, 64, 720, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 720);
    });
    this.add.image(0, 0, sky).setOrigin(0).setScrollFactor(0).setDisplaySize(this.scale.width, GAME_H).setDepth(-100);
    const cloud = this.tex('stage:clouds', 512, 200, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [x, y, r] of [[60, 120, 50], [120, 100, 60], [190, 125, 48], [330, 90, 40], [380, 80, 52], [440, 100, 38]]) { g.beginPath(); g.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2); g.fill(); }
    });
    for (const [y, sc, v, a] of [[90, 0.8, 60, 0.6], [260, 1.2, 160, 0.85], [560, 1.6, 420, 1]] as [number, number, number, number][]) {
      const t = this.add.tileSprite(0, y, this.scale.width, 200, cloud).setOrigin(0).setScrollFactor(0).setTileScale(sc, sc).setAlpha(a).setDepth(y > 500 ? 7600 : -90);
      this.clouds.push({ o: t, v });
    }
    // balloon above the deck
    const balloon = this.tex('stage:balloon', 900, 300, (g) => {
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 7;
      const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#ffb07a'); gr.addColorStop(1, '#e05a3a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(450, 110, 440, 160, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffe6a0'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(120 + i * 135, 140, 26, 130, 0, 0, Math.PI * 2); g.fill(); }
      g.font = 'bold 54px sans-serif'; g.fillStyle = '#fffdf6'; g.textAlign = 'center'; g.fillText('★ MAMETCHI ★', 450, 150);
    });
    const bl = this.add.image(STAGE_W / 2, 30, balloon).setOrigin(0.5, 0.5).setScrollFactor(0.6, 1).setDepth(-70);
    this.deck.push(bl);
    this.tweens.add({ targets: bl, y: 40, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.inOut' });
    const rope = this.add.graphics().setDepth(-65);
    rope.lineStyle(5, 0x6a4a2a, 1);
    for (const x of [700, 1000, 1400, 1700]) rope.lineBetween(x, 180, x + (x < 1200 ? -40 : 40), GROUND_TOP - 10);
    this.deck.push(rope);
    const plank = this.tex('stage:deck', 256, 300, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#d89a5a'); gr.addColorStop(1, '#9a5a2a');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 300);
      g.strokeStyle = 'rgba(90,50,20,0.5)'; g.lineWidth = 3;
      for (let y = 30; y < 300; y += 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
      for (let i = 0; i < 12; i++) { g.fillStyle = '#5a3a1a'; g.fillRect((i * 71) % 256, (i * 37) % 300, 5, 5); }
    });
    this.deck.push(this.add.tileSprite(400, GROUND_TOP - 6, 1600, GROUND_BOTTOM - GROUND_TOP + 30, plank).setOrigin(0).setDepth(-50));
    const rail = this.tex('stage:rail', 200, 90, (g) => {
      g.fillStyle = '#8a5a2a'; g.strokeStyle = '#2a1a0a'; g.lineWidth = 4;
      g.fillRect(0, 10, 200, 14); g.strokeRect(0, 10, 200, 14);
      for (let x = 10; x < 200; x += 40) { g.fillRect(x, 10, 12, 80); g.strokeRect(x, 10, 12, 80); }
    });
    this.deck.push(this.add.tileSprite(400, GROUND_TOP - 80, 1600, 90, rail).setOrigin(0).setDepth(-45));
    this.deck.push(this.add.tileSprite(400, GROUND_BOTTOM - 20, 1600, 90, rail).setOrigin(0).setDepth(7400));
    const hull = this.add.graphics().setDepth(7300);
    hull.fillStyle(0x8a4a2a, 1).fillRect(400, GROUND_BOTTOM + 40, 1600, 60).lineStyle(6, 0x2a1a0a, 1).strokeRect(400, GROUND_BOTTOM + 40, 1600, 60);
    this.deck.push(hull);
    // propeller at the back of the ship
    const prop = this.tex('stage:prop', 120, 120, (g) => {
      g.fillStyle = '#c8c8d0'; g.strokeStyle = '#2a1a0a'; g.lineWidth = 4;
      for (let i = 0; i < 3; i++) { g.save(); g.translate(60, 60); g.rotate((i * Math.PI * 2) / 3); g.beginPath(); g.ellipse(0, -30, 12, 30, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      g.fillStyle = '#e8203a'; g.beginPath(); g.arc(60, 60, 12, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    const pr = this.add.image(380, GROUND_TOP + 60, prop).setDepth(7350);
    this.tweens.add({ targets: pr, angle: 360, repeat: -1, duration: 260 });
    this.deck.push(pr);
  }

  /** The airship seen from outside, flying across the sky to the next place. */
  private shipTexture(): string {
    return this.tex('stage:ship', 420, 300, (g) => {
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 6;
      const gr = g.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, '#ffb07a'); gr.addColorStop(1, '#e05a3a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(210, 90, 190, 80, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffe6a0'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(90 + i * 80, 100, 14, 64, 0, 0, Math.PI * 2); g.fill(); }
      g.lineWidth = 4; for (const x of [130, 290]) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x + (x < 200 ? 20 : -20), 220); g.stroke(); }
      g.lineWidth = 6; g.fillStyle = '#9a5a2a'; g.beginPath(); g.moveTo(80, 215); g.lineTo(340, 215); g.lineTo(310, 270); g.lineTo(110, 270); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff6c0'; for (const x of [150, 210, 270]) { g.beginPath(); g.arc(x, 240, 10, 0, Math.PI * 2); g.fill(); g.stroke(); }
    });
  }

  /* ======================= StoryHost ======================= */

  private lookTarget(look: string | NpcLook, dark?: boolean): DrawTarget {
    if (typeof look !== 'string') return { npc: look, dark };
    if (look in CHARACTERS) return { charId: look as CharId, dark };
    const sp = SPEAKERS[look];
    if (sp) return typeof sp.look === 'string' ? { charId: sp.look, dark: dark ?? sp.dark } : { npc: sp.look, dark: dark ?? sp.dark };
    return { npc: { color: '#ffffff', accent: '#c0c0c0' }, dark };
  }

  private actor(name: string): Actor | null {
    if (name === 'hero' || name === 'player') return this.actors.get('hero') ?? this.actors.get('mametchi') ?? null;
    return this.actors.get(name) ?? null;
  }

  spawnActor(actor: string, look: string | NpcLook, x: number, z: number, dark?: boolean, dir?: 1 | -1, fx?: string): void {
    this.actors.get(actor)?.destroy();
    const t = this.lookTarget(look === 'hero' ? 'mametchi' : look, dark);
    const a = new Actor(this, t, x, sz(z), 0.9, !!t.charId);
    const name = typeof look === 'string' ? (CHARACTERS[(look === 'hero' ? 'mametchi' : look) as CharId]?.name ?? SPEAKERS[look]?.name ?? '') : '';
    if (name) a.setLabel(name, '#fffdf6');
    if (dir) { a.facingX = dir; a.view = 'side'; a.sprite.setFlipX(dir < 0); a.play('idle', true); }
    this.actors.set(actor, a);
    a.sync();
    if (fx) { this.burst(x, zToY(z) - 60, fx === 'poof' ? 0x6a4a9a : 0xfff6a0); audio.sfx(fx === 'poof' ? 'whoosh' : 'flip'); }
  }

  despawnActor(actor: string, fx?: string): void {
    const a = this.actors.get(actor);
    if (!a) return;
    this.actors.delete(actor);
    this.tweens.killTweensOf(a);
    if (fx) this.burst(a.x, zToY(a.z) - 60, fx === 'poof' ? 0x6a4a9a : 0xfff6a0);
    a.destroy();
  }

  walkActor(actor: string, x: number, z: number | undefined, run: boolean): Promise<void> {
    const a = this.actor(actor);
    if (!a) return Promise.resolve();
    const tz = z === undefined ? a.z : sz(z);
    const dx = x - a.x, dz = tz - a.z;
    if (Math.abs(dx) > 4) a.face(Math.sign(dx), 0); else if (Math.abs(dz) > 4) a.face(0, Math.sign(dz));
    a.play(run ? 'run' : 'walk', true);
    this.tweens.killTweensOf(a);
    return new Promise((r) => this.tweens.add({ targets: a, x, z: tz, duration: Math.hypot(dx, dz * 1.5) * (run ? 2.3 : 4.2) + 120, onComplete: () => { if (a.sprite.active) a.play('idle'); r(); } }));
  }

  moveActor(actor: string, x: number, z?: number): Promise<void> { return this.walkActor(actor, x, z, false); }

  placeActor(actor: string, x: number, z?: number): void {
    const a = this.actor(actor);
    if (!a) return;
    a.x = x;
    if (z !== undefined) a.z = sz(z);
    a.sync();
  }

  faceActor(actor: string, dir: 1 | -1): void { this.actor(actor)?.face(dir, 0); }

  setActorVisible(actor: string, v: boolean): void {
    const a = this.actor(actor);
    if (a) { a.visible = v; a.sync(); }
  }

  jumpActor(actor: string): Promise<void> {
    const a = this.actor(actor);
    if (!a) return Promise.resolve();
    audio.sfx('jump');
    a.spin();
    a.play('jump', true);
    const o = { y: 0 };
    return new Promise((r) => this.tweens.add({ targets: o, y: 110, yoyo: true, duration: 300, ease: 'Quad.out', onUpdate: () => { a.y = o.y; }, onComplete: () => { a.y = 0; a.play('idle', true); audio.sfx('land'); r(); } }));
  }

  bounceActor(actor: string, n: number): Promise<void> {
    const a = this.actor(actor);
    if (!a) return Promise.resolve();
    const o = { y: 0 };
    return new Promise((r) => this.tweens.add({ targets: o, y: 34, yoyo: true, repeat: Math.max(0, n - 1), duration: 150, ease: 'Quad.out', onUpdate: () => { a.y = o.y; }, onComplete: () => { a.y = 0; r(); } }));
  }

  shiverActor(actor: string, ms: number): Promise<void> {
    const a = this.actor(actor);
    if (!a) return Promise.resolve();
    const x0 = a.x;
    return new Promise((r) => this.tweens.add({ targets: a, x: x0 + 5, yoyo: true, repeat: Math.max(1, Math.floor(ms / 80)), duration: 40, onComplete: () => { a.x = x0; r(); } }));
  }

  animActor(actor: string, anim: string, ms: number): Promise<void> {
    const a = this.actor(actor);
    if (!a) return Promise.resolve();
    a.play(anim as any, true);
    if (anim === 'win') { a.spin(); this.burst(a.x, zToY(a.z) - 80, 0xfff6a0); }
    if (ms <= 0) { a.play('idle', true); return Promise.resolve(); }
    return new Promise((r) => this.time.delayedCall(ms, () => { a.play('idle', true); r(); }));
  }

  emote(actor: string, emote: string): void {
    const a = this.actor(actor);
    if (!a) return;
    const y = a.sprite.y - 120 * a.scaleNow();
    const b = this.add.image(a.x + 30, y, 'emote_bubble').setDepth(9600).setScale(0.1);
    const t = this.add.text(a.x + 30, y - 4, emote, { fontFamily: FONT, fontSize: '28px', color: '#e8203a' }).setOrigin(0.5).setDepth(9601).setScale(0.1);
    this.tweens.add({ targets: [b, t], scale: 0.9, duration: 200, ease: 'Back.out' });
    this.time.delayedCall(1300, () => { b.destroy(); t.destroy(); });
  }

  shake(ms: number): void {
    if (settings.current.screenShake) this.cameras.main.shake(ms, 0.01);
    audio.sfx('shake');
  }

  flash(color: number): void {
    const c = Phaser.Display.Color.IntegerToRGB(color);
    this.cameras.main.flash(400, c.r, c.g, c.b);
  }

  tint(color: number): void { this.cameras.main.setBackgroundColor(color); }

  cinema(on: boolean): void { if (on) cinema.on(); }

  pan(x: number, ms: number): Promise<void> {
    const cam = this.cameras.main;
    const tx = clamp(x, cam.width / 2, STAGE_W - cam.width / 2);
    if (ms <= 0) { cam.centerOn(tx, cam.midPoint.y); return Promise.resolve(); }
    return new Promise((r) => { cam.pan(tx, cam.midPoint.y, ms, 'Sine.easeInOut', true); this.time.delayedCall(ms + 30, () => r()); });
  }

  follow(ms: number): Promise<void> { return this.pan(STAGE_W / 2, ms); }

  zoom(z: number, ms: number): Promise<void> {
    const cam = this.cameras.main;
    if (ms <= 0) { cam.setZoom(z); return Promise.resolve(); }
    return new Promise((r) => { cam.zoomTo(z, ms, 'Sine.easeInOut', true); this.time.delayedCall(ms + 30, () => r()); });
  }

  private burst(x: number, y: number, tint: number): void {
    const p = this.add.particles(x, y, 'p_paper', { speed: { min: 80, max: 240 }, lifespan: 600, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.2 }, gravityY: 500, tint, emitting: false }).setDepth(9000);
    p.explode(14);
    this.time.delayedCall(800, () => p.destroy());
  }

  fx(name: string, actor?: string, x?: number): Promise<void> {
    const a = actor ? this.actor(actor) : null;
    const px = x ?? a?.x ?? STAGE_W / 2;
    const py = a ? zToY(a.z) - 80 : GROUND_TOP;
    const delay = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
    switch (name) {
      case 'shipFly': {
        // cut to the outside: the airship sails across the sky
        const cam = this.cameras.main;
        dialogue.hide();
        for (const d of this.deck) (d as any).setVisible?.(false);
        for (const act of this.actors.values()) { act.visible = false; act.sync(); }
        const ship = this.add.image(cam.scrollX - 300, 300, this.shipTexture()).setDepth(5000).setScale(0.9);
        this.tweens.add({ targets: ship, x: cam.scrollX + cam.width + 300, duration: 3600, ease: 'Sine.inOut' });
        this.tweens.add({ targets: ship, y: 260, yoyo: true, repeat: 3, duration: 450, ease: 'Sine.inOut' });
        audio.sfx('whoosh');
        // the caption that follows plays while the ship is still crossing the sky
        return delay(700);
      }
      case 'darkPuff': {
        const p = this.add.particles(px, py, 'p_mote', { speed: { min: 60, max: 220 }, lifespan: 1000, scale: { start: 2, end: 0 }, emitting: false }).setDepth(9400);
        p.explode(36);
        audio.sfx('shake');
        this.time.delayedCall(1200, () => p.destroy());
        return delay(700);
      }
      case 'sparkle': case 'starburst': {
        const p = this.add.particles(px, py, 'p_star', { speed: { min: 40, max: 260 }, lifespan: 900, scale: { start: 1.2, end: 0 }, emitting: false }).setDepth(9400);
        p.explode(name === 'starburst' ? 40 : 18);
        audio.sfx(name === 'starburst' ? 'shard' : 'magic');
        this.time.delayedCall(1100, () => p.destroy());
        return delay(600);
      }
      default:
        this.burst(px, py, 0xffffff);
        return delay(300);
    }
  }

  /** The ch3 air battle starts at the end of the airship ride. */
  async minigame(id: string): Promise<void> {
    this.broadcastFx('minigame', id);
    await playMinigame(this, id);
    cinema.on();
  }

  // not used on the stage
  battle(): Promise<'win' | 'lose' | 'flee'> { return Promise.resolve('win'); }
  chapterEnd(): Promise<void> { return Promise.resolve(); }
  ending(): Promise<void> { return Promise.resolve(); }
  opening(): Promise<void> { return Promise.resolve(); }
  save(): void { /* nothing to save */ }

  broadcastDialogue(kind: 'line' | 'adv' | 'choice' | 'pick' | 'end' | 'skip', data?: any): void {
    if (worldNet.active && !this.mirror) worldNet.broadcastDialogue(kind, data);
  }

  broadcastFx(kind: string, data: any): void {
    if (worldNet.active && !this.mirror && G.net?.isHost) worldNet.broadcastField('stage', { kind: 'fx', data: { kind, data } });
  }

  /** Multiplayer clients: replay the host's stage directions. */
  applyRemoteFx(kind: string, data: any): void {
    switch (kind) {
      case 'spawn': this.spawnActor(data.actor, data.look, data.x, data.z ?? 130, data.dark, data.dir, data.fx); break;
      case 'despawn': this.despawnActor(data.actor, data.fx); break;
      case 'walk': void this.walkActor(data.actor, data.x, data.z, !!data.run); break;
      case 'place': this.placeActor(data.actor, data.x, data.z); break;
      case 'face': this.faceActor(data.actor, data.dir); break;
      case 'jump': void this.jumpActor(data); break;
      case 'anim': void this.animActor(data.actor, data.anim, data.ms); break;
      case 'bounce': void this.bounceActor(data.actor, data.n ?? 2); break;
      case 'shiver': void this.shiverActor(data.actor, data.ms ?? 700); break;
      case 'emote': this.emote(data.actor, data.emote); break;
      case 'shake': this.shake(data); break;
      case 'flash': this.flash(data); break;
      case 'sfx': audio.sfx(data); break;
      case 'music': audio.playMusic(data); break;
      case 'pan': void this.pan(data.x, data.ms); break;
      case 'zoom': void this.zoom(data.z, data.ms); break;
      case 'caption': void cinema.caption(data.text, data.ms); break;
      case 'fx': void this.fx(data.name, data.actor, data.x); break;
      case 'minigame': void playMinigame(this, data).then(() => cinema.on()); break;
    }
  }
}

export const STAGE_CENTER = STAGE_W / 2;
void GAME_H;
