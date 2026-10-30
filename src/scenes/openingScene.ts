/**
 * Opening movie (new game): the Star Heart glows over the village, the sky cracks, a crowned shadow
 * appears, the heart shatters into eight shards, the world loses its colour — and Mametchi's star
 * sensor starts to beep. Fully animated with Phaser tweens + cinema captions; skippable.
 */
import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, GROUND_TOP } from '../core/config';
import { ensureObject, ensureProp, ensureTheme } from '../art/textures';
import { renderFrame, basePose } from '../art/characterArt';
import { canvas } from '../art/paperArt';
import { CHAR_IDS } from '../data/characters';
import { ch1 } from '../data/chapters/ch1';
import { Actor } from '../world/actor';
import { audio } from '../systems/audio';
import { cinema } from '../ui/cinema';

export class OpeningScene extends Phaser.Scene {
  onDone: (() => void) | null = null;
  private skipped = false;
  private finished = false;
  private actors: Actor[] = [];

  constructor() {
    super('Opening');
  }

  private heartTexture(): string {
    const key = 'opening:heart';
    if (this.textures.exists(key)) return key;
    const [c, g] = canvas(260, 240);
    const heart = (s: number, fill: string | CanvasGradient) => {
      g.save();
      g.translate(130, 128);
      g.scale(s, s);
      g.beginPath();
      g.moveTo(0, 70);
      g.bezierCurveTo(-120, -10, -80, -110, 0, -50);
      g.bezierCurveTo(80, -110, 120, -10, 0, 70);
      g.fillStyle = fill;
      g.fill();
      g.restore();
    };
    heart(1.08, '#fffdf6');
    const gr = g.createRadialGradient(110, 90, 10, 130, 120, 130);
    gr.addColorStop(0, '#fffbe0');
    gr.addColorStop(0.45, '#ffb0d8');
    gr.addColorStop(1, '#ff6aa0');
    heart(1, gr);
    g.fillStyle = '#fff6a0';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 14 : 34;
      g.lineTo(130 + Math.cos(a) * r, 108 + Math.sin(a) * r);
    }
    g.fill();
    this.textures.addCanvas(key, c);
    return key;
  }

  private shadowTexture(): string {
    const key = 'opening:shadow';
    if (this.textures.exists(key)) return key;
    const f = renderFrame({ npc: { color: '#ffffc0', accent: '#4000c0', ears: 'horn', hat: 'crown', size: 1.1 } }, basePose({ facing: 'front', expr: 'angry' }), 'opening-shadow');
    this.textures.addCanvas(key, f);
    return key;
  }

  create(): void {
    this.skipped = false;
    this.finished = false;
    this.actors = [];
    const w = this.scale.width;
    const off = (w - GAME_W) / 2;
    this.cameras.main.setScroll(-off, 0);
    const t = ch1.theme;
    ensureTheme(this, t);
    this.add.image(-off, 0, `sky:${t.id}`).setOrigin(0).setDisplaySize(w, GAME_H);
    this.add.tileSprite(-off, 150, w, 360, `far:${t.id}`).setOrigin(0);
    this.add.tileSprite(-off, GROUND_TOP - 280, w, 300, `mid:${t.id}`).setOrigin(0);
    this.add.tileSprite(-off, GROUND_TOP - 4, w, 300, `ground:${t.id}`).setOrigin(0);
    this.add.tileSprite(-off, GROUND_TOP - 28, w, 40, `gedge:${t.id}`).setOrigin(0);
    for (const [k, x, s] of [['house', 150, 0.85], ['house_b', 1120, 0.8], ['tree_round', 380, 0.8], ['tree_pine', 930, 0.8]] as [string, number, number][]) {
      this.add.image(x, GROUND_TOP + 30, ensureProp(this, k)).setOrigin(0.5, 1).setScale(s).setDepth(GROUND_TOP);
    }
    // twinkling stars
    for (let i = 0; i < 40; i++) {
      const st = this.add.image(-off + Math.random() * w, 20 + Math.random() * 300, 'p_star').setScale(0.3 + Math.random() * 0.5).setAlpha(0.6);
      this.tweens.add({ targets: st, alpha: 0.1, yoyo: true, repeat: -1, duration: 600 + Math.random() * 1400, delay: Math.random() * 1000 });
    }
    CHAR_IDS.forEach((id, i) => {
      const a = new Actor(this, { charId: id }, 230 + i * 115, 150 + (i % 2) * 40, 0.85);
      a.face(0, 1);
      this.actors.push(a);
    });
    this.add.image(-off, 0, 'vignette').setOrigin(0).setDisplaySize(w, GAME_H).setAlpha(0.6).setDepth(8000);

    cinema.on();
    const prevSkip = cinema.onSkip;
    cinema.onSkip = () => { this.skipped = true; cinema.clearCaption(); };
    this.events.once('shutdown', () => { cinema.onSkip = prevSkip; });
    this.cameras.main.fadeIn(800);
    void this.play().then(() => this.finish());
  }

  update(): void {
    for (const a of this.actors) a.sync();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    cinema.off();
    this.cameras.main.fadeOut(400);
    this.time.delayedCall(420, () => this.onDone?.());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => {
      if (this.skipped) return r();
      const ev = this.time.delayedCall(ms, () => r());
      const iv = window.setInterval(() => { if (this.skipped) { ev.remove(); window.clearInterval(iv); r(); } }, 60);
      this.time.delayedCall(ms + 10, () => window.clearInterval(iv));
    });
  }

  private async say(text: string, ms: number): Promise<void> {
    if (this.skipped) return;
    await Promise.race([cinema.caption(text, ms), new Promise<void>((r) => { const iv = window.setInterval(() => { if (this.skipped) { window.clearInterval(iv); r(); } }, 60); window.setTimeout(() => window.clearInterval(iv), ms + 400); })]);
  }

  private hop(a: Actor, h = 80): void {
    const o = { y: 0 };
    a.spin();
    this.tweens.add({ targets: o, y: h, yoyo: true, duration: 280, ease: 'Quad.out', onUpdate: () => { a.y = o.y; } , onComplete: () => { a.y = 0; } });
  }

  private emote(a: Actor, text: string): void {
    const y = a.sprite.y - 120 * a.scaleNow();
    const b = this.add.image(a.x + 26, y, 'emote_bubble').setDepth(9000).setScale(0.1);
    const t = this.add.text(a.x + 26, y - 4, text, { fontFamily: FONT, fontSize: '28px', color: '#e8203a' }).setOrigin(0.5).setDepth(9001).setScale(0.1);
    this.tweens.add({ targets: [b, t], scale: 0.85, duration: 200, ease: 'Back.out' });
    this.time.delayedCall(1500, () => { b.destroy(); t.destroy(); });
  }

  private async play(): Promise<void> {
    const w = this.scale.width;
    const off = (w - GAME_W) / 2;
    audio.playMusic('ending');

    // 1. the Star Heart over a happy village
    const glow = this.add.image(640, 190, 'p_warm').setScale(0).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
    const heart = this.add.image(640, 190, this.heartTexture()).setScale(0).setDepth(51);
    this.tweens.add({ targets: heart, scale: 0.9, duration: 1400, ease: 'Back.out' });
    this.tweens.add({ targets: glow, scale: 5, duration: 1600, ease: 'Sine.out' });
    const pulse = this.tweens.add({ targets: [heart], y: 176, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
    await this.say('在拓麻歌子星球的夜空中，有一顆閃閃發光的「星之心」。', 3400);
    for (const [i, a] of this.actors.entries()) this.time.delayedCall(i * 120, () => this.hop(a, 70));
    audio.sfx('join');
    await this.say('它守護著大家的記憶、夢想，還有每一份心情。', 3200);
    if (this.skipped) return;

    // 2. the sky cracks and a crowned shadow appears
    audio.playMusic('dark');
    const dark = this.add.rectangle(-off, 0, w, GAME_H, 0x140a24, 0).setOrigin(0).setDepth(40);
    this.tweens.add({ targets: dark, fillAlpha: 0.5, duration: 1200 });
    const crack = this.add.graphics().setDepth(45);
    const pts: [number, number][] = [[420, 20]];
    for (let i = 1; i <= 9; i++) pts.push([420 + i * 24 + (i % 2 ? 18 : -14), 20 + i * 18]);
    for (let i = 1; i < pts.length; i++) {
      this.time.delayedCall(i * 110, () => {
        crack.lineStyle(9, 0xffffff, 0.9).lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        crack.lineStyle(4, 0xc040ff, 1).lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      });
    }
    this.time.delayedCall(400, () => { this.cameras.main.shake(900, 0.01); audio.sfx('shake'); });
    const shadow = this.add.image(900, 230, this.shadowTexture()).setTint(0x1a0a2a).setAlpha(0).setScale(1.5).setDepth(46);
    this.tweens.add({ targets: shadow, alpha: 0.9, y: 200, duration: 1600, delay: 900 });
    for (const a of this.actors) this.time.delayedCall(Math.random() * 500, () => this.emote(a, '!'));
    await this.say('某天夜裡，天空突然裂開了——一個戴著王冠的影子出現在星之心旁邊。', 3600);
    if (this.skipped) return;

    // 3. the heart shatters into eight shards
    pulse.stop();
    this.tweens.add({ targets: heart, scale: 1.1, angle: 8, yoyo: true, repeat: 3, duration: 80 });
    await this.wait(400);
    this.cameras.main.flash(500, 255, 255, 255);
    this.cameras.main.shake(700, 0.02);
    audio.sfx('break');
    audio.sfx('shard');
    heart.setVisible(false);
    this.tweens.add({ targets: glow, scale: 0, duration: 600 });
    this.tweens.add({ targets: shadow, alpha: 0, duration: 900 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const s = this.add.image(640, 190, ensureObject(this, 'shard')).setScale(0.55).setDepth(60);
      const trail = this.add.particles(0, 0, 'p_star', { follow: s, lifespan: 500, scale: { start: 0.7, end: 0 }, frequency: 30, alpha: { start: 0.9, end: 0 } }).setDepth(59);
      this.tweens.add({
        targets: s, x: 640 + Math.cos(ang) * 1100, y: 190 + Math.sin(ang) * 700 - 100, angle: 720, duration: 1700, ease: 'Quad.in', delay: i * 60,
        onComplete: () => { trail.stop(); s.destroy(); this.time.delayedCall(600, () => trail.destroy()); },
      });
    }
    await this.say('星之心碎成了八塊，往世界的各個角落飛散！', 3200);
    if (this.skipped) return;

    // 4. the world loses its colour
    const grey = this.add.rectangle(-off, 0, w, GAME_H, 0x8a8a8a, 0).setOrigin(0).setDepth(70).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tweens.add({ targets: grey, fillAlpha: 0.7, duration: 1800 });
    for (const a of this.actors) this.time.delayedCall(Math.random() * 600, () => this.emote(a, '?'));
    await this.say('天空失去了顏色，大家也漸漸忘記了重要的事……', 3400);
    if (this.skipped) return;

    // 5. Mametchi's sensor reacts
    this.cameras.main.fadeOut(500);
    await this.wait(550);
    for (const a of this.actors) a.visible = false;
    const mame = this.actors[CHAR_IDS.indexOf('mametchi')];
    mame.visible = true;
    mame.x = 640;
    mame.z = 140;
    mame.face(0, 1);
    this.tweens.add({ targets: grey, fillAlpha: 0.35, duration: 10 });
    this.cameras.main.fadeIn(500);
    await this.wait(700);
    const sensor = this.add.image(640, 360, 'p_star').setScale(0).setDepth(80);
    this.tweens.add({ targets: sensor, scale: 2.6, angle: 180, duration: 600, ease: 'Back.out' });
    this.tweens.add({ targets: sensor, alpha: 0.4, yoyo: true, repeat: -1, duration: 260, delay: 600 });
    audio.sfx('magic');
    this.time.delayedCall(500, () => { this.emote(mame, '!'); this.hop(mame, 100); audio.sfx('jump'); });
    await this.say('就在這時——麻美吉發明的「星之感應器」嗶嗶嗶地響了起來！', 3400);
    if (this.skipped) return;

    // 6. title card
    audio.playMusic('title');
    const title = this.add.text(640, 250, '拓麻歌子', { fontFamily: FONT, fontSize: '78px', color: '#ffffff', stroke: '#2a1a0a', strokeThickness: 12 }).setOrigin(0.5).setDepth(90).setScale(0);
    const sub = this.add.text(640, 340, '～ 失落的星之心 ～', { fontFamily: FONT, fontSize: '40px', color: '#ffd23a', stroke: '#2a1a0a', strokeThickness: 9 }).setOrigin(0.5).setDepth(90).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, angle: { from: -6, to: 0 }, duration: 700, ease: 'Back.out' });
    this.tweens.add({ targets: sub, alpha: 1, y: 330, duration: 700, delay: 500 });
    this.hop(mame, 120);
    await this.wait(2600);
  }
}
