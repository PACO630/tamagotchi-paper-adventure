/** Animated paper-diorama backdrop behind the main menu: everyone parading through the village. */
import Phaser from 'phaser';
import { GAME_H, GAME_W, GROUND_TOP } from '../core/config';
import { ensureProp, ensureTheme } from '../art/textures';
import { CHAR_IDS } from '../data/characters';
import { ch1 } from '../data/chapters/ch1';
import { Actor } from '../world/actor';

export class TitleScene extends Phaser.Scene {
  private actors: { a: Actor; v: number; jumpT: number }[] = [];
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Title');
  }

  create(): void {
    const t = { ...ch1.theme, skyTop: 0x7ab8ff, skyBottom: 0xffe6c0, sun: 'sun' as const, id: 'title' };
    ensureTheme(this, t);
    this.add.image(0, 0, `sky:${t.id}`).setOrigin(0).setDisplaySize(GAME_W, GAME_H);
    this.far = this.add.tileSprite(0, 150, GAME_W, 360, `far:${t.id}`).setOrigin(0);
    this.mid = this.add.tileSprite(0, GROUND_TOP - 280, GAME_W, 300, `mid:${t.id}`).setOrigin(0);
    this.ground = this.add.tileSprite(0, GROUND_TOP - 4, GAME_W, 300, `ground:${t.id}`).setOrigin(0);
    this.add.tileSprite(0, GROUND_TOP - 28, GAME_W, 40, `gedge:${t.id}`).setOrigin(0);
    for (const [k, x, s] of [['house', 140, 0.8], ['tree_round', 1120, 0.9], ['flower', 300, 1], ['flower_y', 980, 1]] as [string, number, number][]) {
      this.add.image(x, GROUND_TOP + 30, ensureProp(this, k)).setOrigin(0.5, 1).setScale(s).setDepth(GROUND_TOP);
    }
    for (let i = 0; i < 6; i++) {
      const c = this.add.image(Math.random() * GAME_W, 50 + Math.random() * 150, 'p_cloud').setAlpha(0.85).setScale(0.8 + Math.random() * 0.8);
      this.tweens.add({ targets: c, x: c.x + 200, yoyo: true, repeat: -1, duration: 20000 + Math.random() * 10000 });
    }
    CHAR_IDS.forEach((id, i) => {
      const a = new Actor(this, { charId: id }, 120 + i * 140, 90 + (i % 3) * 50, 0.9);
      this.actors.push({ a, v: (i % 2 ? -1 : 1) * (40 + Math.random() * 40), jumpT: Math.random() * 3 });
    });
    this.add.particles(0, 0, 'p_petal', { x: { min: 0, max: GAME_W }, y: -10, speedY: { min: 30, max: 60 }, speedX: { min: -30, max: 10 }, rotate: { min: 0, max: 360 }, lifespan: 12000, frequency: 400 });
    this.add.image(GAME_W / 2, GAME_H / 2, 'vignette').setAlpha(0.5).setDepth(5000);
    this.cameras.main.fadeIn(600);
  }

  update(_t: number, dms: number): void {
    const dt = dms / 1000;
    this.far.tilePositionX += dt * 6;
    this.mid.tilePositionX += dt * 14;
    for (const o of this.actors) {
      const a = o.a;
      a.x += o.v * dt;
      if (a.x < 60 || a.x > GAME_W - 60) o.v = -o.v;
      a.face(Math.sign(o.v), 0);
      o.jumpT -= dt;
      if (o.jumpT <= 0 && a.y <= 0) { a.vy = 420; o.jumpT = 2 + Math.random() * 4; a.spin(); }
      if (a.y > 0 || a.vy > 0) { a.vy -= 1300 * dt; a.y = Math.max(0, a.y + a.vy * dt); if (a.y === 0) a.vy = 0; }
      a.play(a.y > 0 ? 'jump' : 'walk');
      a.sync();
    }
  }
}
