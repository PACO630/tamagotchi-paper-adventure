/**
 * Field gameplay beyond walking and jumping:
 *  - partner field abilities (ability button / ability spots), one per partner
 *  - chase set pieces (something big rolls after the party)
 *  - security searchlights (chapter 4), deep water with an oxygen meter (chapter 5)
 *  - the mirror-shadow puzzle (chapter 7)
 * Owned by the WorldScene; everything visual here is local, shared results go through the authority.
 */
import Phaser from 'phaser';
import { DEPTH, FONT, GROUND_TOP } from '../core/config';
import { G } from '../core/game';
import { clamp } from '../core/util';
import { canvas } from '../art/paperArt';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import type { ChaseDef, CharId, ObjDef, ZoneDef } from '../data/types';
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { settings } from '../systems/settings';
import { toast } from '../ui/dom';
import { Actor, depthScale, zToY } from './actor';
import { worldNet } from './worldNet';

/** Field abilities: who has which, shown in the HUD / help. */
export const ABILITIES: Record<CharId, { name: string; desc: string }> = {
  mametchi: { name: '感應器探測', desc: '感應附近藏起來的寶箱。' },
  kuchipatchi: { name: '大口吸', desc: '一口吃掉擋路的巨大食物，或直接吞掉小型敵人。' },
  memetchi: { name: '甜點誘餌', desc: '丟出蛋糕，附近的敵人會跑去吃，暫時不會追你。也能引開貪吃的守衛。' },
  mimitchi: { name: '順風耳', desc: '聽見藏起來的東西：隱藏寶箱和看不見的雲朵平台會現形一段時間。' },
  maskutchi: { name: '英雄變裝', desc: '躲進紙箱變裝！一段時間內敵人和監視器都認不出你。' },
  gozarutchi: { name: '泡泡忍術', desc: '吐出大泡泡：補滿氧氣，並在短時間內擋住電流和陷阱。' },
  violetchi: { name: '彩繪', desc: '把灰色的輪廓畫回真正的東西：橋、門、平台。' },
  oyajitchi: { name: '星之燈', desc: '點亮星星提燈：照亮黑暗，讓藏在暗處的道路現形。' },
};

const COOLDOWN: Partial<Record<CharId, number>> = { memetchi: 4, mimitchi: 3, maskutchi: 9, gozarutchi: 10, oyajitchi: 6, mametchi: 3 };

interface Lure { x: number; z: number; t: number; img: Phaser.GameObjects.Image }
interface ChaseRun { def: ChaseDef; x: number; spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; caught: number }
interface Spot { zone: ZoneDef; x: number; z: number; light: Phaser.GameObjects.Image; cam: Phaser.GameObjects.Image; beam: Phaser.GameObjects.Graphics; ph: number }

export class FieldPlay {
  cooldown = 0;
  disguiseT = 0;
  bubbleT = 0;
  reveal = { listen: 0, light: 0 };
  lures: Lure[] = [];
  oxygen = 1;
  private oxyBar: Phaser.GameObjects.Graphics;
  private oxyText: Phaser.GameObjects.Text;
  private oxyHurtT = 0;
  private box: Phaser.GameObjects.Image | null = null;
  private bubble: Phaser.GameObjects.Image | null = null;
  chase: ChaseRun | null = null;
  private spots: Spot[] = [];
  private shadow: Actor | null = null;
  private lastPX = 0;
  private plateImgs = new Map<string, Phaser.GameObjects.Image>();
  private mirrorSolved = false;

  constructor(private w: any) {
    const sc: Phaser.Scene = w;
    this.oxyBar = sc.add.graphics().setDepth(9450).setVisible(false);
    this.oxyText = sc.add.text(0, 0, '氧氣', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#1a3a6a', strokeThickness: 4 }).setOrigin(0.5).setDepth(9451).setVisible(false);
    this.buildSpots();
    this.buildMirror();
  }

  get scene(): Phaser.Scene { return this.w; }
  get player(): Actor { return this.w.player; }

  /* ======================= textures ======================= */

  static tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): string {
    if (scene.textures.exists(key)) return key;
    const [c, g] = canvas(w, h);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g);
    scene.textures.addCanvas(key, c);
    return key;
  }

  private cakeTex(): string {
    return FieldPlay.tex(this.scene, 'fp:cake', 70, 64, (g) => {
      g.fillStyle = '#fff4e0'; g.fillRect(8, 30, 54, 28); g.fillStyle = '#ff8ac4'; g.fillRect(8, 24, 54, 12);
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 3; g.strokeRect(8, 24, 54, 34);
      g.fillStyle = '#e8203a'; g.beginPath(); g.arc(35, 18, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    });
  }

  private boxTex(): string {
    return FieldPlay.tex(this.scene, 'fp:box', 120, 110, (g) => {
      g.fillStyle = '#d8a868'; g.strokeStyle = '#2a1a0a'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(10, 30); g.lineTo(110, 30); g.lineTo(104, 106); g.lineTo(16, 106); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c08a4a'; g.beginPath(); g.moveTo(10, 30); g.lineTo(30, 8); g.lineTo(60, 30); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(110, 30); g.lineTo(92, 6); g.lineTo(60, 30); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(44, 62, 10, 12, 0, 0, Math.PI * 2); g.ellipse(76, 62, 10, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#2a1a0a'; g.beginPath(); g.arc(46, 64, 5, 0, Math.PI * 2); g.arc(78, 64, 5, 0, Math.PI * 2); g.fill();
      g.font = 'bold 18px sans-serif'; g.fillStyle = '#8a5a2a'; g.fillText('TOY', 42, 96);
    });
  }

  private bubbleTex(): string {
    return FieldPlay.tex(this.scene, 'fp:bubble', 180, 180, (g) => {
      const gr = g.createRadialGradient(70, 60, 10, 90, 90, 88);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.8, 'rgba(160,220,255,0.25)'); gr.addColorStop(1, 'rgba(120,200,255,0.7)');
      g.fillStyle = gr; g.beginPath(); g.arc(90, 90, 86, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.arc(62, 56, 18, Math.PI, Math.PI * 1.5); g.stroke();
    });
  }

  chaserTex(look: ChaseDef['look']): string {
    return FieldPlay.tex(this.scene, `fp:chase:${look}`, 360, 360, (g) => {
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 7;
      if (look === 'gumball') {
        const gr = g.createRadialGradient(140, 130, 20, 180, 180, 170);
        gr.addColorStop(0, '#ffd0ea'); gr.addColorStop(1, '#ff4a9a');
        g.fillStyle = gr; g.beginPath(); g.arc(180, 180, 168, 0, Math.PI * 2); g.fill(); g.stroke();
        const cols = ['#7affb0', '#ffe04a', '#7ab8ff', '#ffffff'];
        for (let i = 0; i < 26; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(60 + (i * 97) % 240, 60 + (i * 61) % 240, 12, 6, i, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(130, 150, 26, 34, 0, 0, Math.PI * 2); g.ellipse(230, 150, 26, 34, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#2a1a0a'; g.beginPath(); g.arc(140, 160, 12, 0, Math.PI * 2); g.arc(240, 160, 12, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(120, 240); g.quadraticCurveTo(180, 290, 250, 240); g.stroke();
      } else if (look === 'angler') {
        g.fillStyle = '#2a3a6a'; g.beginPath(); g.ellipse(170, 200, 160, 120, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#fffdf6'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(240 + i * 12, 200); g.lineTo(246 + i * 12, 226); g.lineTo(252 + i * 12, 200); g.fill(); }
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(250, 150, 26, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#e8203a'; g.beginPath(); g.arc(256, 152, 12, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(220, 90); g.quadraticCurveTo(300, 0, 330, 60); g.stroke();
        const gr = g.createRadialGradient(330, 70, 2, 330, 70, 34); gr.addColorStop(0, '#ffffe0'); gr.addColorStop(1, 'rgba(255,240,120,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(330, 70, 34, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4a5a9a'; g.beginPath(); g.moveTo(20, 200); g.lineTo(-10, 120); g.lineTo(-10, 280); g.closePath(); g.fill();
      } else if (look === 'shadow') {
        g.fillStyle = '#140a22';
        g.beginPath(); g.moveTo(0, 360);
        for (let y = 360; y >= 0; y -= 30) g.lineTo(200 + Math.sin(y / 30) * 50 + (y % 60 ? 60 : 0), y);
        g.lineTo(0, 0); g.closePath(); g.fill();
        g.fillStyle = '#ff3aa0'; for (const [x, y] of [[200, 120], [150, 220], [210, 290]]) { g.beginPath(); g.ellipse(x, y, 14, 8, 0, 0, Math.PI * 2); g.fill(); }
      } else {
        g.fillStyle = '#b8b0a8'; g.fillRect(80, 60, 200, 280); g.strokeRect(80, 60, 200, 280);
        g.fillStyle = '#e8203a'; g.beginPath(); g.arc(140, 150, 16, 0, Math.PI * 2); g.arc(220, 150, 16, 0, Math.PI * 2); g.fill();
      }
    });
  }

  /* ======================= abilities ======================= */

  /** The character whose ability the ability button uses. */
  abilityChar(): CharId | null {
    if (G.mode === 'multi') return G.localChar as CharId;
    return (G.state.partners.active as CharId | null) ?? null;
  }

  /** Ability spot near the player that is not solved yet. */
  nearbySpot(range = 170): ObjDef | null {
    const p = this.player;
    let best: ObjDef | null = null, bd = range;
    for (const o of this.w.objects) {
      const d: ObjDef = o.def;
      if (d.type !== 'ability' || (d.flag && G.cond(d.flag)) || (d.showIf && !G.cond(d.showIf))) continue;
      const dist = Math.abs(d.x - p.x);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  /** Ability button. */
  use(): void {
    const who = this.abilityChar();
    if (!who) { toast('還沒有夥伴。有夥伴加入後，按 C 就能使用夥伴的能力！', 'warn', 1800); return; }
    if (this.cooldown > 0) { audio.sfx('error'); return; }
    const spot = this.nearbySpot();
    if (spot && spot.need === who) { void this.w.tryAbilitySpot(spot.id); return; }
    this.cooldown = COOLDOWN[who] ?? 1.2;
    this.perform(who);
  }

  /** Visual + local effect of an ability (shared effects ask the authority). */
  perform(who: CharId): void {
    const p = this.player;
    const sc = this.scene;
    const fx = (name: string) => this.w.abilityFx(name);
    switch (who) {
      case 'kuchipatchi': {
        fx('suck');
        const hx = p.x + p.facingX * 80;
        const e = this.w.enemies.find((x: any) => x.alive && x.spr.visible && Math.abs(x.x - hx) < 90 && Math.abs(x.z - p.z) < 60);
        if (e && this.edible(e)) {
          if (G.mode === 'multi' && !G.isAuthority) { e.alive = false; worldNet.requestInteract('eat', e.id); }
          else this.w.eatEnemy(e.id);
          this.slurp(e.spr);
        } else if (e) toast('太大了，吞不下去……', 'warn', 1300);
        else toast('大口吸！……什麼都沒吸到。', 'info', 1100);
        break;
      }
      case 'memetchi': {
        const x = clamp(p.x + p.facingX * 170, 40, this.w.areaRight() - 40), z = p.z;
        const img = sc.add.image(p.x, zToY(p.z) - 60, this.cakeTex()).setDepth(zToY(z)).setScale(0.8);
        sc.tweens.add({ targets: img, x, duration: 420, ease: 'Linear' });
        sc.tweens.add({ targets: img, y: { from: zToY(p.z) - 60, to: zToY(z) - 120 }, duration: 210, yoyo: true, ease: 'Quad.out', onComplete: () => img.setY(zToY(z)).setOrigin(0.5, 1) });
        audio.sfx('swing');
        const lure: Lure = { x, z, t: 7, img };
        this.lures.push(lure);
        sc.time.delayedCall(450, () => { audio.sfx('item'); this.w.paperBurst(x, zToY(z) - 30, 0xff8ac4, 10); });
        break;
      }
      case 'mimitchi': {
        this.reveal.listen = 12;
        fx('listen');
        audio.sfx('magic');
        const found = this.w.revealChestsNear(p.x, 650);
        const secrets = this.w.plats.some((pl: any) => pl.def?.secret === 'listen' && Math.abs(pl.x - p.x) < 900);
        toast(found ? '聽到了！附近有藏起來的寶箱！' : secrets ? '聽見風的聲音……看不見的雲出現了！' : '靜靜地聽……附近沒有特別的聲音。', found || secrets ? 'good' : 'info', 1700);
        break;
      }
      case 'maskutchi': {
        this.disguiseT = 7;
        audio.sfx('magic');
        this.w.paperBurst(p.x, zToY(p.z) - 60, 0xd8a868, 16);
        toast('英雄變裝！現在誰也認不出你（7 秒）', 'good', 1500);
        break;
      }
      case 'gozarutchi': {
        this.bubbleT = 6;
        this.oxygen = 1;
        audio.sfx('heal');
        toast('泡泡忍術！氧氣補滿，暫時不怕電流。', 'good', 1500);
        break;
      }
      case 'violetchi': {
        fx('paint');
        toast('這裡沒有可以畫的輪廓。找找灰色虛線的地方吧！', 'info', 1600);
        break;
      }
      case 'oyajitchi': {
        this.reveal.light = 12;
        fx('light');
        audio.sfx('magic');
        toast('星之燈亮起來了！暗處的道路現形了。', 'good', 1500);
        break;
      }
      case 'mametchi': {
        fx('listen');
        const found = this.w.revealChestsNear(p.x, 500);
        toast(found ? '感應器嗶嗶叫！發現了隱藏寶箱！' : '感應器沒有反應。', found ? 'good' : 'info', 1400);
        break;
      }
    }
  }

  private edible(e: any): boolean {
    const def = ENEMIES[e.enemy];
    return !def.traits.includes('boss') && !def.traits.includes('armored') && (e.small || def.hp <= 40);
  }

  private slurp(spr: Phaser.GameObjects.Sprite): void {
    const p = this.player;
    this.scene.tweens.add({ targets: spr, x: p.x + p.facingX * 30, y: zToY(p.z) - 50, scale: 0.05, angle: 360, duration: 380, ease: 'Quad.in' });
    audio.sfx('bite');
  }

  /* ======================= chases ======================= */

  startChase(id: string): void {
    if (this.chase) return;
    const def: ChaseDef | undefined = this.w.chapter.chases?.find((c: ChaseDef) => c.id === id);
    if (!def || G.cond(def.flag)) return;
    const sc = this.scene;
    const x = Math.min(this.player.x - 560, def.x0 - 300);
    const spr = sc.add.image(x, zToY(DEPTH / 2), this.chaserTex(def.look)).setOrigin(0.5, 0.92).setScale(def.look === 'shadow' ? 1.6 : 1.05);
    const shadow = sc.add.image(x, zToY(DEPTH / 2), 'shadow').setScale(3.2, 1.6).setAlpha(0.5);
    this.chase = { def, x, spr, shadow, caught: 0 };
    audio.playMusic('boss');
    if (settings.current.screenShake) sc.cameras.main.shake(400, 0.006);
  }

  private updateChase(dt: number, can: boolean): void {
    const c = this.chase;
    if (!c) return;
    const p = this.player;
    if (G.cond(c.def.flag)) { this.endChase(false); return; }
    if (can && c.caught <= 0) {
      c.x += c.def.speed * dt;
      if (c.x < p.x - 760) c.x = p.x - 760;
    }
    const front = c.x + (c.def.look === 'shadow' ? 120 : 150);
    c.spr.setPosition(c.x, zToY(DEPTH / 2) + 40).setDepth(zToY(DEPTH));
    if (c.def.look === 'gumball') c.spr.rotation += (c.def.speed / 170) * dt;
    else c.spr.y += Math.sin(this.scene.time.now / 120) * 6;
    c.shadow.setPosition(c.x, zToY(DEPTH / 2) + 50).setDepth(zToY(0));
    if (c.caught > 0) { c.caught -= dt; return; }
    if (can && front > p.x - 10) {
      // caught: back to the start of the chase
      c.caught = 0.9;
      audio.sfx('hurt');
      if (settings.current.screenShake) this.scene.cameras.main.shake(300, 0.012);
      this.w.damageHero(1);
      toast('被追上了！再跑一次！（按住 Shift／推到底奔跑）', 'warn', 1800);
      this.scene.cameras.main.fadeOut(250);
      this.scene.time.delayedCall(300, () => {
        this.w.placeActor('hero', c.def.x0, clamp(p.z, 20, DEPTH - 20));
        c.x = c.def.x0 - 560;
        this.scene.cameras.main.fadeIn(300);
      });
      return;
    }
    if (p.x >= c.def.x1) this.endChase(true);
  }

  endChase(won: boolean): void {
    const c = this.chase;
    if (!c) return;
    this.chase = null;
    audio.playMusic(this.w.chapter.music);
    if (won) {
      audio.sfx('break');
      if (settings.current.screenShake) this.scene.cameras.main.shake(500, 0.014);
      this.w.paperBurst(c.x + 120, zToY(DEPTH / 2) - 100, 0xffffff, 30);
      if (G.isAuthority) G.dispatch({ a: 'flag', k: c.def.flag, v: true });
      else worldNet.requestInteract('chaseDone', c.def.id);
    }
    this.scene.tweens.add({ targets: [c.spr, c.shadow], alpha: 0, scaleX: 0.2, duration: 500, onComplete: () => { c.spr.destroy(); c.shadow.destroy(); } });
  }

  /* ======================= searchlights ======================= */

  private buildSpots(): void {
    const sc = this.scene;
    const lightKey = FieldPlay.tex(sc, 'fp:spot', 220, 110, (g) => {
      const gr = g.createRadialGradient(110, 55, 4, 110, 55, 108);
      gr.addColorStop(0, 'rgba(255,250,170,0.95)'); gr.addColorStop(0.7, 'rgba(255,230,120,0.55)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
      g.fillStyle = gr; g.save(); g.scale(1, 0.5); g.beginPath(); g.arc(110, 110, 108, 0, Math.PI * 2); g.restore(); g.fill();
    });
    const camKey = FieldPlay.tex(sc, 'fp:cam', 110, 90, (g) => {
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 4;
      g.fillStyle = '#6a6a78'; g.fillRect(45, 0, 20, 30); g.strokeRect(45, 0, 20, 30);
      g.fillStyle = '#d8d8e0'; g.beginPath(); g.roundRect(10, 26, 90, 46, 12); g.fill(); g.stroke();
      g.fillStyle = '#2a2a3a'; g.beginPath(); g.arc(55, 50, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8203a'; g.beginPath(); g.arc(88, 36, 5, 0, Math.PI * 2); g.fill();
    });
    for (const z of this.w.chapter.zones as ZoneDef[]) {
      if (z.type !== 'spotlight') continue;
      const cx = z.x + z.w / 2;
      const cam = sc.add.image(cx, GROUND_TOP - 220, camKey).setDepth(5900);
      const beam = sc.add.graphics().setDepth(5800).setBlendMode(Phaser.BlendModes.ADD);
      const light = sc.add.image(cx, zToY(120), lightKey).setDepth(zToY(0) + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.spots.push({ zone: z, x: cx, z: 120, light, cam, beam, ph: (z.x % 7) / 7 });
    }
  }

  private updateSpots(t: number, can: boolean): void {
    const p = this.player;
    for (const s of this.spots) {
      const per = s.zone.period ?? 4;
      const ph = (t / per + s.ph) * Math.PI * 2;
      s.x = s.zone.x + s.zone.w / 2 + Math.sin(ph) * (s.zone.w / 2 - 50);
      s.z = DEPTH / 2 + Math.sin(ph * 1.7) * (DEPTH / 2 - 40);
      const y = zToY(s.z);
      s.light.setPosition(s.x, y).setScale(depthScale(s.z) * 1.05);
      s.cam.setRotation(Math.atan2(s.x - s.cam.x, 200) * -0.6);
      s.beam.clear().fillStyle(0xfff6a0, 0.12).fillTriangle(s.cam.x, s.cam.y + 30, s.x - 90, y, s.x + 90, y);
      const seen = can && this.disguiseT <= 0 && this.w.invuln <= 0 && p.y < 60 && Math.abs(p.x - s.x) < 85 && Math.abs(p.z - s.z) < 42;
      if (seen) this.caughtBySpot(s);
    }
  }

  private caughtBySpot(s: Spot): void {
    const sc = this.scene;
    audio.sfx('error');
    sc.cameras.main.flash(300, 255, 60, 60);
    this.w.emote('hero', '!');
    toast('嗶嗶！被監視器發現了！（用假面吉的「英雄變裝」就不會被發現）', 'warn', 2200);
    this.w.invuln = 1.6;
    sc.cameras.main.fadeOut(220);
    sc.time.delayedCall(260, () => {
      this.w.placeActor('hero', s.zone.x - 90, clamp(this.player.z, 20, DEPTH - 20));
      sc.cameras.main.fadeIn(260);
    });
  }

  /* ======================= deep water ======================= */

  private updateOxygen(dt: number, can: boolean): void {
    const p = this.player;
    const deep = this.w.chapter.zones.find((z: ZoneDef) => z.type === 'deep' && this.w.zoneOn(z) && p.x >= z.x && p.x <= z.x + z.w) as ZoneDef | undefined;
    const vent = this.w.objects.find((o: any) => o.def.type === 'vent' && Math.abs(o.def.x - p.x) < 70 && Math.abs(o.def.z - p.z) < 60);
    if (vent && this.oxygen < 1) { this.oxygen = Math.min(1, this.oxygen + dt * 1.2); if (Math.random() < 0.2) audio.sfx('bubble', 1.3); }
    else if (deep && can && this.bubbleT <= 0) this.oxygen = Math.max(0, this.oxygen - dt / 13);
    else if (!deep) this.oxygen = Math.min(1, this.oxygen + dt * 0.5);
    const show = !!deep || this.oxygen < 1;
    this.oxyBar.setVisible(show);
    this.oxyText.setVisible(show);
    if (show) {
      const x = p.x, y = zToY(p.z) - 150 * depthScale(p.z) - p.y;
      const low = this.oxygen < 0.3;
      this.oxyBar.clear().fillStyle(0x0a2a5a, 0.8).fillRoundedRect(x - 52, y - 9, 104, 18, 8)
        .fillStyle(low ? 0xff5a5a : 0x7ad8ff, 1).fillRoundedRect(x - 49, y - 6, 98 * this.oxygen, 12, 6)
        .lineStyle(3, 0xffffff, 1).strokeRoundedRect(x - 52, y - 9, 104, 18, 8);
      this.oxyText.setPosition(x, y - 22).setText(low ? '氧氣快沒了！' : '氧氣').setColor(low ? '#ffd0d0' : '#ffffff');
    }
    if (deep && this.oxygen <= 0 && can) {
      this.oxyHurtT -= dt;
      if (this.oxyHurtT <= 0) {
        this.oxyHurtT = 2;
        audio.sfx('hurt');
        this.w.damageHero(1);
        toast('喘不過氣了！快去冒泡泡的海底氣孔，或讓忍者吉用「泡泡忍術」！', 'warn', 2400);
        this.oxygen = 0.35;
        this.w.placeActor('hero', deep.x - 60, clamp(p.z, 20, DEPTH - 20));
      }
    }
  }

  /** Damage from hazards is blocked while the bubble is up. */
  get shielded(): boolean { return this.bubbleT > 0; }

  /* ======================= mirror shadow ======================= */

  private buildMirror(): void {
    const m = this.w.chapter.mirror;
    if (!m) return;
    const sc = this.scene;
    this.mirrorSolved = G.cond(m.flag);
    this.shadow = new Actor(sc, { charId: 'mametchi', dark: true }, this.mirrorSolved ? m.shadowStart : m.shadowStart, m.z, 0.86);
    this.shadow.setLabel('影子麻每吉', '#d8a0ff');
    this.shadow.face(-1, 0);
    const wallKey = FieldPlay.tex(sc, 'fp:shadowwall', 60, 160, (g) => {
      g.fillStyle = 'rgba(160,60,255,0.55)'; g.strokeStyle = '#2a0a4a'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(10, 160); g.lineTo(18, 30); g.lineTo(30, 4); g.lineTo(42, 30); g.lineTo(50, 160); g.closePath(); g.fill(); g.stroke();
    });
    for (const x of m.walls) {
      sc.add.image(x, zToY(m.z) + 10, wallKey).setOrigin(0.5, 1).setDepth(zToY(m.z)).setAlpha(0.9);
      sc.add.text(x, zToY(m.z) - 160, '影子柵欄', { fontFamily: FONT, fontSize: '14px', color: '#e0c0ff', stroke: '#1a0a2a', strokeThickness: 4 }).setOrigin(0.5).setDepth(zToY(m.z) + 1);
    }
    this.lastPX = this.player?.x ?? 0;
  }

  plateTex(by: 'hero' | 'shadow', on: boolean): string {
    return FieldPlay.tex(this.scene, `fp:plate:${by}:${on ? 1 : 0}`, 130, 60, (g) => {
      g.fillStyle = by === 'hero' ? (on ? '#ffe680' : '#c8b060') : (on ? '#d0a0ff' : '#6a4a9a');
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(65, 30, 60, 24, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = by === 'hero' ? '#fff6c0' : '#2a0a4a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
      g.fillText(by === 'hero' ? '光' : '影', 65, 38);
    });
  }

  registerPlate(id: string, img: Phaser.GameObjects.Image): void { this.plateImgs.set(id, img); }

  private updateMirror(can: boolean): void {
    const m = this.w.chapter.mirror;
    const sh = this.shadow;
    if (!m || !sh) return;
    const p = this.player;
    const dx = p.x - this.lastPX;
    this.lastPX = p.x;
    if (!this.mirrorSolved && can && p.x >= m.x0 && p.x <= m.x1 && Math.abs(dx) < 60) {
      let nx = clamp(sh.x - dx, m.x0, m.x1);
      for (const wx of m.walls) {
        if (sh.x <= wx - 30 && nx > wx - 30) nx = wx - 30;
        if (sh.x >= wx + 30 && nx < wx + 30) nx = wx + 30;
      }
      if (Math.abs(nx - sh.x) > 0.5) { sh.face(nx - sh.x, 0); sh.play(Math.abs(dx) > 4 ? 'run' : 'walk'); }
      else sh.play('idle');
      sh.x = nx;
    } else sh.play(this.mirrorSolved ? 'idle' : 'idle');
    sh.sync();
    // plates
    const plates = this.w.objects.filter((o: any) => o.def.type === 'plate');
    let all = plates.length > 0;
    for (const o of plates) {
      const d: ObjDef = o.def;
      const on = this.mirrorSolved || (d.by === 'shadow' ? Math.abs(sh.x - d.x) < 45 : Math.abs(p.x - d.x) < 50 && Math.abs(p.z - d.z) < 45 && p.y < 20);
      o.img[0]?.setTexture(this.plateTex(d.by ?? 'hero', on));
      if (!on) all = false;
    }
    if (all && !this.mirrorSolved) {
      this.mirrorSolved = true;
      audio.sfx('quest');
      toast('光與影的機關同時亮起！', 'quest');
      if (G.isAuthority) G.dispatch({ a: 'flag', k: m.flag, v: true });
      else worldNet.requestInteract('mirrorDone', m.flag);
      this.scene.tweens.add({ targets: sh.sprite, alpha: 0.35, duration: 800 });
    }
  }

  /* ======================= per frame ======================= */

  update(t: number, dt: number, can: boolean): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const k of ['listen', 'light'] as const) if (this.reveal[k] > 0) this.reveal[k] -= dt;
    // disguise box follows the player
    if (this.disguiseT > 0) {
      this.disguiseT -= dt;
      if (!this.box) this.box = this.scene.add.image(0, 0, this.boxTex()).setOrigin(0.5, 1);
      const p = this.player;
      this.box.setPosition(p.x, zToY(p.z) + 4 - p.y).setDepth(zToY(p.z) + 1).setScale(depthScale(p.z) * 0.95).setAlpha(this.disguiseT < 1.5 && Math.floor(this.disguiseT * 8) % 2 ? 0.4 : 1);
      p.sprite.setAlpha(0.001);
      if (this.disguiseT <= 0) { this.box.destroy(); this.box = null; p.sprite.setAlpha(1); audio.sfx('flip'); this.w.paperBurst(p.x, zToY(p.z) - 50, 0xd8a868, 10); }
    }
    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      if (!this.bubble) this.bubble = this.scene.add.image(0, 0, this.bubbleTex()).setOrigin(0.5, 0.75);
      const p = this.player;
      this.bubble.setPosition(p.x, zToY(p.z) - p.y).setDepth(zToY(p.z) + 2).setScale(depthScale(p.z) * (1 + Math.sin(t * 6) * 0.03)).setAlpha(this.bubbleT < 1.5 && Math.floor(this.bubbleT * 8) % 2 ? 0.3 : 0.9);
      if (this.bubbleT <= 0) { this.bubble.destroy(); this.bubble = null; audio.sfx('bubble'); }
    }
    // an armed chase starts again whenever the party walks back into its stretch
    if (!this.chase && can) {
      const px = this.player.x;
      for (const c of (this.w.chapter.chases ?? []) as ChaseDef[]) {
        if (c.armed && G.cond(c.armed) && !G.cond(c.flag) && px >= c.x0 && px < c.x1 - 40) { this.startChase(c.id); break; }
      }
    }
    for (const l of this.lures) l.t -= dt;
    for (const l of this.lures.filter((x) => x.t <= 0)) this.scene.tweens.add({ targets: l.img, alpha: 0, scale: 0.2, duration: 300, onComplete: () => l.img.destroy() });
    this.lures = this.lures.filter((x) => x.t > 0);
    this.updateChase(dt, can);
    this.updateSpots(t, can);
    this.updateOxygen(dt, can);
    this.updateMirror(can);
  }

  /** Where a distracted enemy should go (nearest cake), if any. */
  lureFor(x: number, z: number): Lure | null {
    let best: Lure | null = null, bd = 420;
    for (const l of this.lures) { const d = Math.hypot(l.x - x, (l.z - z) * 1.5); if (d < bd) { bd = d; best = l; } }
    return best;
  }

  get hidden(): boolean { return this.disguiseT > 0; }

  /** Nice name for "needs X's ability" messages. */
  static needText(need: CharId): string {
    return `${CHARACTERS[need].name}的「${ABILITIES[need].name}」`;
  }

  /** Remaining frames: input help for the HUD chip. */
  static key(): string { return input.lastDevice === 'touch' ? '能力鈕' : 'C'; }
}
