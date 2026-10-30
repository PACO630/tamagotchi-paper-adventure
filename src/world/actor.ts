/** A paper-doll character in the 2.5D field: x/z ground position, y jump height, paper flip turning. */
import Phaser from 'phaser';
import { DEPTH, GROUND_TOP, Z_TO_Y, FONT } from '../core/config';
import type { DrawTarget } from '../art/characterArt';
import { ensureSheet } from '../art/textures';

export type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'attack' | 'hurt' | 'win' | 'lose' | 'talk';

export function zToY(z: number): number {
  return GROUND_TOP + z * Z_TO_Y;
}

export function depthScale(z: number): number {
  return 0.82 + 0.26 * (z / DEPTH);
}

export class Actor {
  x: number;
  z: number;
  y = 0;
  vy = 0;
  facingX: 1 | -1 = 1;
  view: 'side' | 'front' | 'back' = 'front';
  state: AnimState = 'idle';
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text | null = null;
  sheet: string;
  private flipping = false;
  private baseScale: number;
  locked = false;
  visible = true;
  reflection: Phaser.GameObjects.Sprite | null = null;

  constructor(public scene: Phaser.Scene, target: DrawTarget, x: number, z: number, scale = 0.86, full = true) {
    this.sheet = ensureSheet(scene, target, full);
    this.x = x;
    this.z = z;
    this.baseScale = scale;
    this.shadow = scene.add.image(x, zToY(z), 'shadow').setScale(0.75, 0.9);
    this.sprite = scene.add.sprite(x, zToY(z), this.sheet, 'front_idle0').setOrigin(0.5, 0.96);
    this.play('idle');
    this.sync();
  }

  setLabel(text: string, color = '#ffffff'): void {
    this.label?.destroy();
    this.label = this.scene.add.text(this.x, 0, text, { fontFamily: FONT, fontSize: '18px', color, stroke: '#2a1a0a', strokeThickness: 5 }).setOrigin(0.5, 1);
  }

  enableReflection(): void {
    if (this.reflection) return;
    this.reflection = this.scene.add.sprite(this.x, 0, this.sheet).setOrigin(0.5, 0.04).setAlpha(0.28).setFlipY(true).setVisible(false);
  }

  private animKey(state: AnimState): string {
    const v = this.view;
    switch (state) {
      case 'idle': return `${this.sheet}#${v}_idle`;
      case 'walk': return `${this.sheet}#${v}_walk`;
      case 'run': return `${this.sheet}#${v === 'side' ? 'side_run' : v + '_walk'}`;
      case 'jump': return `${this.sheet}#side_jump`;
      case 'fall': return `${this.sheet}#side_fall`;
      case 'attack': return `${this.sheet}#side_attack`;
      case 'hurt': return `${this.sheet}#side_hurt`;
      case 'win': return `${this.sheet}#win`;
      case 'lose': return `${this.sheet}#lose`;
      case 'talk': return `${this.sheet}#talk`;
    }
  }

  play(state: AnimState, force = false): void {
    let key = this.animKey(state);
    if (!this.scene.anims.exists(key)) key = `${this.sheet}#${this.view}_idle`;
    if (!this.scene.anims.exists(key)) key = `${this.sheet}#front_idle`;
    if (!force && this.state === state && this.sprite.anims.currentAnim?.key === key) return;
    this.state = state;
    this.sprite.play(key, true);
  }

  /** Turn with a Paper-style flip (scaleX squeeze) when changing horizontal direction. */
  face(dx: number, dz: number): void {
    let newView: 'side' | 'front' | 'back' = this.view;
    if (Math.abs(dx) > 0.15) newView = 'side';
    else if (dz > 0.3) newView = 'front';
    else if (dz < -0.3) newView = 'back';
    const newFacing: 1 | -1 = dx > 0.15 ? 1 : dx < -0.15 ? -1 : this.facingX;
    if (newFacing !== this.facingX && !this.flipping) {
      this.flipping = true;
      this.scene.tweens.add({
        targets: this.sprite, scaleX: 0.05, duration: 70, ease: 'Sine.in',
        onComplete: () => {
          this.facingX = newFacing;
          this.sprite.setFlipX(newFacing < 0);
          this.scene.tweens.add({ targets: this.sprite, scaleX: this.scaleNow(), duration: 70, ease: 'Sine.out', onComplete: () => { this.flipping = false; } });
        },
      });
    }
    if (newView !== this.view) {
      this.view = newView;
      this.play(this.state, true);
    }
  }

  /** A full paper spin (used for jumps and celebrations). */
  spin(): void {
    if (this.flipping) return;
    this.flipping = true;
    const s = this.scaleNow();
    this.scene.tweens.add({ targets: this.sprite, scaleX: -s, duration: 140, yoyo: true, ease: 'Sine.inOut', onComplete: () => { this.sprite.scaleX = s; this.flipping = false; } });
  }

  scaleNow(): number {
    return this.baseScale * depthScale(this.z);
  }

  sync(): void {
    const s = this.scaleNow();
    const gy = zToY(this.z);
    this.sprite.setPosition(this.x, gy - this.y);
    if (!this.flipping) this.sprite.setScale(s);
    else this.sprite.scaleY = s;
    this.sprite.setDepth(gy + 0.5);
    const sh = Math.max(0.35, 1 - this.y / 260);
    this.shadow.setPosition(this.x, gy).setScale(0.72 * s * sh, 0.85 * s * sh).setAlpha(0.9 * sh).setDepth(gy - 0.5);
    if (this.label) this.label.setPosition(this.x, gy - this.y - 112 * s).setDepth(9000);
    this.sprite.setVisible(this.visible);
    this.shadow.setVisible(this.visible);
    this.label?.setVisible(this.visible);
    if (this.reflection) {
      this.reflection.setVisible(false);
    }
  }

  showReflection(waterY: number): void {
    if (!this.reflection) return;
    this.reflection.setVisible(this.visible).setTexture(this.sprite.texture.key, this.sprite.frame.name).setFlipX(this.sprite.flipX)
      .setPosition(this.x, waterY + this.y * 0.6).setScale(this.sprite.scaleX, this.sprite.scaleY).setDepth(this.sprite.depth - 1);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.label?.destroy();
    this.reflection?.destroy();
  }
}
