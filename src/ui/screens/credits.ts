/** Credits screen + data shared with the ending roll. */
import { APP_VERSION } from '../../core/config';
import { btn, h, Layer } from '../dom';

export const AUTHOR = '@paco._0630';

export const CREDITS: [string, string][] = [
  ['作者', AUTHOR],
  ['遊戲企劃・程式・關卡設計', AUTHOR],
  ['角色美術', 'MS Paint 烂涂鸦程序繪製（hand-drawn-styles 第 5 號畫風配方）'],
  ['場景美術', '程序生成紙雕場景'],
  ['音樂・音效', '原創 WebAudio 合成器作曲'],
  ['技術', 'TypeScript・Vite・Phaser 3・PeerJS (WebRTC)・IndexedDB'],
  ['畫風 Skill', 'threerocks/hand-drawn-styles (MIT)'],
  ['特別感謝', '每一位玩到最後的你'],
  ['聲明', '本作為非商業粉絲作品。「Tamagotchi／拓麻歌子」為 BANDAI 之商標，角色依其概念以原創方式重新繪製。'],
];

export function openCredits(): Promise<void> {
  return new Promise((resolve) => {
    const layer = new Layer('screen credits-screen');
    const close = () => { layer.close(); resolve(); };
    layer.onCancel = close;
    layer.el.append(h('div', { class: 'paper-card wide' },
      h('h2', {}, '製作人員'),
      h('div', { class: 'credit-list' }, ...CREDITS.map(([a, b]) => h('div', { class: 'credit' }, h('b', {}, a), h('span', {}, b)))),
      h('p', { class: 'muted' }, `版本 ${APP_VERSION}　作者 ${AUTHOR}`),
      h('div', { class: 'row' }, btn('返回', close, { cls: 'primary', sfx: 'cancel' }))));
    layer.open();
  });
}
