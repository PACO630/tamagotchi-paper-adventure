import type { ChapterDef } from '../types';
import { ch1 } from './ch1';
import { ch2 } from './ch2';
import { ch3 } from './ch3';
import { ch4 } from './ch4';
import { ch5 } from './ch5';
import { ch6 } from './ch6';
import { ch7 } from './ch7';
import { ch8 } from './ch8';

export const CHAPTERS: ChapterDef[] = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8];

export function chapterByNum(n: number): ChapterDef {
  return CHAPTERS[Math.max(1, Math.min(CHAPTERS.length, n)) - 1];
}
