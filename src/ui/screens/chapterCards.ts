/** Chapter title card, chapter clear card and game over screen. */
import { G } from '../../core/game';
import { wait } from '../../core/util';
import type { ChapterDef } from '../../data/types';
import { audio } from '../../systems/audio';
import { btn, h, Layer } from '../dom';
import { uiIcon } from '../../art/uiIcons';

export async function showChapterCard(cd: ChapterDef): Promise<void> {
  const el = h('div', { class: 'chapter-card' },
    h('div', { class: 'cc-paper' },
      h('div', { class: 'cc-num' }, `CHAPTER ${cd.num}`),
      h('div', { class: 'cc-title' }, cd.title),
      h('div', { class: 'cc-loc' }, `— ${cd.location} —`),
      h('div', { class: 'cc-sum' }, cd.summary)));
  document.getElementById('fx-overlay')!.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  audio.sfx('flip');
  await wait(2600);
  el.classList.remove('in');
  el.classList.add('out');
  await wait(400);
  el.remove();
}

export function showChapterClear(cd: ChapterDef): Promise<void> {
  return new Promise((resolve) => {
    audio.playMusic('victory');
    const layer = new Layer('chapter-clear', true);
    const shards = G.state.inventory.filter((e) => e.id.startsWith('shard')).length;
    const done = () => { layer.close(); resolve(); };
    layer.onCancel = done;
    layer.el.append(h('div', { class: 'paper-card clear-card' },
      h('div', { class: 'clear-stamp' }, 'CLEAR!'),
      h('h2', {}, `${cd.title}　完成！`),
      h('p', {}, `星之心碎片：${shards} / 8`),
      h('div', { class: 'shard-row' }, ...Array.from({ length: 8 }, (_, i) => h('span', { class: `shard-dot${i < shards ? ' got' : ''}` }, uiIcon('shard')))),
      h('p', { class: 'muted' }, cd.num < 8 ? '冒險紀錄已自動保存。下一章已解鎖！' : ''),
      h('div', { class: 'row' }, btn('前往下一章', done, { cls: 'primary' }))));
    layer.open();
  });
}

export function showGameOver(): Promise<'retry' | 'load' | 'title'> {
  return new Promise((resolve) => {
    audio.stopMusic(0.4);
    const layer = new Layer('game-over', true);
    const done = (v: 'retry' | 'load' | 'title') => { layer.close(); resolve(v); };
    layer.el.append(h('div', { class: 'paper-card over-card' },
      h('h2', {}, '冒險暫停了…'),
      h('p', {}, '大家都累倒了。要再試一次嗎？'),
      h('div', { class: 'col' },
        btn('再挑戰一次', () => done('retry'), { cls: 'primary' }),
        btn('讀取上次存檔', () => done('load')),
        btn('回到主選單', () => done('title'), { sfx: 'cancel' }))));
    layer.open();
  });
}
