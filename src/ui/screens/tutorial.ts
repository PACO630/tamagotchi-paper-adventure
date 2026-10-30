/** Picture-based controls tutorial — separate pages for keyboard (desktop) and touch (phone). */
import { isCoarse } from '../../core/device';
import { tutorialPic, type TutorialPic } from '../../art/tutorialArt';
import { audio } from '../../systems/audio';
import { btn, h, Layer } from '../dom';
import { openHelp } from './help';

interface Page { pic: TutorialPic; title: string; text: string }

const PC: Page[] = [
  { pic: 'pc-move', title: '移動', text: '用 W A S D 或方向鍵走動，往上下可以走進畫面深處。按住 Shift 可以奔跑。' },
  { pic: 'pc-action', title: '跳躍與鎚子', text: 'Space 跳躍，可以跳過小水溝、踩敵人先制攻擊。J 或 X 揮鎚子，能敲碎裂開的方塊。' },
  { pic: 'pc-talk', title: '調查與對話', text: '靠近角色、寶箱或告示牌，頭上出現泡泡時按 Enter（或 E）就能對話、打開寶箱。' },
  { pic: 'pc-battle', title: '戰鬥的按鍵時機', text: '攻擊和防禦時都會出現光圈。光圈縮到中間的瞬間按下 Enter，就能打出更多傷害或擋下攻擊！' },
  { pic: 'pc-menu', title: '選單與道具', text: 'Esc 打開選單：背包、角色、任務、地圖和存檔。Q 可以快速使用回復道具。' },
];

const MOBILE: Page[] = [
  { pic: 'mb-move', title: '移動', text: '在畫面左半邊按住並拖曳，搖桿會出現在手指下方。推到底可以奔跑。' },
  { pic: 'mb-action', title: '跳躍與鎚子', text: '右下角 A 跳躍、B 揮鎚子。跳到敵人頭上或用鎚子打到敵人，戰鬥會先制攻擊。' },
  { pic: 'mb-talk', title: '調查與對話', text: '靠近角色或寶箱時按 OK，或直接點角色頭上的泡泡。對話時點對話框翻頁。' },
  { pic: 'mb-battle', title: '戰鬥的點擊時機', text: '戰鬥指令直接點選單。出現光圈時，在光圈縮到中間的瞬間點一下畫面，攻擊更痛、防禦更穩！' },
  { pic: 'mb-menu', title: '選單與道具', text: '右上角的按鈕打開選單（背包、任務、存檔）。上方的道具欄點一下就能使用回復道具。' },
];

export function openTutorial(): Promise<void> {
  return new Promise((resolve) => {
    const pages = isCoarse() ? MOBILE : PC;
    const layer = new Layer('screen tutorial-screen');
    let i = 0;
    const img = h('img', { class: 'tut-pic', alt: '' }) as HTMLImageElement;
    const title = h('h3', { class: 'tut-title' });
    const text = h('p', { class: 'tut-text' });
    const dots = h('div', { class: 'tut-dots' });
    const nav = h('div', { class: 'row' });
    const close = () => { layer.close(); resolve(); };
    layer.onCancel = close;
    const render = () => {
      const p = pages[i];
      img.src = tutorialPic(p.pic);
      title.textContent = `${i + 1}. ${p.title}`;
      text.textContent = p.text;
      dots.innerHTML = '';
      pages.forEach((_, k) => dots.append(h('i', { class: k === i ? 'on' : '' })));
      nav.innerHTML = '';
      nav.append(btn('跳過', close, { cls: 'small', sfx: 'cancel' }));
      if (i > 0) nav.append(btn('上一頁', () => { i--; render(); }, { sfx: 'click' }));
      if (i < pages.length - 1) nav.append(btn('下一頁', () => { i++; render(); }, { cls: 'primary', sfx: 'click' }));
      else nav.append(btn('[play]開始冒險！', () => { audio.sfx('levelup'); close(); }, { cls: 'primary' }));
      nav.append(btn('更多說明', () => void openHelp(), { cls: 'small', sfx: 'click' }));
      layer.focusFirst();
    };
    layer.el.append(h('div', { class: 'paper-card tut-card' },
      h('h2', {}, isCoarse() ? '操作說明（手機）' : '操作說明（電腦）'),
      img, title, text, dots, nav));
    layer.open();
    render();
  });
}
