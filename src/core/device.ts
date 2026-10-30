/** Device helpers: phones/tablets get a full-screen view and a bigger UI; desktop stays 1280×720. */
import { GAME_H, GAME_W } from './config';

export const isCoarse = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** A touch device with a small screen. */
export const isPhone = (): boolean => isCoarse() && Math.min(window.innerWidth, window.innerHeight) <= 600;

/**
 * Logical game width. Desktop: always 1280 (letterboxed 16:9 as before).
 * Touch devices in landscape: widened to the screen's aspect ratio so the game fills the screen.
 */
export function viewWidth(): number {
  if (!isCoarse()) return GAME_W;
  const ar = window.innerWidth / window.innerHeight;
  if (ar <= GAME_W / GAME_H) return GAME_W;
  return Math.min(1840, Math.round((GAME_H * ar) / 2) * 2);
}
