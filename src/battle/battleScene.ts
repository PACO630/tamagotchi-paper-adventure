/** Phaser battle stage: paper diorama, fighters, effects and action-command minigames. */
import Phaser from 'phaser';
import { GAME_H, GAME_W, FONT } from '../core/config';
import { charSheetKey, ensureEnemySheet, ensureSheet, ensureTheme } from '../art/textures';
import { chapterByNum } from '../data/chapters';
import { CHAPTERS } from '../data/chapters';
import type { Expr, StatusType } from '../data/types';
import { buildLine } from '../systems/story';
import { h } from '../ui/dom';
import { input, type Btn } from '../input/input';
import { audio } from '../systems/audio';
import { settings } from '../systems/settings';
import { bus } from '../core/events';
import { ensureUiIconTexture, type UiIconName } from '../art/uiIcons';
import type { CommandSpec, Fighter, FxStep, GuardResult, Quality } from './battleTypes';

const STATUS_ICON: Partial<Record<StatusType, UiIconName>> = {
  poison: 'skull', burn: 'fire', sleep: 'zzz', dizzy: 'spiral', stuck: 'chain', atkUp: 'atkUp', atkDown: 'atkDown', defUp: 'defUp', defDown: 'defDown', regen: 'regen', shield: 'diamond', blind: 'blind', wet: 'drop', crumpled: 'crumple',
};
const STATUS_NAME: Partial<Record<StatusType, string>> = {
  poison: '中毒', burn: '燒傷', sleep: '睡著', dizzy: '頭暈', stuck: '纏住', atkUp: '攻擊上升', atkDown: '攻擊下降', defUp: '防禦上升', defDown: '防禦下降', regen: '回復', shield: '護盾', blind: '失明', wet: '濕透了', crumpled: '皺巴巴',
};

interface View {
  f: Fighter;
  c: Phaser.GameObjects.Container;
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  hpBar?: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Container;
  homeX: number;
  homeY: number;
  sheet: string;
  dead: boolean;
}

const PARTY_SLOTS = [[420, 540], [300, 600], [250, 490], [140, 570]];
const ENEMY_SLOTS = [[870, 545], [1010, 600], [1060, 480], [1170, 560], [940, 450]];

export class BattleScene extends Phaser.Scene {
  views = new Map<string, View>();
  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private cursor!: Phaser.GameObjects.Image;
  private darkOverlay!: Phaser.GameObjects.Rectangle;
  themeId = 'village';
  onReady: (() => void) | null = null;
  private playing: Promise<void> = Promise.resolve();

  constructor() {
    super('Battle');
  }

  init(data: { themeId: string; party: Fighter[]; enemies: Fighter[] }): void {
    this.themeId = data.themeId;
    this.views.clear();
    (this as any)._initData = data;
  }

  create(): void {
    const data = (this as any)._initData as { party: Fighter[]; enemies: Fighter[] };
    const theme = CHAPTERS.find((c) => c.theme.id === this.themeId)?.theme ?? chapterByNum(1).theme;
    ensureTheme(this, theme);
    // The stage is laid out in 1280-wide coordinates; on wider (phone) views the camera centres it
    // and the backdrop layers stretch to cover the extra width.
    this.stageFill = [this.add.image(0, 0, `sky:${theme.id}`).setOrigin(0)];
    this.stageTiles = [
      this.add.tileSprite(0, 130, GAME_W, 360, `far:${theme.id}`).setOrigin(0).setAlpha(0.95),
      this.add.tileSprite(0, 210, GAME_W, 300, `mid:${theme.id}`).setOrigin(0),
      // stage floor: paper ground with a front lip like a diorama box
      this.add.tileSprite(0, 430, GAME_W, 290, `ground:${theme.id}`).setOrigin(0),
      this.add.tileSprite(0, 416, GAME_W, 40, `gedge:${theme.id}`).setOrigin(0),
      this.add.tileSprite(0, 690, GAME_W, 50, `fedge:${theme.id}`).setOrigin(0),
    ];
    // stage curtains made of paper strips (original look: notebook-paper ribbons)
    this.curtain = this.add.graphics();
    this.stageFill.push(this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.6));
    this.stageFill.push(this.add.image(0, 0, 'rays').setOrigin(0).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD));
    this.darkOverlay = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x100018, 0).setOrigin(0).setDepth(900);
    this.stageFill.push(this.darkOverlay);
    this.layoutStage();
    this.scale.on('resize', this.layoutStage, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layoutStage, this));

    data.party.forEach((f, i) => this.addView(f, i));
    data.enemies.forEach((f, i) => this.addView(f, i));

    this.cursor = this.add.image(0, 0, 'p_star').setScale(2.2).setDepth(950).setVisible(false);
    this.tweens.add({ targets: this.cursor, y: '-=10', yoyo: true, repeat: -1, duration: 350 });

    const bg = this.add.graphics();
    bg.fillStyle(0xfffdf6, 0.96).fillRoundedRect(-300, -34, 600, 68, 16).lineStyle(4, 0x3a2a1a, 1).strokeRoundedRect(-300, -34, 600, 68, 16);
    this.bannerText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '28px', color: '#3a2a1a', align: 'center', wordWrap: { width: 570 } }).setOrigin(0.5);
    this.banner = this.add.container(GAME_W / 2, 92, [bg, this.bannerText]).setDepth(1000).setAlpha(0);

    // taps for action commands are read from the whole page (see listenForTaps), not only the canvas
    this.cameras.main.fadeIn(300);
    this.onReady?.();
  }

  private stageFill: (Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle)[] = [];
  private stageTiles: Phaser.GameObjects.TileSprite[] = [];
  private curtain!: Phaser.GameObjects.Graphics;

  /** Centre the 1280-wide stage in the current view and stretch the backdrop to its edges. */
  private layoutStage(): void {
    const w = this.scale.width;
    const off = (w - GAME_W) / 2;
    this.cameras.main.setScroll(-off, 0);
    for (const o of this.stageFill) o.setPosition(-off, 0).setDisplaySize(w, GAME_H);
    for (const t of this.stageTiles) t.setPosition(-off, t.y).setSize(w, t.height);
    const g = this.curtain.clear();
    g.fillStyle(0xfffdf6, 1).fillRect(-off, 0, w, 26);
    g.fillStyle(0xe85a6a, 1);
    for (let x = -off - 64; x < w - off; x += 64) g.fillTriangle(x, 26, x + 64, 26, x + 32, 52);
    g.fillStyle(0xffd23a, 1);
    for (let x = -off - 32; x < w - off; x += 64) g.fillCircle(x, 30, 5);
  }

  private slotFor(f: Fighter, idx: number): [number, number] {
    const list = f.side === 'party' ? PARTY_SLOTS : ENEMY_SLOTS;
    return list[Math.min(idx, list.length - 1)] as [number, number];
  }

  private addView(f: Fighter, idx: number, pop = false): View {
    const [x, y] = this.slotFor(f, idx);
    const isParty = f.side === 'party';
    const sheet = isParty ? ensureSheet(this, { charId: f.charId! }) : ensureEnemySheet(this, f.enemyId!);
    const scale = isParty ? 1.15 : 1.15 * f.scale;
    const flying = f.traits.includes('flying');
    const shadow = this.add.image(0, 0, 'shadow').setScale(0.8 * scale, 0.9);
    const spr = this.add.sprite(0, flying ? -60 : 0, sheet, isParty ? 'side_idle0' : 'idle0').setOrigin(0.5, 0.97).setScale(scale);
    if (isParty) spr.play(`${sheet}#side_idle`);
    else { spr.play(`${sheet}#idle`); spr.setFlipX(false); }
    const status = this.add.container(0, -FRAMEH(scale) - 12);
    const kids: Phaser.GameObjects.GameObject[] = [shadow, spr, status];
    let hpBar: Phaser.GameObjects.Graphics | undefined;
    if (!isParty) {
      hpBar = this.add.graphics();
      kids.push(hpBar);
    }
    const c = this.add.container(x, y, kids).setDepth(y);
    if (flying) this.tweens.add({ targets: spr, y: '-=12', yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    const v: View = { f, c, spr, shadow, hpBar, status, homeX: x, homeY: y, sheet, dead: f.hp <= 0 };
    this.views.set(f.id, v);
    this.drawHp(v);
    if (pop) {
      c.setScale(0.1);
      this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.out' });
    }
    if (v.dead && isParty) spr.play(`${sheet}#lose`);
    if (v.dead && !isParty) c.setVisible(false);
    return v;
  }

  private drawHp(v: View): void {
    if (!v.hpBar) return;
    const g = v.hpBar;
    const w = 90;
    const top = -FRAMEH(1.15 * v.f.scale) + (v.f.traits.includes('flying') ? -60 : 0) - 4;
    g.clear();
    g.fillStyle(0xfffdf6, 1).fillRoundedRect(-w / 2 - 4, top - 4, w + 8, 16, 6).lineStyle(2, 0x3a2a1a).strokeRoundedRect(-w / 2 - 4, top - 4, w + 8, 16, 6);
    const pct = Math.max(0, v.f.hp / v.f.maxHP);
    g.fillStyle(0xe0d6c4, 1).fillRect(-w / 2, top, w, 8);
    g.fillStyle(pct > 0.5 ? 0x4ac85a : pct > 0.2 ? 0xffc83a : 0xe84a4a, 1).fillRect(-w / 2, top, w * pct, 8);
    v.status.setY(top - 14);
  }

  private refreshStatus(v: View): void {
    const names = v.f.statuses.map((s) => STATUS_ICON[s.type]).filter(Boolean) as UiIconName[];
    if (v.f.counter) names.push('counter');
    if (v.f.shielded) names.push('diamond');
    if (v.f.charging) names.push('lightning');
    v.status.removeAll(true);
    const size = 24;
    names.forEach((n, i) => v.status.add(this.add.image((i - (names.length - 1) / 2) * size, 0, ensureUiIconTexture(this, n)).setDisplaySize(size, size)));
  }

  /** Apply a full snapshot (multiplayer sync and after every action). */
  applySnapshot(fighters: Fighter[]): void {
    for (const f of fighters) {
      let v = this.views.get(f.id);
      if (!v) {
        const idx = fighters.filter((x) => x.side === f.side).indexOf(f);
        v = this.addView(f, idx, true);
      }
      v.f = f;
      this.drawHp(v);
      this.refreshStatus(v);
      if (f.hp > 0 && v.dead) {
        v.dead = false;
        v.c.setVisible(true).setAlpha(1);
        if (f.side === 'party') v.spr.play(`${v.sheet}#side_idle`);
      }
    }
  }

  setDarkness(on: boolean): void {
    this.tweens.add({ targets: this.darkOverlay, fillAlpha: on ? 0.35 : 0, duration: 800 });
  }

  highlight(id: string | null): void {
    const v = id ? this.views.get(id) : null;
    if (!v) { this.cursor.setVisible(false); return; }
    const top = -FRAMEH(1.15 * v.f.scale) + (v.f.traits.includes('flying') ? -60 : 0);
    this.cursor.setVisible(true).setPosition(v.c.x, v.c.y + top - 30);
  }

  /* ======================= step playback ======================= */

  play(steps: FxStep[]): Promise<void> {
    this.playing = this.playing.then(() => this.playNow(steps)).catch((e) => console.error(e));
    return this.playing;
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }

  showText(text: string, ms = 900): Promise<void> {
    this.bannerText.setText(text);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1).setScale(0.9);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 150, ease: 'Back.out' });
    return this.delay(ms).then(() => { this.tweens.add({ targets: this.banner, alpha: 0, duration: 150 }); });
  }

  /** Speech bubble with a portrait during battle (auto-advances; a tap/confirm hurries it). */
  private async talk(who: string, text: string, face: Expr, ms: number): Promise<void> {
    const line = buildLine(who, text, face, null);
    const el = h('div', { class: `b-talk ${line.side}` }, line.portrait ? h('img', { src: line.portrait, alt: '' }) : null,
      h('div', { class: 'b-talk-body' }, h('b', {}, line.name), h('span', {}, line.text)));
    document.getElementById('fx-overlay')!.append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    audio.sfx('flip');
    await this.waitPress((b) => b === 'confirm' || b === 'attack' || b === 'jump', ms);
    el.classList.remove('in');
    await this.delay(180);
    el.remove();
  }

  private popText(x: number, y: number, text: string, color: string, size = 30): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#2a1a0a', strokeThickness: 6 }).setOrigin(0.5).setDepth(1200);
    this.tweens.add({ targets: t, y: y - 60, duration: 900, ease: 'Cubic.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
  }

  private headY(v: View): number {
    return v.c.y - FRAMEH(1.15 * v.f.scale) * 0.6 + (v.f.traits.includes('flying') ? -60 : 0);
  }

  private async playNow(steps: FxStep[]): Promise<void> {
    for (const s of steps) {
      const v = 'who' in s ? this.views.get(s.who) : 'dst' in s ? this.views.get(s.dst) : undefined;
      switch (s.t) {
        case 'text': await this.showText(s.text, s.ms ?? 900); break;
        case 'talk': await this.talk(s.who, s.text, (s.face ?? 'normal') as Expr, s.ms ?? 2200); break;
        case 'wait': await this.delay(s.ms); break;
        case 'sfx': audio.sfx(s.id); break;
        case 'shake': if (settings.current.screenShake) this.cameras.main.shake(260, 0.012); break;
        case 'anim': {
          if (!v) break;
          if (v.f.side === 'party') {
            const map: Record<string, string> = { attack: 'side_attack', jump: 'side_jump', cast: 'win', defend: 'front_idle', hurt: 'side_hurt' };
            v.spr.play(`${v.sheet}#${map[s.anim] ?? 'side_idle'}`);
            if (s.anim === 'attack') audio.sfx('swing');
            if (s.anim === 'cast') { audio.sfx('magic'); await this.delay(380); v.spr.play(`${v.sheet}#side_idle`); }
            if (s.anim === 'defend') { this.flashSprite(v, 0x80c0ff); await this.delay(300); v.spr.play(`${v.sheet}#side_idle`); }
            if (s.anim === 'attack') await this.delay(260);
          } else {
            v.spr.stop();
            v.spr.setFrame(s.anim === 'defend' ? 'idle1' : 'attack');
            await this.tween({ targets: v.spr, scaleX: v.spr.scaleX * 1.1, yoyo: true, duration: 120 });
            v.spr.play(`${v.sheet}#idle`);
          }
          break;
        }
        case 'approach': {
          const t = this.views.get(s.to);
          if (!v || !t) break;
          const dir = v.f.side === 'party' ? -1 : 1;
          const tx = t.c.x + dir * 110 * Math.max(1, t.f.scale * 0.8);
          if (s.jump) {
            audio.sfx('jump');
            v.spr.play(`${v.sheet}#side_jump`);
            await Promise.all([
              this.tween({ targets: v.c, x: tx + dir * -60, duration: 420, ease: 'Sine.inOut' }),
              this.tween({ targets: v.spr, y: -140 + (t.f.traits.includes('flying') ? -60 : 0), duration: 210, yoyo: true, ease: 'Sine.out' }),
            ]);
          } else {
            if (v.f.side === 'party') v.spr.play(`${v.sheet}#side_run`);
            await this.tween({ targets: v.c, x: tx, duration: 300, ease: 'Sine.inOut' });
          }
          v.c.setDepth(1000);
          break;
        }
        case 'return': {
          if (!v) break;
          if (v.f.side === 'party' && !v.dead) { v.spr.setFlipX(true); v.spr.play(`${v.sheet}#side_run`); }
          await this.tween({ targets: v.c, x: v.homeX, y: v.homeY, duration: 280, ease: 'Sine.inOut' });
          v.spr.y = v.f.traits.includes('flying') ? -60 : 0;
          v.c.setDepth(v.homeY);
          if (v.f.side === 'party' && !v.dead) { v.spr.setFlipX(false); v.spr.play(`${v.sheet}#side_idle`); }
          break;
        }
        case 'hit': {
          if (!v) break;
          v.f.hp = s.hp;
          const hx = v.c.x, hy = this.headY(v);
          if (s.dmg > 0) {
            const star = this.add.image(hx, hy, 'hitstar').setDepth(1150).setScale(0.3);
            this.tweens.add({ targets: star, scale: s.crit ? 1.3 : 1, angle: 40, duration: 160, ease: 'Back.out' });
            this.tweens.add({ targets: star, alpha: 0, delay: 380, duration: 200, onComplete: () => star.destroy() });
            const num = this.add.text(hx, hy, String(s.dmg), { fontFamily: FONT, fontSize: s.crit ? '40px' : '32px', color: '#e8203a', stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5).setDepth(1160);
            this.tweens.add({ targets: num, y: hy - 50, alpha: 0, delay: 350, duration: 600, onComplete: () => num.destroy() });
            this.flashSprite(v, 0xff6060);
            this.tweens.add({ targets: v.c, x: v.c.x + (v.f.side === 'enemy' ? 14 : -14), yoyo: true, duration: 60, repeat: 1 });
            if (v.f.side === 'party') v.spr.play(`${v.sheet}#side_hurt`);
            else { v.spr.stop(); v.spr.setFrame('hurt'); }
            if (s.crit && settings.current.screenShake) this.cameras.main.shake(160, 0.008);
          } else {
            this.popText(hx, hy, '0', '#4a8aff');
          }
          if (s.label) this.popText(hx, hy - 50, s.label, s.guard === 'perfect' ? '#ffd23a' : s.crit ? '#ff8a2a' : '#ffffff', s.guard === 'perfect' ? 36 : 28);
          this.drawHp(v);
          await this.delay(420);
          if (!v.dead && v.f.hp > 0) {
            if (v.f.side === 'party') v.spr.play(`${v.sheet}#side_idle`);
            else v.spr.play(`${v.sheet}#idle`);
          }
          break;
        }
        case 'miss': {
          if (!v) break;
          audio.sfx('miss');
          this.popText(v.c.x, this.headY(v), s.text ?? 'Miss', '#c8c8ff', 24);
          await this.delay(450);
          break;
        }
        case 'heal': {
          if (!v) break;
          v.f.hp = s.hpNow;
          v.f.sp = s.spNow;
          if (s.hp) this.popText(v.c.x, this.headY(v), `+${s.hp}`, '#4ae06a');
          if (s.sp) this.popText(v.c.x + 30, this.headY(v) + 20, `SP+${s.sp}`, '#4ab0ff', 24);
          this.sparkle(v.c.x, this.headY(v), 0x8affa0);
          this.drawHp(v);
          await this.delay(380);
          break;
        }
        case 'status': {
          if (!v) break;
          if (s.on && !v.f.statuses.some((x) => x.type === s.status)) v.f.statuses.push({ type: s.status, turns: 2, amount: 1 });
          if (!s.on) v.f.statuses = v.f.statuses.filter((x) => x.type !== s.status);
          this.refreshStatus(v);
          const name = STATUS_NAME[s.status];
          if (name) { this.popText(v.c.x, this.headY(v) - 20, s.on ? name : `${name}解除`, s.on ? '#ffe04a' : '#c8c8c8', 22); await this.delay(300); }
          break;
        }
        case 'fx': await this.effect(s.name, s.at); break;
        case 'die': {
          if (!v) break;
          v.dead = true;
          if (v.f.side === 'party') {
            v.spr.play(`${v.sheet}#lose`);
            this.popText(v.c.x, this.headY(v), '倒下了…', '#c8c8c8', 22);
          } else {
            // paper fold-away
            await this.tween({ targets: v.c, scaleX: 0, duration: 220, ease: 'Sine.in' });
            this.puff(v.c.x, v.c.y - 40);
            v.c.setVisible(false).setScale(1);
          }
          await this.delay(200);
          break;
        }
        case 'revive': {
          if (!v) break;
          v.dead = false;
          v.f.hp = s.hp;
          v.spr.play(`${v.sheet}#win`);
          this.sparkle(v.c.x, this.headY(v), 0xfff6a0);
          await this.delay(500);
          v.spr.play(`${v.sheet}#side_idle`);
          break;
        }
        case 'spawn': {
          const idx = [...this.views.values()].filter((x) => x.f.side === s.fighter.side && !x.dead).length;
          this.addView(s.fighter, idx, true);
          audio.sfx('join');
          await this.delay(350);
          break;
        }
      }
    }
  }

  private flashSprite(v: View, color: number): void {
    v.spr.setTintFill(color);
    this.time.delayedCall(90, () => v.spr.clearTint());
  }

  private sparkle(x: number, y: number, tint: number): void {
    const p = this.add.particles(x, y, 'p_star', { speed: { min: 60, max: 180 }, lifespan: 600, scale: { start: 1, end: 0 }, quantity: 14, tint, emitting: false }).setDepth(1100);
    p.explode(14);
    this.time.delayedCall(800, () => p.destroy());
  }

  private puff(x: number, y: number): void {
    const p = this.add.particles(x, y, 'p_paper', { speed: { min: 80, max: 260 }, lifespan: 700, rotate: { min: 0, max: 360 }, scale: { start: 1.2, end: 0.2 }, gravityY: 400, emitting: false }).setDepth(1100);
    p.explode(18);
    this.time.delayedCall(900, () => p.destroy());
  }

  private async effect(name: string, at: string): Promise<void> {
    const targets = at === 'enemies' ? [...this.views.values()].filter((v) => v.f.side === 'enemy' && !v.dead) : [this.views.get(at)].filter(Boolean) as View[];
    const tints: Record<string, number> = { fire: 0xff6a2a, heal: 0x8affa0, heart: 0xff80c0, shield: 0x80c0ff, beam: 0xfff6a0, wind: 0xc8f0ff, notes: 0xc8a0ff, paint: 0xb88cff, shuriken: 0xc0c0c0, smoke: 0xd0d0d0, slash: 0xffffff, kick: 0xff5a4a, sparkle: 0xffd23a, starburst: 0xfff6a0, bite: 0x7fd35b, explode: 0xff8a2a, charge: 0xffff60, phase: 0xff4060, barrier: 0xc8b0ff, hammer: 0xffc080, jump: 0xffffff };
    if (name === 'darkness') { this.setDarkness(true); audio.sfx('shake'); await this.delay(500); return; }
    for (const v of targets) {
      const x = v.c.x, y = this.headY(v);
      const tint = tints[name] ?? 0xffffff;
      const tex = name === 'notes' || name === 'starburst' || name === 'sparkle' || name === 'beam' ? 'p_star' : name === 'smoke' || name === 'wind' ? 'p_cloud' : 'p_glow';
      const p = this.add.particles(x, y, tex, {
        speed: { min: 40, max: name === 'starburst' || name === 'explode' ? 420 : 200 }, lifespan: 650, quantity: name === 'starburst' ? 40 : 18,
        scale: { start: tex === 'p_cloud' ? 0.6 : 1, end: 0 }, tint, blendMode: tex === 'p_glow' ? 'ADD' : 'NORMAL', emitting: false,
      }).setDepth(1100);
      p.explode(name === 'starburst' ? 40 : 18);
      this.time.delayedCall(900, () => p.destroy());
      if (name === 'beam' || name === 'starburst') {
        const line = this.add.rectangle(GAME_W / 2, y, this.scale.width, 18, 0xfff6a0, 0.85).setDepth(1090).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: line, scaleY: 0, alpha: 0, duration: 400, onComplete: () => line.destroy() });
      }
      if (name === 'phase' || name === 'barrier') {
        const ring = this.add.circle(x, y, 20, tint, 0.4).setDepth(1090);
        this.tweens.add({ targets: ring, radius: 220, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
      }
    }
    const sfx: Record<string, string> = { fire: 'fire', beam: 'beam', heal: 'heal', shield: 'buff', sparkle: 'buff', starburst: 'shard', explode: 'break', charge: 'warning', phase: 'shake', barrier: 'magic', hammer: 'hammer', notes: 'magic' };
    if (sfx[name]) audio.sfx(sfx[name]);
    await this.delay(name === 'starburst' ? 700 : 300);
  }

  /* ======================= action commands ======================= */

  private promptText(text: string, y = 210): Phaser.GameObjects.Text {
    return this.add.text(GAME_W / 2, y, text, { fontFamily: FONT, fontSize: '28px', color: '#fffdf6', stroke: '#2a1a0a', strokeThickness: 7, align: 'center' }).setOrigin(0.5).setDepth(1300);
  }

  private waitPress(filter: (b: Btn) => boolean, timeoutMs: number): Promise<number | null> {
    return new Promise((resolve) => {
      const start = performance.now();
      let done = false;
      const off = input.onPress((b) => {
        if (done || !filter(b)) return false;
        done = true;
        off();
        resolve(performance.now() - start);
        return true;
      });
      this.time.delayedCall(timeoutMs, () => { if (!done) { done = true; off(); resolve(null); } });
    });
  }

  /** Runs the acting player's action command and returns its quality / bounce count. */
  /** Touch devices: a tap anywhere on the stage counts as the confirm button during commands. */
  private tapWanted = false;
  private get touchUI(): boolean {
    return document.body.classList.contains('touch-ui');
  }

  /**
   * During action commands a tap anywhere counts as the confirm button — including taps that land
   * on the party panel or prompts (on phones those cover a good part of the screen and would
   * otherwise never reach the canvas). The direction pad keeps its own buttons.
   */
  private listenForTaps(): () => void {
    const onDown = (e: PointerEvent) => {
      if (!this.tapWanted) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.tdpad, .dlg-skip, .cine-skip, button')) return;
      input.press('confirm');
    };
    window.addEventListener('pointerdown', onDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }

  async command(spec: CommandSpec): Promise<Quality | number> {
    this.tapWanted = true;
    const off = this.listenForTaps();
    try {
      return await this.commandInner(spec);
    } finally {
      off();
      this.tapWanted = false;
      bus.emit('touch:dpad', false);
    }
  }

  private async commandInner(spec: CommandSpec): Promise<Quality | number> {
    const actor = this.views.get(spec.actor);
    const target = spec.target ? this.views.get(spec.target) : undefined;
    const k = spec.hard ? 0.55 : 1;
    switch (spec.cmd) {
      case 'timing': {
        if (actor) actor.spr.play(`${actor.sheet}#side_attack`).anims.pause(actor.spr.anims.currentAnim?.frames[0]);
        const tx = target?.c.x ?? GAME_W / 2, ty = target ? this.headY(target) : 360;
        const inner = this.add.circle(tx, ty, 26, 0xffffff, 0.25).setStrokeStyle(5, 0xffffff).setDepth(1250);
        const ring = this.add.circle(tx, ty, 130, 0x000000, 0).setStrokeStyle(6, 0xffd23a).setDepth(1251);
        const tip = this.promptText(this.touchUI ? '光圈縮到最小時，點一下畫面！' : '時機正確時按下 確認！');
        const dur = 900;
        this.tweens.add({ targets: ring, radius: 26, duration: dur, ease: 'Linear' });
        const t = await this.waitPress((b) => b === 'confirm' || b === 'attack' || b === 'jump', dur + 260);
        this.tweens.killTweensOf(ring);
        inner.destroy(); ring.destroy(); tip.destroy();
        if (actor) actor.spr.anims.resume();
        if (t === null) return 'none';
        const off = Math.abs(t - dur);
        const q: Quality = off < 75 * k ? 'great' : off < 180 * k ? 'nice' : 'ok';
        audio.sfx(q === 'great' ? 'perfect' : q === 'nice' ? 'nice' : 'miss');
        return q;
      }
      case 'mash': {
        const tip = this.promptText(this.touchUI ? '快速連點畫面！' : '連打 確認！');
        const bg = this.add.rectangle(GAME_W / 2, 270, 420, 34, 0xfffdf6).setStrokeStyle(4, 0x3a2a1a).setDepth(1250);
        const bar = this.add.rectangle(GAME_W / 2 - 205, 270, 0, 24, 0xff8a3a).setOrigin(0, 0.5).setDepth(1251);
        let fill = 0;
        const off = input.onPress((b) => {
          if (b === 'confirm' || b === 'attack' || b === 'jump') { fill = Math.min(1.1, fill + 0.075 / (spec.hard ? 1.4 : 1)); audio.sfx('click'); return true; }
          return false;
        });
        const decay = this.time.addEvent({ delay: 50, loop: true, callback: () => { fill = Math.max(0, fill - 0.012); bar.width = 410 * Math.min(1, fill); bar.fillColor = fill >= 1 ? 0x4ae06a : 0xff8a3a; } });
        await this.delay(2000);
        off(); decay.remove(); tip.destroy(); bg.destroy(); bar.destroy();
        const q: Quality = fill >= 1 ? 'great' : fill >= 0.6 ? 'nice' : 'ok';
        audio.sfx(q === 'great' ? 'perfect' : q === 'nice' ? 'nice' : 'miss');
        return q;
      }
      case 'sequence': {
        const dirs: Btn[] = ['up', 'down', 'left', 'right'];

        const n = spec.len ?? 4;
        const seq = Array.from({ length: n }, () => dirs[Math.floor(Math.random() * 4)]);
        const tip = this.promptText(this.touchUI ? '依序點下方的方向鍵！' : '依序按下方向鍵！');
        bus.emit('touch:dpad', true);
        const items = seq.map((d, i) => this.add.image(GAME_W / 2 + (i - (n - 1) / 2) * 76, 280, ensureUiIconTexture(this, d as UiIconName)).setDisplaySize(64, 64).setDepth(1250));
        let idx = 0, correct = 0;
        const total = (spec.hard ? 2200 : 3400) + n * 150;
        const timer = this.add.rectangle(GAME_W / 2 - 200, 330, 400, 10, 0xffd23a).setOrigin(0, 0.5).setDepth(1250);
        this.tweens.add({ targets: timer, width: 0, duration: total });
        await new Promise<void>((resolve) => {
          const off = input.onPress((b) => {
            if (!dirs.includes(b)) return false;
            if (b === seq[idx]) { items[idx].setTint(0x4ae06a); correct++; audio.sfx('nice', 1 + idx * 0.1); }
            else { items[idx].setTint(0xe84a4a); audio.sfx('miss'); }
            idx++;
            if (idx >= n) { off(); resolve(); }
            return true;
          });
          this.time.delayedCall(total, () => { off(); resolve(); });
        });
        await this.delay(200);
        this.tweens.killTweensOf(timer);
        bus.emit('touch:dpad', false);
        tip.destroy(); timer.destroy(); items.forEach((t) => t.destroy());
        const q: Quality = correct === n ? 'great' : correct >= Math.ceil(n / 2) ? 'nice' : 'ok';
        audio.sfx(q === 'great' ? 'perfect' : 'confirm');
        return q;
      }
      case 'hold': return this.holdCommand(spec, k);
      case 'swipe': return this.swipeCommand(spec, k);
      case 'rhythm': return this.rhythmCommand(spec, k);
      case 'aim': return this.aimCommand(spec, k);
      case 'jump': {
        // press right as the character lands on the enemy's head
        const tip = this.promptText(this.touchUI ? '落地瞬間點畫面，再踩一次！' : '落地瞬間按下 確認 再踩一次！');
        let bounces = 1;
        const cap = spec.hits ?? 2;
        for (let i = 1; i < cap; i++) {
          const fall = 520;
          const t = await this.waitPress((b) => b === 'confirm' || b === 'jump' || b === 'attack', fall + 220);
          if (t !== null && Math.abs(t - fall) < 140 * k) { bounces++; audio.sfx('stomp', 1 + i * 0.15); this.popText(GAME_W / 2, 260, 'Nice!', '#ffd23a'); }
          else break;
        }
        tip.destroy();
        return bounces;
      }
      default:
        return 'ok';
    }
  }

  private judge(q: Quality): Quality {
    audio.sfx(q === 'great' ? 'perfect' : q === 'nice' ? 'nice' : 'miss');
    if (q !== 'none') this.popText(GAME_W / 2, 236, q === 'great' ? 'Great!' : q === 'nice' ? 'Nice!' : 'OK', q === 'great' ? '#ffd23a' : '#fffdf6');
    return q;
  }

  /** Confirm-type keys, for commands that need to know when the button is released. */
  private static HOLD_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyX', 'KeyE', 'KeyZ']);

  private toGame(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.game.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.scale.width, y: ((clientY - r.top) / r.height) * this.scale.height };
  }

  /** 按住放開: hold to charge, let go inside the green zone. */
  private holdCommand(_spec: CommandSpec, k: number): Promise<Quality> {
    const W = 420, x0 = GAME_W / 2 - W / 2, y = 280;
    const zw = 0.13 * k, z0 = 0.6 + Math.random() * (0.32 - zw);
    const tip = this.promptText(this.touchUI ? '按住畫面集氣，在綠色區域放開！' : '按住 確認 集氣，在綠色區域放開！');
    const bg = this.add.rectangle(GAME_W / 2, y, W + 10, 36, 0xfffdf6).setStrokeStyle(4, 0x3a2a1a).setDepth(1250);
    const zone = this.add.rectangle(x0 + z0 * W, y, zw * W, 26, 0x4ae06a).setOrigin(0, 0.5).setDepth(1251);
    const bar = this.add.rectangle(x0, y, 0, 18, 0xff8a3a).setOrigin(0, 0.5).setDepth(1252);
    const needle = this.add.rectangle(x0, y, 6, 44, 0x3a2a1a).setDepth(1253);
    return new Promise((resolve) => {
      let held = false, fill = 0, done = false;
      const offPress = input.onPress((b) => {
        if (b !== 'confirm' && b !== 'attack' && b !== 'jump') return false;
        if (!held && !done) { held = true; audio.sfx('buff'); }
        return true;
      });
      const release = () => {
        if (!held || done) return;
        finish(fill >= z0 && fill <= z0 + zw ? 'great' : fill >= z0 - 0.08 && fill <= z0 + zw + 0.05 ? 'nice' : 'ok');
      };
      const onKeyUp = (e: KeyboardEvent) => { if (BattleScene.HOLD_KEYS.has(e.code)) release(); };
      const onPtrUp = () => release();
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('pointerup', onPtrUp, { capture: true });
      window.addEventListener('pointercancel', onPtrUp, { capture: true });
      const tick = this.time.addEvent({
        delay: 16, loop: true, callback: () => {
          if (!held || done) return;
          fill += 0.016 / 1.15;
          bar.width = W * Math.min(1, fill);
          needle.x = x0 + W * Math.min(1, fill);
          if (fill >= 1.02) finish('none'); // over-charged
        },
      });
      const giveUp = this.time.delayedCall(3200, () => { if (!held) finish('none'); });
      const finish = (q: Quality) => {
        if (done) return;
        done = true;
        offPress(); tick.remove(); giveUp.remove();
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('pointerup', onPtrUp, { capture: true });
        window.removeEventListener('pointercancel', onPtrUp, { capture: true });
        if (q === 'great') zone.setFillStyle(0xffd23a);
        this.time.delayedCall(220, () => { tip.destroy(); bg.destroy(); zone.destroy(); bar.destroy(); needle.destroy(); });
        resolve(this.judge(q));
      };
    });
  }

  /** 畫線摺紙: drag along the dashed fold line (keyboard: press the arrow it points to). */
  private swipeCommand(spec: CommandSpec, k: number): Promise<Quality> {
    const target = spec.target ? this.views.get(spec.target) : undefined;
    const cx = target?.c.x ?? GAME_W / 2, cy = target ? this.headY(target) + 40 : 360;
    const dirs: { a: number; key: Btn }[] = [{ a: 0, key: 'right' }, { a: Math.PI, key: 'left' }, { a: Math.PI / 2, key: 'down' }, { a: -Math.PI / 2, key: 'up' }, { a: 0.55, key: 'right' }, { a: Math.PI - 0.55, key: 'left' }];
    const pick = dirs[Math.floor(Math.random() * dirs.length)];
    const half = 115;
    const sx = cx - Math.cos(pick.a) * half, sy = cy - Math.sin(pick.a) * half;
    const ex = cx + Math.cos(pick.a) * half, ey = cy + Math.sin(pick.a) * half;
    const g = this.add.graphics().setDepth(1250);
    for (const [w, c] of [[12, 0x3a2a1a], [6, 0xfffdf6]] as [number, number][]) {
      g.lineStyle(w, c, 1);
      for (let i = 0; i < 12; i += 2) {
        const t0 = i / 12, t1 = (i + 1) / 12;
        g.lineBetween(sx + (ex - sx) * t0, sy + (ey - sy) * t0, sx + (ex - sx) * t1, sy + (ey - sy) * t1);
      }
    }
    const startDot = this.add.circle(sx, sy, 20, 0x4ae06a).setStrokeStyle(4, 0x3a2a1a).setDepth(1251);
    const endDot = this.add.circle(ex, ey, 20, 0xff8ac4).setStrokeStyle(4, 0x3a2a1a).setDepth(1251);
    this.tweens.add({ targets: startDot, scale: 1.25, yoyo: true, repeat: -1, duration: 260 });
    const keyIcon = this.add.image(GAME_W / 2, 300, ensureUiIconTexture(this, pick.key as UiIconName)).setDisplaySize(56, 56).setDepth(1252).setVisible(!this.touchUI);
    const tip = this.promptText(this.touchUI ? '從綠點沿著虛線劃到粉紅點，把敵人摺起來！' : '沿著虛線把敵人摺起來！按下圖示的方向鍵（滑鼠也可以拖曳）');
    const trail = this.add.graphics().setDepth(1252);
    const limit = (spec.hard ? 1900 : 2800);
    const t0 = performance.now();
    // drags must not also count as taps
    this.tapWanted = false;
    return new Promise((resolve) => {
      let done = false, dragging = false;
      const pts: { x: number; y: number }[] = [];
      const offPress = input.onPress((b) => {
        if (b === pick.key) { const dt = performance.now() - t0; finish(dt < 700 / k ? 'great' : dt < 1300 / k ? 'nice' : 'ok'); return true; }
        if (['up', 'down', 'left', 'right'].includes(b)) { finish('ok'); return true; }
        return b === 'confirm' || b === 'attack' || b === 'jump';
      });
      const onDown = (e: PointerEvent) => {
        const p = this.toGame(e.clientX, e.clientY);
        if (Math.hypot(p.x - sx, p.y - sy) < 70) { dragging = true; pts.length = 0; pts.push(p); }
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const p = this.toGame(e.clientX, e.clientY);
        pts.push(p);
        trail.clear().lineStyle(8, 0xffd23a, 1).beginPath();
        pts.forEach((q, i) => (i ? trail.lineTo(q.x, q.y) : trail.moveTo(q.x, q.y)));
        trail.strokePath();
      };
      const onUp = () => {
        if (!dragging || done) return;
        dragging = false;
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(last.x - ex, last.y - ey) > 75) { finish('ok'); return; }
        // average distance from the fold line
        const lx = ex - sx, ly = ey - sy, len = Math.hypot(lx, ly);
        const dev = pts.reduce((a, q) => a + Math.abs(((q.x - sx) * ly - (q.y - sy) * lx) / len), 0) / pts.length;
        finish(dev < 20 / k ? 'great' : dev < 42 / k ? 'nice' : 'ok');
      };
      window.addEventListener('pointerdown', onDown, { capture: true });
      window.addEventListener('pointermove', onMove, { capture: true });
      window.addEventListener('pointerup', onUp, { capture: true });
      const timeout = this.time.delayedCall(limit, () => finish(pts.length > 3 ? 'ok' : 'none'));
      const finish = (q: Quality) => {
        if (done) return;
        done = true;
        offPress(); timeout.remove();
        window.removeEventListener('pointerdown', onDown, { capture: true });
        window.removeEventListener('pointermove', onMove, { capture: true });
        window.removeEventListener('pointerup', onUp, { capture: true });
        this.tweens.killTweensOf(startDot);
        if (q === 'great' || q === 'nice') {
          // the fold: a quick white flash along the line
          const fold = this.add.graphics().setDepth(1253).lineStyle(14, 0xffffff, 1).lineBetween(sx, sy, ex, ey);
          this.tweens.add({ targets: fold, alpha: 0, duration: 380, onComplete: () => fold.destroy() });
          audio.sfx('flip');
        }
        this.time.delayedCall(200, () => { g.destroy(); startDot.destroy(); endDot.destroy(); keyIcon.destroy(); tip.destroy(); trail.destroy(); });
        resolve(this.judge(q));
      };
    });
  }

  /** 節奏: notes slide into the ring to the beat — hit each one as it arrives. */
  private rhythmCommand(spec: CommandSpec, k: number): Promise<Quality> {
    const n = Math.max(3, Math.min(6, (spec.len ?? 4)));
    const beat = spec.hard ? 430 : 520;
    const y = 285, hitX = GAME_W / 2 - 190, startX = GAME_W / 2 + 330;
    const lead = beat * 3;
    const tip = this.promptText(this.touchUI ? '音符碰到圓圈時，跟著節拍點畫面！' : '音符碰到圓圈時，跟著節拍按 確認！');
    const lane = this.add.rectangle(GAME_W / 2 + 70, y, 560, 46, 0xfffdf6, 0.85).setStrokeStyle(4, 0x3a2a1a).setDepth(1249);
    const ring = this.add.circle(hitX, y, 24, 0xffffff, 0.3).setStrokeStyle(5, 0xff8ac4).setDepth(1250);
    const t0 = performance.now();
    const notes = Array.from({ length: n }, (_, i) => {
      const at = lead + i * beat;
      const o = this.add.text(startX, y, '♪', { fontFamily: FONT, fontSize: '34px', color: '#7a5ad8', stroke: '#fffdf6', strokeThickness: 5 }).setOrigin(0.5).setDepth(1251);
      this.tweens.add({ targets: o, x: hitX - (startX - hitX) * 0.25, duration: at * 1.25, ease: 'Linear' });
      return { at, o, judged: false };
    });
    // count-in ticks
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * beat, () => audio.sfx('click', 0.8));
    return new Promise((resolve) => {
      let great = 0, nice = 0, done = false;
      const mark = (nt: typeof notes[number], q: 'great' | 'nice' | 'miss') => {
        nt.judged = true;
        this.tweens.killTweensOf(nt.o);
        nt.o.setColor(q === 'great' ? '#ffb000' : q === 'nice' ? '#4ac86a' : '#c0c0c0');
        this.tweens.add({ targets: nt.o, y: y - 40, alpha: 0, duration: 300, onComplete: () => nt.o.destroy() });
        if (q !== 'miss') { this.tweens.add({ targets: ring, scale: 1.3, yoyo: true, duration: 90 }); audio.sfx(q === 'great' ? 'perfect' : 'nice', 1 + great * 0.06); }
      };
      const off = input.onPress((b) => {
        if (b !== 'confirm' && b !== 'attack' && b !== 'jump') return false;
        const t = performance.now() - t0;
        const nt = notes.find((x) => !x.judged && Math.abs(x.at - t) < 260);
        if (!nt) { audio.sfx('miss'); return true; }
        const offT = Math.abs(nt.at - t);
        if (offT < 80 * k) { great++; mark(nt, 'great'); } else if (offT < 170 * k) { nice++; mark(nt, 'nice'); } else mark(nt, 'miss');
        return true;
      });
      const watch = this.time.addEvent({
        delay: 30, loop: true, callback: () => {
          const t = performance.now() - t0;
          for (const nt of notes) if (!nt.judged && t > nt.at + 260) mark(nt, 'miss');
          if (!done && notes.every((x) => x.judged)) finish();
        },
      });
      const finish = () => {
        done = true;
        off(); watch.remove();
        this.time.delayedCall(320, () => { tip.destroy(); lane.destroy(); ring.destroy(); notes.forEach((x) => x.o.destroy()); });
        const score = great + nice * 0.6;
        resolve(this.judge(great === n ? 'great' : score >= n * 0.6 ? 'nice' : score > 0 ? 'ok' : 'none'));
      };
    });
  }

  /** 瞄準: the sight drifts around — fire when it is on the bullseye. */
  private aimCommand(spec: CommandSpec, k: number): Promise<Quality> {
    const target = spec.target ? this.views.get(spec.target) : undefined;
    const tx = target?.c.x ?? GAME_W / 2, ty = target ? this.headY(target) + 30 : 340;
    const tip = this.promptText(this.touchUI ? '準星對準紅心的瞬間，點畫面！' : '準星對準紅心的瞬間，按 確認！');
    const rings = [this.add.circle(tx, ty, 44, 0xffffff, 0.35).setStrokeStyle(4, 0xffffff).setDepth(1250), this.add.circle(tx, ty, 16, 0xff4a6a, 0.9).setStrokeStyle(3, 0xffffff).setDepth(1250)];
    const sight = this.add.container(tx, ty).setDepth(1252);
    const sg = this.add.graphics();
    sg.lineStyle(5, 0x3a2a1a, 1).strokeCircle(0, 0, 22).lineBetween(-34, 0, -10, 0).lineBetween(10, 0, 34, 0).lineBetween(0, -34, 0, -10).lineBetween(0, 10, 0, 34);
    sg.lineStyle(2.5, 0xffd23a, 1).strokeCircle(0, 0, 22);
    sight.add(sg);
    const sp = (spec.hard ? 1.45 : 1) * (0.9 + Math.random() * 0.25);
    const ph = Math.random() * 6;
    const t0 = performance.now();
    const mover = this.time.addEvent({
      delay: 16, loop: true, callback: () => {
        const t = (performance.now() - t0) / 1000;
        sight.setPosition(tx + Math.sin(t * 2.3 * sp + ph) * 95, ty + Math.sin(t * 3.4 * sp + ph * 2) * 62);
      },
    });
    return new Promise((resolve) => {
      let done = false;
      const off = input.onPress((b) => {
        if (b !== 'confirm' && b !== 'attack' && b !== 'jump') return false;
        const d = Math.hypot(sight.x - tx, sight.y - ty);
        finish(d < 15 / k ? 'great' : d < 38 / k ? 'nice' : 'ok');
        return true;
      });
      const timeout = this.time.delayedCall(3400, () => finish('none'));
      const finish = (q: Quality) => {
        if (done) return;
        done = true;
        off(); mover.remove(); timeout.remove();
        if (q !== 'none') { const boom = this.add.circle(sight.x, sight.y, 10, 0xffd23a).setDepth(1253); this.tweens.add({ targets: boom, radius: 46, alpha: 0, duration: 260, onComplete: () => boom.destroy() }); }
        this.time.delayedCall(240, () => { tip.destroy(); rings.forEach((r) => r.destroy()); sight.destroy(); });
        resolve(this.judge(q));
      };
    });
  }

  /** Guard command for the targeted local player. */
  async guard(spec: { attacker: string; target: string; hard: boolean; badges: string[] }): Promise<GuardResult> {
    this.tapWanted = true;
    const off = this.listenForTaps();
    try {
      return await this.guardInner(spec);
    } finally {
      off();
      this.tapWanted = false;
    }
  }

  private async guardInner(spec: { attacker: string; target: string; hard: boolean; badges: string[] }): Promise<GuardResult> {
    const att = this.views.get(spec.attacker);
    const tgt = this.views.get(spec.target);
    if (!att || !tgt) return 'fail';
    const plus = spec.badges.includes('b_perfect') ? 1.5 : 1;
    const k = (spec.hard ? 0.6 : 1) * plus;
    const mark = this.add.text(tgt.c.x, this.headY(tgt) - 40, '!', { fontFamily: FONT, fontSize: '48px', color: '#ffd23a', stroke: '#2a1a0a', strokeThickness: 8 }).setOrigin(0.5).setDepth(1300);
    const tip = this.promptText(this.touchUI ? '藍色光圈縮到最小時，點畫面防禦！' : '藍色光圈縮到最小時，按下 確認 防禦！', 170);
    const windup = 520 + Math.random() * 500; // unpredictable lunge timing
    // shrinking guard ring (like the hammer ring): block when it meets the inner circle
    const gx = tgt.c.x, gy = this.headY(tgt) + 34;
    const inner = this.add.circle(gx, gy, 30, 0x9fd8ff, 0.28).setStrokeStyle(5, 0xffffff).setDepth(1250);
    const ring = this.add.circle(gx, gy, 150, 0x000000, 0).setStrokeStyle(6, 0x4aa8ff).setDepth(1251);
    this.tweens.add({ targets: ring, radius: 30, duration: windup, ease: 'Linear' });
    this.tweens.add({ targets: inner, alpha: { from: 0.6, to: 1 }, duration: 160, yoyo: true, repeat: -1 });
    att.spr.stop();
    att.spr.setFrame('attack');
    this.tweens.add({ targets: att.c, x: tgt.c.x + 120, delay: windup - 260, duration: 260, ease: 'Quad.in' });
    const t = await this.waitPress((b) => b === 'confirm' || b === 'jump' || b === 'attack', windup + 260);
    this.tweens.killTweensOf(ring);
    this.tweens.killTweensOf(inner);
    if (t !== null && Math.abs(t - windup) < 70 * k) { ring.setStrokeStyle(8, 0xffd23a); inner.setFillStyle(0xffd23a, 0.5); }
    this.tweens.add({ targets: [ring, inner], alpha: 0, scale: 1.3, duration: 220, onComplete: () => { ring.destroy(); inner.destroy(); } });
    mark.destroy(); tip.destroy();
    this.tweens.killTweensOf(att.c);
    if (t === null) return 'fail';
    const off = t - windup;
    if (Math.abs(off) < 70 * k) return 'perfect';
    if (off > -200 * k && off < 120 * k) return 'good';
    return 'fail';
  }
}

function FRAMEH(scale: number): number {
  return 110 * scale;
}
