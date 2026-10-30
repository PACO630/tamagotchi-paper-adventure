/** Generates all shared textures (with a progress bar) before the title appears. */
import Phaser from 'phaser';
import { buildCommonTextures, ensureSheet, prewarmPortraits } from '../art/textures';
import { CHAR_IDS } from '../data/characters';

export class BootScene extends Phaser.Scene {
  onDone: (() => void) | null = null;

  constructor() {
    super('Boot');
  }

  create(): void {
    const fill = document.getElementById('boot-fill');
    const msg = document.getElementById('boot-msg');
    const steps: [string, () => void][] = [
      ['剪下紙片…', () => buildCommonTextures(this)],
      ...CHAR_IDS.map((id) => [`用滑鼠畫角色（${id}）…`, () => ensureSheet(this, { charId: id })] as [string, () => void]),
      ['畫大頭貼…', () => prewarmPortraits()],
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) { this.onDone?.(); return; }
      const [label, fn] = steps[i];
      if (msg) msg.textContent = label;
      fn();
      i++;
      if (fill) fill.style.width = `${Math.round((i / steps.length) * 100)}%`;
      setTimeout(next, 0);
    };
    next();
  }
}
