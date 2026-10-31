/** Ending: the world regains its colour, a celebration in the village, the group photo, then credits. */
import { G } from '../../core/game';
import { wait } from '../../core/util';
import { CHAR_IDS, CHARACTERS } from '../../data/characters';
import { portraitURL } from '../../art/textures';
import { renderFrame, basePose } from '../../art/characterArt';
import { input } from '../../input/input';
import { audio } from '../../systems/audio';
import { h } from '../dom';
import { uiIcon } from '../../art/uiIcons';
import { CREDITS } from './credits';

export async function playEnding(): Promise<void> {
  input.block('ending');
  audio.playMusic('ending');
  const root = h('div', { class: 'ending' });
  document.getElementById('fx-overlay')!.append(root);
  const skip = h('button', { class: 'ending-skip', type: 'button' }, '跳過', uiIcon('play'));
  let skipped = false;
  skip.addEventListener('click', () => { skipped = true; });
  const offSkip = input.onPress((b) => { if (b === 'cancel') skipped = true; return true; });
  root.append(skip);
  const pause = async (ms: number) => { const t0 = performance.now(); while (!skipped && performance.now() - t0 < ms) await wait(50); };

  const scene = (cls: string, ...kids: (Node | string)[]) => {
    const el = h('div', { class: `end-scene ${cls}` }, ...kids);
    root.append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    return el;
  };
  const say = (t: string) => h('div', { class: 'end-text' }, t);

  const s1 = scene('end-sky', say('星之心的光芒灑落在拓麻歌子星球上。'), say('灰色的天空，重新染上了顏色。'));
  await pause(4200);
  s1.classList.add('out');
  const s2 = scene('end-color', say('糖果森林、天空島、玩具工廠、夢幻海洋、夢幻城堡……'), say('每個地方的居民，都想起了自己的名字和夢想。'));
  await pause(4500);
  s2.classList.add('out');
  const s3 = scene('end-party', say('那天晚上，村莊舉辦了盛大的慶祝會。'));
  const row = h('div', { class: 'end-dancers' });
  for (const id of CHAR_IDS) {
    const img = h('img', { src: portraitURL({ charId: id }, 'happy'), alt: CHARACTERS[id].name, class: 'dancer' });
    row.append(img);
  }
  s3.append(row, say('永恆吉也來了。他和老爺爺吉並肩坐著，聽大家的笑聲。'));
  await pause(5200);
  s3.classList.add('out');

  // group photo
  const s4 = scene('end-photo');
  const frame = h('div', { class: 'photo-frame' });
  const cvs = document.createElement('canvas');
  cvs.width = 960;
  cvs.height = 520;
  const g = cvs.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 520);
  gr.addColorStop(0, '#8ad0ff'); gr.addColorStop(0.6, '#fff0c8'); gr.addColorStop(1, '#8acb6a');
  g.fillStyle = gr; g.fillRect(0, 0, 960, 520);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(80 + i * 170, 80 + (i % 2) * 30, 30, 0, Math.PI * 2); g.arc(110 + i * 170, 70 + (i % 2) * 30, 38, 0, Math.PI * 2); g.fill(); }
  const order = ['oyajitchi', 'memetchi', 'kuchipatchi', 'mametchi', 'mimitchi', 'violetchi', 'gozarutchi', 'maskutchi'] as const;
  order.forEach((id, i) => {
    const pose = basePose({ facing: 'front', expr: 'happy', armL: id === 'mametchi' ? 2.6 : 0.6, armR: id === 'mametchi' ? -2.6 : -0.6, bob: id === 'mametchi' ? 8 : 0 });
    const f = renderFrame({ charId: id }, pose, 'photo' + id);
    const back = i % 2 === 0;
    g.imageSmoothingEnabled = false;
    g.drawImage(f, 40 + i * 110, back ? 250 : 300, back ? 150 : 170, back ? 150 : 170);
  });
  const et = renderFrame({ npc: { species: 'eternatchi', color: '#fffbe6', accent: '#5b35b5' } }, basePose({ facing: 'front', expr: 'happy' }), 'photoEt');
  g.drawImage(et, 400, 160, 150, 150);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = 'bold 30px sans-serif';
  g.fillText(`和 ${G.local?.playerName ?? '你'} 一起的冒險～`, 30, 500);
  frame.append(cvs);
  s4.append(say('「大家，看這邊～！」'), frame);
  await pause(1600);
  audio.sfx('photo');
  const flash = h('div', { class: 'photo-flash' });
  s4.append(flash);
  frame.classList.add('snap');
  await pause(4800);
  s4.classList.add('out');

  // credits roll
  const s5 = scene('end-credits');
  const roll = h('div', { class: 'credits-roll' }, h('h1', {}, '拓麻歌子紙片大冒險'), h('h2', {}, '失落的星之心　完'), ...CREDITS.map((c) => h('div', { class: 'credit' }, h('b', {}, c[0]), h('span', {}, c[1]))), h('h2', {}, 'THANK YOU FOR PLAYING!'));
  s5.append(roll);
  await pause(20000);
  offSkip();
  root.classList.add('out');
  await wait(600);
  root.remove();
  input.unblock('ending');
}
