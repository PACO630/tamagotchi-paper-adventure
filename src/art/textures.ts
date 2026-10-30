/** Builds every generated texture/sprite sheet into Phaser's texture manager. */
import Phaser from 'phaser';
import { CHAR_IDS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import type { CharId, Expr, NpcLook, ThemeDef } from '../data/types';
import { basePose, renderFrame, type DrawTarget, type Pose } from './characterArt';
import { renderEnemyFrame, type EnemyFrame } from './enemyArt';
import {
  canvas, frontEdgeTexture, groundEdgeTexture, groundTexture, layerTexture, lightRaysTexture,
  OBJECTS, paperCut, platformTexture, PROPS, skyTexture, softCircle, vignetteTexture,
} from './paperArt';
import { hashString } from '../core/util';

export const FRAME = 128;

const W = (n: number) => n;
/** Full animation frame set for playable characters. */
export const CHAR_FRAMES: [string, Partial<Pose>][] = [
  ['front_idle0', { facing: 'front' }],
  ['front_idle1', { facing: 'front', sx: 1.03, sy: 0.97, blink: true }],
  ['front_walk0', { facing: 'front', liftL: 5, bob: 2, armL: 0.6, armR: -0.1 }],
  ['front_walk1', { facing: 'front', bob: 0 }],
  ['front_walk2', { facing: 'front', liftR: 5, bob: 2, armL: 0.1, armR: -0.6 }],
  ['front_walk3', { facing: 'front', bob: 0, sx: 1.02, sy: 0.98 }],
  ['back_idle0', { facing: 'back' }],
  ['back_walk0', { facing: 'back', liftL: 5, bob: 2 }],
  ['back_walk1', { facing: 'back' }],
  ['back_walk2', { facing: 'back', liftR: 5, bob: 2 }],
  ['back_walk3', { facing: 'back', sx: 1.02, sy: 0.98 }],
  ['side_idle0', { facing: 'side' }],
  ['side_idle1', { facing: 'side', sx: 1.03, sy: 0.97, blink: true }],
  ['side_walk0', { facing: 'side', footL: -8, footR: 8, liftR: 4, bob: 2, armL: 0.5, armR: -0.5 }],
  ['side_walk1', { facing: 'side', footL: 0, footR: 0, bob: 0 }],
  ['side_walk2', { facing: 'side', footL: 8, footR: -8, liftL: 4, bob: 2, armL: -0.5, armR: 0.5 }],
  ['side_walk3', { facing: 'side', footL: 0, footR: 0, bob: 0, sx: 1.02, sy: 0.98 }],
  ['side_run0', { facing: 'side', footL: -14, footR: 12, liftR: 8, bob: 5, lean: 5, armL: 1, armR: -1, expr: 'determined' }],
  ['side_run1', { facing: 'side', bob: 1, lean: 5, sx: 1.04, sy: 0.96, expr: 'determined' }],
  ['side_run2', { facing: 'side', footL: 12, footR: -14, liftL: 8, bob: 5, lean: 5, armL: -1, armR: 1, expr: 'determined' }],
  ['side_run3', { facing: 'side', bob: 1, lean: 5, sx: 1.04, sy: 0.96, expr: 'determined' }],
  ['side_jump0', { facing: 'side', sx: 0.93, sy: 1.08, liftL: 6, liftR: 8, armL: 2.4, armR: -2.4, expr: 'happy' }],
  ['side_jump1', { facing: 'side', sx: 1.04, sy: 0.97, liftL: 2, liftR: 2, armL: 1.6, armR: -1.6, expr: 'surprised' }],
  ['side_atk0', { facing: 'side', hammer: -2.3, lean: -5, expr: 'determined', sx: 0.97, sy: 1.04 }],
  ['side_atk1', { facing: 'side', hammer: 0.35, lean: 7, expr: 'angry', sx: 1.06, sy: 0.95 }],
  ['side_atk2', { facing: 'side', hammer: 0.9, lean: 4, expr: 'determined' }],
  ['side_hurt', { facing: 'side', expr: 'hurt', lean: -7, sx: 0.92, sy: 1.06, armL: -1.2, armR: 1.2 }],
  ['side_dizzy', { facing: 'side', dizzy: true, lean: -2 }],
  ['front_win0', { facing: 'front', expr: 'happy', armL: 2.6, armR: -2.6, bob: 4 }],
  ['front_win1', { facing: 'front', expr: 'happy', armL: 2.2, armR: -2.2, bob: 14, liftL: 6, liftR: 6, sx: 0.95, sy: 1.06 }],
  ['front_lose', { facing: 'front', flat: true }],
  ['front_talk', { facing: 'front', mouthOpen: true }],
];
const NPC_FRAMES = ['front_idle0', 'front_idle1', 'front_talk', 'side_idle0', 'side_walk0', 'side_walk1', 'side_walk2', 'side_walk3'];

export const ANIMS: Record<string, { frames: string[]; rate: number; repeat: number }> = {
  front_idle: { frames: ['front_idle0', 'front_idle0', 'front_idle0', 'front_idle1'], rate: 3, repeat: -1 },
  back_idle: { frames: ['back_idle0'], rate: 1, repeat: -1 },
  side_idle: { frames: ['side_idle0', 'side_idle0', 'side_idle0', 'side_idle1'], rate: 3, repeat: -1 },
  front_walk: { frames: ['front_walk0', 'front_walk1', 'front_walk2', 'front_walk3'], rate: 8, repeat: -1 },
  back_walk: { frames: ['back_walk0', 'back_walk1', 'back_walk2', 'back_walk3'], rate: 8, repeat: -1 },
  side_walk: { frames: ['side_walk0', 'side_walk1', 'side_walk2', 'side_walk3'], rate: 9, repeat: -1 },
  side_run: { frames: ['side_run0', 'side_run1', 'side_run2', 'side_run3'], rate: 13, repeat: -1 },
  side_jump: { frames: ['side_jump0'], rate: 1, repeat: 0 },
  side_fall: { frames: ['side_jump1'], rate: 1, repeat: 0 },
  side_attack: { frames: ['side_atk0', 'side_atk0', 'side_atk1', 'side_atk2', 'side_atk2'], rate: 14, repeat: 0 },
  side_hurt: { frames: ['side_hurt'], rate: 1, repeat: 0 },
  side_dizzy: { frames: ['side_dizzy'], rate: 1, repeat: -1 },
  win: { frames: ['front_win0', 'front_win1'], rate: 4, repeat: -1 },
  lose: { frames: ['front_lose'], rate: 1, repeat: -1 },
  talk: { frames: ['front_talk', 'front_idle0'], rate: 6, repeat: -1 },
};

function sheetKey(t: DrawTarget): string {
  if (t.charId) return `chr:${t.charId}${t.dark ? ':dark' : ''}`;
  return `npc:${npcLookKey(t.npc!)}${t.dark ? ':dark' : ''}`;
}

export function npcLookKey(n: NpcLook): string {
  return hashString(JSON.stringify(n)).toString(36);
}

export function charSheetKey(id: CharId, dark = false): string {
  return `chr:${id}${dark ? ':dark' : ''}`;
}

/** Builds a sprite sheet (CanvasTexture with named frames) for a character or NPC look. */
export function ensureSheet(scene: Phaser.Scene, t: DrawTarget, full = true): string {
  const key = sheetKey(t);
  if (scene.textures.exists(key)) return key;
  const frames = full ? CHAR_FRAMES : CHAR_FRAMES.filter(([n]) => NPC_FRAMES.includes(n));
  const cols = full ? 8 : 4;
  const rows = Math.ceil(frames.length / cols);
  const tex = scene.textures.createCanvas(key, cols * FRAME, rows * FRAME)!;
  const ctx = tex.getContext();
  frames.forEach(([name, pose], i) => {
    const c = renderFrame(t, basePose(pose), `${key}:${name}`);
    const x = (i % cols) * FRAME, y = Math.floor(i / cols) * FRAME;
    ctx.drawImage(c, x, y);
    tex.add(name, 0, x, y, FRAME, FRAME);
  });
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  // animations
  for (const [anim, def] of Object.entries(ANIMS)) {
    const animKey = `${key}#${anim}`;
    if (scene.anims.exists(animKey)) continue;
    const available = def.frames.filter((f) => frames.some(([n]) => n === f));
    if (!available.length) continue;
    scene.anims.create({ key: animKey, frames: available.map((f) => ({ key, frame: f })), frameRate: def.rate, repeat: def.repeat });
  }
  return key;
}

export function ensureEnemySheet(scene: Phaser.Scene, enemyId: string): string {
  const key = `enm:${enemyId}`;
  if (scene.textures.exists(key)) return key;
  const def = ENEMIES[enemyId];
  const frames: EnemyFrame[] = ['idle0', 'idle1', 'attack', 'hurt'];
  const tex = scene.textures.createCanvas(key, FRAME * 4, FRAME)!;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    ctx.drawImage(renderEnemyFrame(def.art, f, def.traits.includes('spiky'), enemyId), i * FRAME, 0);
    tex.add(f, 0, i * FRAME, 0, FRAME, FRAME);
  });
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  if (!scene.anims.exists(`${key}#idle`)) {
    scene.anims.create({ key: `${key}#idle`, frames: [{ key, frame: 'idle0' }, { key, frame: 'idle1' }], frameRate: 3, repeat: -1 });
  }
  return key;
}

function addCanvas(scene: Phaser.Scene, key: string, c: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) return;
  scene.textures.addCanvas(key, c);
}

export function ensureProp(scene: Phaser.Scene, name: string): string {
  const key = `prop:${name}`;
  if (!scene.textures.exists(key)) {
    const spec = PROPS[name] ?? PROPS.rock;
    addCanvas(scene, key, paperCut(spec.w, spec.h, (g) => spec.draw(g, spec.w, spec.h)));
  }
  return key;
}

export function ensureObject(scene: Phaser.Scene, name: string): string {
  const key = `obj:${name}`;
  if (!scene.textures.exists(key)) {
    const spec = OBJECTS[name];
    addCanvas(scene, key, paperCut(spec.w, spec.h, (g) => spec.draw(g, spec.w, spec.h)));
  }
  return key;
}

export function ensurePlatform(scene: Phaser.Scene, look: string): string {
  const key = `plat:${look}`;
  if (!scene.textures.exists(key)) addCanvas(scene, key, platformTexture(look));
  return key;
}

export function ensureTheme(scene: Phaser.Scene, t: ThemeDef): void {
  addCanvas(scene, `sky:${t.id}`, skyTexture(t));
  addCanvas(scene, `far:${t.id}`, layerTexture(t, 'far'));
  addCanvas(scene, `mid:${t.id}`, layerTexture(t, 'mid'));
  addCanvas(scene, `ground:${t.id}`, groundTexture(t));
  addCanvas(scene, `gedge:${t.id}`, groundEdgeTexture(t));
  addCanvas(scene, `fedge:${t.id}`, frontEdgeTexture(t));
}

/** Frees theme-specific textures when leaving a chapter. */
export function releaseTheme(scene: Phaser.Scene, keepId: string | null): void {
  for (const key of scene.textures.getTextureKeys()) {
    const m = /^(sky|far|mid|ground|gedge|fedge):(.+)$/.exec(key);
    if (m && m[2] !== keepId) scene.textures.remove(key);
  }
}

export function releaseNpcSheets(scene: Phaser.Scene): void {
  for (const key of scene.textures.getTextureKeys()) {
    if (key.startsWith('npc:')) {
      for (const anim of Object.keys(ANIMS)) if (scene.anims.exists(`${key}#${anim}`)) scene.anims.remove(`${key}#${anim}`);
      scene.textures.remove(key);
    }
  }
}

/** Shared small textures: shadows, particles, UI bits. */
export function buildCommonTextures(scene: Phaser.Scene): void {
  const [sh, s] = canvas(128, 40);
  const rg = s.createRadialGradient(64, 20, 4, 64, 20, 64);
  rg.addColorStop(0, 'rgba(30,15,5,0.55)');
  rg.addColorStop(1, 'rgba(30,15,5,0)');
  s.fillStyle = rg;
  s.save();
  s.scale(1, 0.31);
  s.beginPath();
  s.arc(64, 64, 64, 0, Math.PI * 2);
  s.restore();
  s.fill();
  addCanvas(scene, 'shadow', sh);
  addCanvas(scene, 'p_glow', softCircle(32, 'rgba(255,255,255,1)'));
  addCanvas(scene, 'p_warm', softCircle(64, 'rgba(255,230,160,0.9)'));
  addCanvas(scene, 'vignette', vignetteTexture());
  addCanvas(scene, 'rays', lightRaysTexture());

  const simple = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const [c, g] = canvas(w, h);
    draw(g);
    addCanvas(scene, key, c);
  };
  simple('p_petal', 14, 10, (g) => { g.fillStyle = '#ffb0d0'; g.beginPath(); g.ellipse(7, 5, 6, 4, 0.4, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.stroke(); });
  simple('p_leaf', 16, 10, (g) => { g.fillStyle = '#7ac85a'; g.beginPath(); g.ellipse(8, 5, 7, 4, 0.3, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.stroke(); });
  simple('p_star', 18, 18, (g) => { g.fillStyle = '#fff6a0'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 3.5 : 8.5; g.lineTo(9 + Math.cos(a) * r, 9 + Math.sin(a) * r); } g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); });
  simple('p_bubble', 18, 18, (g) => { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; g.beginPath(); g.arc(9, 9, 7, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(5, 5, 3, 3); });
  simple('p_snow', 10, 10, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(5, 5, 4, 0, Math.PI * 2); g.fill(); });
  simple('p_candy', 14, 8, (g) => { g.fillStyle = ['#ff3a6a', '#3ad0ff', '#ffe03a'][Math.floor(Math.random() * 3)]; g.beginPath(); g.roundRect(1, 1, 12, 6, 3); g.fill(); });
  simple('p_mote', 10, 10, (g) => { g.fillStyle = '#c86aff'; g.beginPath(); g.arc(5, 5, 4, 0, Math.PI * 2); g.fill(); });
  simple('p_dust', 6, 6, (g) => { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(1, 1, 4, 4); });
  simple('p_rain', 4, 22, (g) => { g.fillStyle = 'rgba(200,220,255,0.8)'; g.fillRect(1, 0, 2, 22); });
  simple('p_paper', 12, 12, (g) => { g.fillStyle = '#fffdf6'; g.fillRect(1, 1, 10, 10); g.strokeStyle = '#c8b898'; g.strokeRect(1, 1, 10, 10); });
  simple('p_cloud', 120, 60, (g) => { for (const [x, y, r] of [[30, 38, 20], [60, 28, 26], [90, 38, 20]]) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } });
  simple('hitstar', 80, 80, (g) => { g.fillStyle = '#fff36a'; g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 18 : 38; g.lineTo(40 + Math.cos(a) * r, 40 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); });
  simple('emote_bubble', 56, 52, (g) => { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.ellipse(28, 22, 24, 19, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(20, 38); g.lineTo(16, 50); g.lineTo(30, 40); g.fill(); g.stroke(); });
  void W;
}

/* ---------------- Portraits (DOM) ---------------- */

const portraitCache = new Map<string, string>();

export function portraitURL(t: DrawTarget, expr: Expr): string {
  const k = `${sheetKey(t)}|${expr}`;
  const hit = portraitCache.get(k);
  if (hit) return hit;
  const c = renderFrame(t, basePose({ facing: 'front', expr }), k);
  const url = c.toDataURL();
  portraitCache.set(k, url);
  return url;
}

export function prewarmPortraits(): void {
  for (const id of CHAR_IDS) portraitURL({ charId: id }, 'normal');
}
