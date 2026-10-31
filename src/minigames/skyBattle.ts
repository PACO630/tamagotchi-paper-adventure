/**
 * Chapter 3 set piece: the airship is attacked on its way up to the sky island.
 * Steer up/down (and a little left/right); the ship fires paper stars on its own.
 * Survive the gale birds, then shoot down the grey brothers' blimp.
 */
import Phaser from 'phaser';
import { FONT, GAME_H } from '../core/config';
import { clamp } from '../core/util';
import { canvas } from '../art/paperArt';
import { ensureEnemySheet } from '../art/textures';
import { input } from '../input/input';
import { audio } from '../systems/audio';
import { settings } from '../systems/settings';
import { cinema } from '../ui/cinema';

interface Bird { s: Phaser.GameObjects.Sprite; hp: number; vy: number; t: number; shootT: number }
interface Shot { o: Phaser.GameObjects.Image; vx: number; vy: number; enemy: boolean }

export class SkyBattleScene extends Phaser.Scene {
  onDone: ((won: boolean) => void) | null = null;
  private ship!: Phaser.GameObjects.Image;
  private birds: Bird[] = [];
  private shots: Shot[] = [];
  private hp = 5;
  private hearts!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private t = 0;
  private fireT = 0;
  private spawnT = 1;
  private kills = 0;
  private need = 14;
  private blimp: { o: Phaser.GameObjects.Container; hp: number; max: number; bar: Phaser.GameObjects.Graphics; shootT: number } | null = null;
  private over = false;
  private invuln = 0;
  private clouds: Phaser.GameObjects.TileSprite[] = [];

  constructor() {
    super('SkyBattle');
  }

  private tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): string {
    if (this.textures.exists(key)) return key;
    const [c, g] = canvas(w, h);
    g.lineJoin = 'round';
    draw(g);
    this.textures.addCanvas(key, c);
    return key;
  }

  create(): void {
    this.birds = []; this.shots = []; this.hp = 5; this.t = 0; this.fireT = 0; this.spawnT = 1.2; this.kills = 0; this.blimp = null; this.over = false; this.invuln = 0; this.clouds = [];
    const W = this.scale.width;
    const sky = this.tex('sky:mini', 64, 720, (g) => { const gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#4aa0ff'); gr.addColorStop(1, '#e0f4ff'); g.fillStyle = gr; g.fillRect(0, 0, 64, 720); });
    this.add.image(0, 0, sky).setOrigin(0).setDisplaySize(W, GAME_H);
    const cloud = this.tex('sky:minicloud', 512, 220, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (const [x, y, r] of [[70, 130, 54], [140, 110, 66], [210, 135, 50], [360, 100, 44], [420, 90, 56]]) { g.beginPath(); g.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2); g.fill(); }
    });
    for (const [y, s, a] of [[60, 0.7, 0.6], [330, 1.1, 0.8], [560, 1.6, 1]] as [number, number, number][]) this.clouds.push(this.add.tileSprite(0, y, W, 220, cloud).setOrigin(0).setTileScale(s, s).setAlpha(a).setDepth(y > 500 ? 50 : 0));
    const shipKey = this.tex('sky:ship', 260, 190, (g) => {
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 5;
      const gr = g.createLinearGradient(0, 0, 0, 110); gr.addColorStop(0, '#ffb07a'); gr.addColorStop(1, '#e05a3a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(130, 60, 116, 52, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffe6a0'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(60 + i * 50, 66, 9, 40, 0, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.moveTo(80, 108); g.lineTo(90, 140); g.moveTo(180, 108); g.lineTo(170, 140); g.stroke();
      g.fillStyle = '#9a5a2a'; g.beginPath(); g.moveTo(50, 138); g.lineTo(210, 138); g.lineTo(190, 180); g.lineTo(70, 180); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(130, 158, 12, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    this.ship = this.add.image(220, 330, shipKey).setDepth(20).setScale(0.75);
    this.tex('sky:star', 34, 34, (g) => {
      g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 7 : 16; g.lineTo(17 + Math.cos(a) * r, 17 + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#fff6a0'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2a1a0a'; g.stroke();
    });
    this.tex('sky:feather', 40, 18, (g) => { g.fillStyle = '#9ad0ff'; g.beginPath(); g.ellipse(20, 9, 18, 7, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#2a4a8a'; g.lineWidth = 3; g.stroke(); });
    ensureEnemySheet(this, 'gale_bird');
    this.hearts = this.add.text(24, 20, '', { fontFamily: FONT, fontSize: '30px', color: '#ff4a6a', stroke: '#2a1a0a', strokeThickness: 6 }).setDepth(100);
    this.info = this.add.text(W / 2, 24, '', { fontFamily: FONT, fontSize: '26px', color: '#fffdf6', stroke: '#2a1a0a', strokeThickness: 6 }).setOrigin(0.5, 0).setDepth(100);
    this.refreshHud();
    this.cameras.main.fadeIn(400);
    cinema.off();
    input.unblock('cinema');
    audio.playMusic('boss');
    void cinema.caption(input.lastDevice === 'touch' ? '用左手搖桿上下移動飛行器，星星會自動發射！' : 'W/S 或方向鍵上下移動，星星會自動發射！', 3200);
  }

  private refreshHud(): void {
    this.hearts.setText('♥'.repeat(Math.max(0, this.hp)) + '♡'.repeat(Math.max(0, 5 - this.hp)));
    this.info.setText(this.blimp ? `打倒灰灰飛艇！` : `擊退疾風鳥 ${Math.min(this.kills, this.need)} / ${this.need}`);
  }

  private spawnBird(): void {
    const key = ensureEnemySheet(this, 'gale_bird');
    const y = 90 + Math.random() * (GAME_H - 220);
    const s = this.add.sprite(this.scale.width + 60, y, key, 'idle0').setScale(0.7).setFlipX(true).setDepth(15);
    s.play(`${key}#idle`);
    this.birds.push({ s, hp: 2, vy: (Math.random() - 0.5) * 120, t: Math.random() * 6, shootT: 1 + Math.random() * 2 });
  }

  private spawnBlimp(): void {
    const key = this.tex('sky:blimp', 360, 220, (g) => {
      g.strokeStyle = '#2a1a0a'; g.lineWidth = 6;
      g.fillStyle = '#8a8a98'; g.beginPath(); g.ellipse(180, 80, 170, 70, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#5a5a6a'; g.beginPath(); g.moveTo(330, 80); g.lineTo(360, 30); g.lineTo(360, 130); g.closePath(); g.fill(); g.stroke();
      g.font = 'bold 44px sans-serif'; g.fillStyle = '#fffdf6'; g.textAlign = 'center'; g.fillText('灰灰號', 180, 96);
      g.fillStyle = '#6a6a7a'; g.fillRect(120, 150, 120, 50); g.strokeRect(120, 150, 120, 50);
      g.fillStyle = '#c4c4cc'; g.beginPath(); g.arc(155, 150, 18, Math.PI, 0); g.fill(); g.stroke();
      g.fillStyle = '#a8a8b4'; g.beginPath(); g.arc(205, 148, 22, Math.PI, 0); g.fill(); g.stroke();
    });
    const img = this.add.image(0, 0, key).setFlipX(true);
    const c = this.add.container(this.scale.width + 220, 300, [img]).setDepth(14);
    const bar = this.add.graphics().setDepth(101);
    this.blimp = { o: c, hp: 24, max: 24, bar, shootT: 1.5 };
    this.tweens.add({ targets: c, x: this.scale.width - 230, duration: 1600, ease: 'Sine.out' });
    audio.sfx('warning');
    void cinema.caption('「哇哈哈！灰灰飛艇登場！別想去天空島！」', 2400);
    this.refreshHud();
  }

  private fire(): void {
    const o = this.add.image(this.ship.x + 80, this.ship.y + 10, 'sky:star').setDepth(18);
    this.shots.push({ o, vx: 760, vy: 0, enemy: false });
    audio.sfx('click', 1.6);
  }

  private enemyShot(x: number, y: number, aim = true): void {
    const o = this.add.image(x, y, 'sky:feather').setDepth(18);
    const ang = aim ? Math.atan2(this.ship.y - y, this.ship.x - x) : Math.PI;
    this.shots.push({ o, vx: Math.cos(ang) * 340, vy: Math.sin(ang) * 340, enemy: true });
    o.setRotation(ang);
  }

  private hurt(): void {
    if (this.invuln > 0) return;
    this.hp--;
    this.invuln = 1.2;
    audio.sfx('hurt');
    if (settings.current.screenShake) this.cameras.main.shake(200, 0.01);
    this.refreshHud();
    if (this.hp <= 0) this.finish(false);
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    audio.sfx(won ? 'levelup' : 'defeat');
    const W = this.scale.width;
    const msg = this.add.text(W / 2, GAME_H / 2, won ? '突破成功！' : '飛行器被擊中了……再試一次！', { fontFamily: FONT, fontSize: '54px', color: won ? '#ffe680' : '#ffffff', stroke: '#2a1a0a', strokeThickness: 10 }).setOrigin(0.5).setDepth(200).setScale(0.3);
    this.tweens.add({ targets: msg, scale: 1, duration: 400, ease: 'Back.out' });
    this.time.delayedCall(1800, () => {
      if (!won) { this.scene.restart(); return; }
      this.cameras.main.fadeOut(400);
      this.time.delayedCall(420, () => { const cb = this.onDone; this.onDone = null; cb?.(true); });
    });
  }

  update(_time: number, dms: number): void {
    const dt = Math.min(0.05, dms / 1000);
    if (this.over) return;
    this.t += dt;
    for (const [i, c] of this.clouds.entries()) c.tilePositionX += [40, 120, 300][i] * dt;
    // steering
    const ax = input.axis();
    this.ship.x = clamp(this.ship.x + ax.x * 260 * dt, 110, 520);
    this.ship.y = clamp(this.ship.y + ax.y * 380 * dt, 70, GAME_H - 80);
    this.ship.setAngle(ax.y * 6);
    if (this.invuln > 0) { this.invuln -= dt; this.ship.setAlpha(Math.floor(this.invuln * 12) % 2 ? 0.4 : 1); } else this.ship.setAlpha(1);
    this.fireT -= dt;
    if (this.fireT <= 0) { this.fireT = 0.26; this.fire(); }
    // waves
    if (!this.blimp) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.kills < this.need) { this.spawnT = Math.max(0.55, 1.4 - this.t * 0.02); this.spawnBird(); }
      if (this.kills >= this.need && !this.birds.length) this.spawnBlimp();
    }
    for (const b of this.birds) {
      b.t += dt;
      b.s.x -= (200 + Math.min(120, this.t * 3)) * dt;
      b.s.y = clamp(b.s.y + Math.sin(b.t * 3) * 90 * dt + b.vy * dt, 60, GAME_H - 60);
      b.shootT -= dt;
      if (b.shootT <= 0 && b.s.x < this.scale.width - 80) { b.shootT = 2.2 + Math.random() * 1.6; this.enemyShot(b.s.x - 30, b.s.y); }
      if (Math.abs(b.s.x - this.ship.x) < 70 && Math.abs(b.s.y - this.ship.y) < 50) { this.hurt(); b.hp = 0; }
    }
    if (this.blimp) {
      const bl = this.blimp;
      bl.o.y = 300 + Math.sin(this.t * 1.1) * 200;
      bl.shootT -= dt;
      if (bl.shootT <= 0) { bl.shootT = 1.1; for (const dy of [-60, 0, 60]) this.enemyShot(bl.o.x - 120, bl.o.y + dy, false); }
      bl.bar.clear().fillStyle(0x2a1a0a, 1).fillRect(this.scale.width / 2 - 162, 66, 324, 22).fillStyle(0xe8203a, 1).fillRect(this.scale.width / 2 - 160, 68, 320 * (bl.hp / bl.max), 18);
    }
    // shots
    for (const s of this.shots) {
      s.o.x += s.vx * dt;
      s.o.y += s.vy * dt;
      if (!s.enemy) s.o.rotation += 10 * dt;
      if (s.enemy) {
        if (Math.abs(s.o.x - this.ship.x) < 60 && Math.abs(s.o.y - this.ship.y) < 40) { this.hurt(); s.o.x = -999; }
      } else {
        for (const b of this.birds) if (b.hp > 0 && Math.abs(s.o.x - b.s.x) < 46 && Math.abs(s.o.y - b.s.y) < 42) { b.hp--; s.o.x = 99999; b.s.setTint(0xff8080); this.time.delayedCall(80, () => b.s.clearTint()); }
        if (this.blimp && Math.abs(s.o.x - this.blimp.o.x) < 160 && Math.abs(s.o.y - this.blimp.o.y) < 70) {
          this.blimp.hp--; s.o.x = 99999; audio.sfx('hit', 1.3);
          if (this.blimp.hp <= 0) {
            const bl = this.blimp;
            this.tweens.add({ targets: bl.o, y: GAME_H + 200, angle: -25, duration: 1400, ease: 'Quad.in' });
            void cinema.caption('「哇啊啊——！記住你們了——！」', 2000);
            this.finish(true);
          }
        }
      }
    }
    for (const s of this.shots.filter((x) => x.o.x < -60 || x.o.x > this.scale.width + 60 || x.o.y < -60 || x.o.y > GAME_H + 60)) s.o.destroy();
    this.shots = this.shots.filter((x) => x.o.active);
    for (const b of this.birds.filter((x) => x.hp <= 0 || x.s.x < -80)) {
      if (b.hp <= 0) { this.kills++; audio.sfx('enemyDie'); const p = this.add.particles(b.s.x, b.s.y, 'p_paper', { speed: { min: 60, max: 220 }, lifespan: 500, emitting: false, tint: 0x9ad0ff }).setDepth(30); p.explode(12); this.time.delayedCall(700, () => p.destroy()); }
      b.s.destroy();
    }
    const before = this.birds.length;
    this.birds = this.birds.filter((x) => x.s.active);
    if (before !== this.birds.length) this.refreshHud();
    input.endFrame();
  }
}
