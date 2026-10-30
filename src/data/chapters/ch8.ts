import type { ChapterDef } from '../types';
import { FLAG, FLASH, GIVE, L, LOOKS, MUSIC, N, QS, SFX, SHAKE, WAIT } from './helpers';

export const ch8: ChapterDef = {
  id: 'ch8', num: 8, title: '第八章：星之心的真相', location: '最終星之神殿',
  summary: '星空最高處的神殿。所有夥伴的力量，將在這裡合而為一。',
  music: 'temple', weather: 'stars', width: 6200, start: { x: 180, z: 130 },
  theme: {
    id: 'temple', skyTop: 0x1a1450, skyBottom: 0x8a6ac8, far: 0x4a3a8a, farAccent: 0xffd23a, mid: 0x6a5aa8, midAccent: 0xfff6a0,
    ground: 0xf8f0d8, groundAccent: 0xffd23a, groundEdge: 0xfff8e0, pitColor: 0x0a0830, light: 0xfff0c0, ambient: 0xfff8f0,
    sun: 'star', farShape: 'pillars', midShape: 'stars', groundPattern: 'marble',
  },
  mapNodes: [{ name: '星之階梯', x: 200 }, { name: '第一封印', x: 1500 }, { name: '第二封印', x: 3000 }, { name: '第三封印', x: 4300 }, { name: '星之心祭壇', x: 5800 }],
  intro: [
    MUSIC('temple'),
    N('七塊碎片發出光芒，在夜空中鋪出一條星星的階梯。階梯的盡頭，是最終星之神殿。'),
    L('mimitchi', '好安靜……一點聲音都沒有。', 'worried'),
    L('violetchi', '連星星都不會眨眼了。這就是「不會改變的世界」嗎？', 'sad'),
    L('hero', '大家，最後一塊碎片就在這裡。我們一起，把星之心找回來！', 'determined'),
    QS('q8_seals'),
  ],
  props: [
    { t: 'star_pillar', x: 150, z: -30, layer: 'back' }, { t: 'star_lamp', x: 450, z: 30 }, { t: 'gold_arch', x: 900, z: -40, layer: 'back' }, { t: 'star_pillar', x: 1300, z: -30, layer: 'back' },
    { t: 'star_lamp', x: 1700, z: 30 }, { t: 'star_pillar', x: 2500, z: -30, layer: 'back' }, { t: 'star_lamp', x: 2900, z: 30 }, { t: 'gold_arch', x: 3500, z: -40, layer: 'back' },
    { t: 'star_pillar', x: 4100, z: -30, layer: 'back' }, { t: 'star_lamp', x: 4600, z: 30 }, { t: 'star_altar', x: 5900, z: -20, layer: 'back' }, { t: 'star_pillar', x: 5400, z: -30, layer: 'back' },
    { t: 'star_lamp', x: 1000, z: 240, layer: 'front' }, { t: 'star_lamp', x: 3800, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'star_spirit', name: '星之精靈', look: LOOKS.light, x: 700, z: 160, talk: [
      { script: [L('star_spirit', '三道封印由永恆吉的哨兵守護著。用鎚子敲響封印石，就能解開。', 'normal'), L('star_spirit', '神殿裡的時間是停止的……但你們的心跳聲，我聽得很清楚。', 'happy')] },
    ] },
  ],
  enemies: [
    { id: 'e8a', enemy: 'star_sentinel', party: ['star_sentinel', 'fallen_star'], x: 1100, z: 120 },
    { id: 'e8b', enemy: 'fallen_star', party: ['fallen_star', 'fallen_star'], x: 2300, z: 160 },
    { id: 'e8c', enemy: 'star_sentinel', party: ['star_sentinel', 'star_sentinel', 'fallen_star'], x: 3300, z: 90 },
    { id: 'e8d', enemy: 'eternal_shade', party: ['eternal_shade', 'fallen_star', 'eternal_shade'], x: 4000, z: 170 },
    { id: 'e8e', enemy: 'star_sentinel', party: ['star_sentinel', 'eternal_shade', 'fallen_star'], x: 5000, z: 120 },
  ],
  chests: [
    { id: 'c8_1', x: 550, z: 50, items: [{ id: 'sticker_22', qty: 1 }, { id: 'feast', qty: 1 }] },
    { id: 'c8_h1', x: 1900, z: 200, items: [{ id: 'sticker_23', qty: 1 }, { id: 'elixir', qty: 1 }], hidden: true },
    { id: 'c8_2', x: 3650, z: 40, items: [{ id: 'life_mushroom', qty: 2 }, { id: 'star_candy', qty: 2 }] },
    { id: 'c8_h2', x: 4800, z: 210, items: [{ id: 'sticker_24', qty: 1 }, { id: 'b_star', qty: 1 }], hidden: true },
    { id: 'c8_3', x: 5450, z: 200, items: [{ id: 'elixir', qty: 2 }, { id: 'feast', qty: 1 }] },
  ],
  objects: [
    { id: 'save81', type: 'savepoint', x: 900, z: 60 },
    { id: 'seal1', type: 'switch', x: 1500, z: 120, flag: 'ch8_seal1', text: '封印一' },
    { id: 'seal2', type: 'switch', x: 3050, z: 120, flag: 'ch8_seal2', text: '封印二' },
    { id: 'seal3', type: 'switch', x: 4350, z: 120, flag: 'ch8_seal3', text: '封印三' },
    { id: 'gate81', type: 'gate', x: 5150, z: 0, cond: 'ch8_seal1&ch8_seal2&ch8_seal3', w: 1 },
    { id: 'heal81', type: 'heal', x: 5300, z: 120 },
    { id: 'save82', type: 'savepoint', x: 5400, z: 60 },
  ],
  zones: [
    { type: 'pit', x: 2000, w: 400, z0: 0, z1: 240, look: 'stars' },
    { type: 'pit', x: 3700, w: 280, z0: 0, z1: 240, look: 'stars' },
    { type: 'wind', x: 4450, w: 400, fx: -100 },
  ],
  platforms: [
    { id: 'st1', x: 2060, z: 120, w: 110, d: 60, dz: 90, period: 2.6, look: 'star' },
    { id: 'st2', x: 2200, z: 120, w: 110, d: 60, dx: 40, dz: -80, period: 3.2, look: 'star' },
    { id: 'st3', x: 2330, z: 120, w: 110, d: 60, dz: 90, period: 2.2, look: 'star' },
    { id: 'st4', x: 3770, z: 120, w: 110, d: 60, dz: -90, period: 2.4, look: 'star' },
    { id: 'st5', x: 3900, z: 120, w: 110, d: 60, dz: 90, period: 2.8, look: 'star' },
  ],
  triggers: [
    { id: 't8_seals', x: 5100, w: 60, if: 'ch8_seal1&ch8_seal2&ch8_seal3&!t8_open', once: true, script: [FLAG('t8_open'), SHAKE(500), SFX('shard'), L('hero', '三道封印都解開了！祭壇就在前面！', 'determined'), QS('q8_final')] },
  ],
  boss: {
    id: 'boss8', enemy: 'eternatchi', party: ['eternatchi'], x: 5750, z: 120, flag: 'boss8', music: 'final',
    pre: [
      SHAKE(900), SFX('shake'),
      L('eternatchi', '歡迎來到停止的世界。在這裡，沒有人會老去，沒有人會分開。', 'normal'),
      L('oyajitchi', '永恆吉，你看看這裡。花不會開，星星不會眨眼。這不是你想守護的世界！', 'sad'),
      L('eternatchi', '我聽了好幾千年的心聲……每一聲「再見」，都像碎片一樣刺進我的心裡。', 'sad'),
      L('hero', '可是也有很多「你好」和「謝謝」啊！改變會帶來離別，也會帶來相遇！', 'determined'),
      L('eternatchi', '……那就用你們的力量證明給我看吧！', 'angry'),
      { do: 'battle', encounter: ['eternatchi'], boss: true, flag: 'boss8', music: 'final' },
    ],
    post: [
      L('eternatchi', '……好溫暖。這就是……大家的心嗎？', 'sad'),
      L('eternatchi', '我一直害怕改變，所以想把一切都停下來。結果，我讓最重要的大家都哭了。', 'sad'),
      L('oyajitchi', '老朋友，回來吧。悲傷的聲音，以後我們一起聽。', 'happy'),
      L('eternatchi', '……嗯。孩子們，對不起。也謝謝你們。', 'happy'),
      SFX('shard'), FLASH(0xffffff), N('永恆吉的胸口，亮起了最後一塊碎片。'),
    ],
  },
  outro: [
    FLAG('shard8_got'), GIVE('shard8'), SFX('shard'), FLASH(0xffffff),
    N('八塊碎片在空中聚集，發出了比太陽還要溫暖的光——'),
    L('guardian_voice', '謝謝你們。記憶、夢想和心情……全部都回來了。', 'happy'),
    N('星之心恢復了！光芒灑落在整個拓麻歌子星球上。'),
    WAIT(400), { do: 'ending' },
  ],
  quests: ['q8_seals', 'q8_final'],
};

void MUSIC; void GIVE;
