/**
 * 蛋機翻轉 — the signature mechanic. Mametchi's egg device flips the whole world into its tiny
 * black-and-white LCD ("the pixel world") and back. Some platforms, walls, chests and zones only
 * exist in one of the two worlds; in the pixel world machines stop and monsters turn into harmless
 * dots, but the egg's battery drains, and an empty battery throws you back into the paper world.
 */
import Phaser from 'phaser';
import { G } from '../core/game';
import { audio } from '../systems/audio';
import { h, toast } from '../ui/dom';

export type WorldKind = 'paper' | 'pixel';

/** Luminance → greenish LCD palette (dark #2b3a2a … light #b8c4a0). Offsets are 0-255. */
const LCD: number[] = [
  0.3 * 0.553, 0.59 * 0.553, 0.11 * 0.553, 0, 43,
  0.3 * 0.541, 0.59 * 0.541, 0.11 * 0.541, 0, 58,
  0.3 * 0.463, 0.59 * 0.463, 0.11 * 0.463, 0, 42,
  0, 0, 0, 1, 0,
];

export class EggWorld {
  on = false;
  battery = 1;
  private lcd: Phaser.FX.ColorMatrix | null = null;
  private pix: Phaser.FX.Pixelate | null = null;
  private frame: HTMLElement;
  private meter: HTMLElement;
  private chip: HTMLElement;
  private cool = 0;
  private warned = false;
  /** called after every flip so the world can re-check what is solid */
  onFlip: ((on: boolean) => void) | null = null;

  constructor(private scene: Phaser.Scene, private drainPerSec = 0.085) {
    this.meter = h('i', {});
    this.chip = h('div', { class: 'egg-chip', title: '蛋機（V）' }, h('span', { class: 'egg-ico' }), h('div', { class: 'egg-bat' }, this.meter));
    this.chip.addEventListener('click', () => this.toggle());
    this.frame = h('div', { class: 'egg-frame' },
      h('div', { class: 'egg-lcd' }),
      h('div', { class: 'egg-shell' }));
    document.querySelector('#fx-overlay')?.append(this.frame);
    (document.querySelector('#ui .hud') ?? document.querySelector('#ui'))?.append(this.chip);
    this.refreshChip();
  }

  get unlocked(): boolean { return G.cond('has_egg'); }

  /** Does something tagged with `world` exist right now? (untagged things exist in both) */
  has(world?: WorldKind): boolean {
    return !world || (world === 'pixel') === this.on;
  }

  toggle(): void {
    if (this.cool > 0) return;
    if (!this.unlocked) return;
    if (!this.on && this.battery < 0.2) {
      toast('蛋機電量不足！在紙片世界待一下就會充電。', 'warn', 1600);
      audio.sfx('error');
      return;
    }
    this.set(!this.on);
  }

  set(on: boolean, quiet = false): void {
    if (on === this.on) return;
    this.on = on;
    this.cool = 0.35;
    const cam = this.scene.cameras.main;
    if (this.scene.renderer.type === Phaser.WEBGL) {
      if (on) {
        this.pix = cam.postFX.addPixelate(3);
        this.lcd = cam.postFX.addColorMatrix();
        this.lcd.set(LCD);
      } else {
        if (this.pix) cam.postFX.remove(this.pix);
        if (this.lcd) cam.postFX.remove(this.lcd as unknown as Phaser.FX.Controller);
        this.pix = this.lcd = null;
      }
    }
    document.body.classList.toggle('egg-on', on);
    this.frame.classList.remove('flip');
    void this.frame.offsetWidth;
    this.frame.classList.add('flip');
    if (!quiet) {
      audio.sfx(on ? 'egg_on' : 'egg_off');
      cam.flash(160, on ? 184 : 255, on ? 196 : 255, on ? 160 : 255);
      if (navigator.vibrate) navigator.vibrate(on ? [10, 40, 10] : 12);
    }
    this.onFlip?.(on);
    this.refreshChip();
  }

  update(dt: number): void {
    if (this.cool > 0) this.cool -= dt;
    if (this.on) {
      this.battery = Math.max(0, this.battery - dt * this.drainPerSec);
      if (this.battery < 0.25 && !this.warned) { this.warned = true; audio.sfx('warning'); }
      if (this.battery <= 0) {
        toast('蛋機沒電了！被彈回紙片世界……', 'warn', 1600);
        this.set(false);
      }
    } else {
      this.battery = Math.min(1, this.battery + dt * 0.2);
      if (this.battery > 0.4) this.warned = false;
    }
    this.refreshChip();
  }

  private lastPct = -1;
  private refreshChip(): void {
    const has = this.unlocked;
    this.chip.style.display = has ? '' : 'none';
    document.body.classList.toggle('has-egg', has);
    const pct = Math.round(this.battery * 20) * 5;
    if (pct !== this.lastPct) {
      this.lastPct = pct;
      this.meter.style.width = pct + '%';
      this.chip.classList.toggle('low', this.battery < 0.25);
    }
    this.chip.classList.toggle('on', this.on);
  }

  destroy(): void {
    if (this.on) this.set(false, true);
    document.body.classList.remove('egg-on', 'has-egg');
    this.frame.remove();
    this.chip.remove();
  }
}
