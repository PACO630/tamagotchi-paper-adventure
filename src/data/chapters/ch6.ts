import type { ChapterDef } from '../types';
import { FLAG, FLASH, GIVE, JOIN, L, LOOKS, MUSIC, N, QS, SFX, SHAKE, WAIT } from './helpers';

export const ch6: ChapterDef = {
  id: 'ch6', num: 6, title: '第六章：夢幻城堡', location: '夢幻城堡',
  summary: '這座城堡保存著拓麻歌子世界的歷史。在這裡，麻美吉將知道星之心真正的秘密。',
  music: 'castle', weather: 'dust', width: 6600, start: { x: 180, z: 130 },
  theme: {
    id: 'castle', skyTop: 0x2a1a4a, skyBottom: 0x8a5a9a, far: 0x5a4a7a, farAccent: 0x8a6ad8, mid: 0x6a5a8a, midAccent: 0xffc84a,
    ground: 0xb8a8d0, groundAccent: 0x7a6aa0, groundEdge: 0xd8c8f0, pitColor: 0x1a0a2a, light: 0xffe0a0, ambient: 0xe8e0ff,
    sun: 'moon', farShape: 'castle', midShape: 'towers', groundPattern: 'stone',
  },
  mapNodes: [{ name: '城門', x: 200 }, { name: '畫廊', x: 1300 }, { name: '鏡子迷宮', x: 2600 }, { name: '記憶大廳', x: 4300 }, { name: '王座廳', x: 6100 }],
  intro: [
    MUSIC('castle'),
    N('夜色中的夢幻城堡。窗戶裡沒有一點光，走廊上飄著輕輕的歌聲。'),
    L('mimitchi', '有……有人在哭的聲音……', 'worried'),
    L('maskutchi', '幽、幽靈什麼的，正義英雄才不怕呢！', 'worried'),
    L('hero', '這裡保存著世界的歷史。也許能找到「王冠之人」的線索。', 'determined'),
  ],
  props: [
    { t: 'castle_tower', x: 150, z: -40, layer: 'back' }, { t: 'banner', x: 450, z: 0 }, { t: 'candelabra', x: 700, z: 30 }, { t: 'castle_window', x: 1000, z: -10, layer: 'back' },
    { t: 'bookshelf', x: 1300, z: -10, layer: 'back' }, { t: 'banner', x: 1600, z: 0 }, { t: 'mirror', x: 2400, z: 0 }, { t: 'mirror', x: 2900, z: 0 },
    { t: 'mirror', x: 3400, z: 0 }, { t: 'castle_window', x: 3800, z: -10, layer: 'back' }, { t: 'bookshelf', x: 4200, z: -10, layer: 'back' }, { t: 'candelabra', x: 4700, z: 30 },
    { t: 'banner', x: 5200, z: 0 }, { t: 'castle_tower', x: 5600, z: -40, layer: 'back' }, { t: 'banner', x: 6000, z: 0 }, { t: 'banner', x: 6400, z: 0 },
    { t: 'candelabra', x: 1100, z: 240, layer: 'front' }, { t: 'candelabra', x: 5000, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'violetchi', name: '紫羅蘭吉', look: 'violetchi', x: 1300, z: 140, showIf: '!joined:violetchi', talk: [{ script: [
      L('violetchi', '別過來……我的畫……我的畫全都變成灰色了……', 'sad'),
      L('hero', '紫羅蘭吉！只要找回星之心，顏色就會回來的！', 'determined'),
      L('violetchi', '……真的嗎？那我要親眼看著它回來。我也要去！', 'determined'),
      L('violetchi', '我的顏料可以讓敵人看不見，也能畫出保護大家的盾牌。', 'happy'),
      JOIN('violetchi'), SFX('join'), N('紫羅蘭吉成為了夥伴！「色彩守護」可以抵擋傷害。'),
    ] }] },
    { id: 'friendly_ghost', name: '友善的幽靈', look: LOOKS.ghost, x: 2000, z: 190, talk: [
      { if: '!quest:s6_candles&!done:s6_candles', script: [L('friendly_ghost', '嗚嗚……我忘記自己的名字了。聽說點亮記憶蠟燭就能想起來……可以幫我找 2 根嗎？', 'sad'), QS('s6_candles')] },
      { if: 'quest:s6_candles', script: [L('friendly_ghost', '蠟燭……在城堡的某個角落……', 'worried')] },
      { script: [L('friendly_ghost', '我想起來了！我叫做「小咕」！謝謝你們！', 'happy')] },
    ] },
    { id: 'historian', name: '城堡史官', look: LOOKS.sage, x: 4250, z: 170, talk: [
      { if: '!ch6_memory_done', script: [
        L('historian', '這座大廳記錄著世界的歷史。這頁寫著……', 'normal'),
        N('「很久以前，星之心由一位守護者照顧。他聆聽世上所有的心聲——喜悅，以及悲傷。」'),
        L('historian', '想看下去，就要依照「星→月→花→心」的順序點亮記憶燭台。', 'normal'), QS('q6_memory'),
      ] },
      { script: [L('historian', '那位守護者的名字叫做「永恆吉」……後來，他就消失了。', 'sad')] },
    ] },
  ],
  enemies: [
    { id: 'e6a', enemy: 'sheet_ghost', party: ['sheet_ghost', 'candle_imp'], x: 850, z: 110 },
    { id: 'e6b', enemy: 'empty_armor', party: ['empty_armor', 'sheet_ghost'], x: 1900, z: 90 },
    { id: 'e6c', enemy: 'candle_imp', party: ['candle_imp', 'candle_imp', 'sheet_ghost'], x: 3700, z: 150 },
    { id: 'e6d', enemy: 'empty_armor', party: ['empty_armor', 'empty_armor'], x: 4900, z: 120 },
    { id: 'e6e', enemy: 'sheet_ghost', party: ['sheet_ghost', 'empty_armor', 'candle_imp'], x: 5500, z: 170 },
  ],
  chests: [
    { id: 'c6_1', x: 550, z: 50, items: [{ id: 'sticker_16', qty: 1 }] },
    { id: 'c6_h1', x: 1700, z: 200, items: [{ id: 'candle', qty: 1 }], hidden: true },
    { id: 'c6_secret', x: 2200, z: 120, items: [{ id: 'sticker_17', qty: 1 }, { id: 'b_star', qty: 1 }], showIf: 'ch6_secret' },
    { id: 'c6_2', x: 3500, z: 200, items: [{ id: 'candle', qty: 1 }, { id: 'cake', qty: 1 }] },
    { id: 'c6_h2', x: 5100, z: 60, items: [{ id: 'sticker_18', qty: 1 }, { id: 'elixir', qty: 1 }], hidden: true },
    { id: 'c6_3', x: 5800, z: 200, items: [{ id: 'life_mushroom', qty: 1 }, { id: 'star_candy', qty: 2 }] },
  ],
  objects: [
    { id: 'sign61', type: 'sign', x: 380, z: 170, text: '「鏡子不會說謊，但也不會說出全部的真相。」' },
    { id: 'save61', type: 'savepoint', x: 1100, z: 60 },
    { id: 'secret_wall', type: 'breakable', x: 2150, z: 40, flag: 'ch6_secret' },
    { id: 'sign62', type: 'sign', x: 2450, z: 190, text: '鏡子迷宮：三扇門只有一扇是真的。提示：「真實的門，總是在你最不想走的地方——最裡面。」' },
    { id: 'door_a', type: 'door', x: 2650, z: 200, to: { x: 2500, z: 130 }, text: '前面的門' },
    { id: 'door_b', type: 'door', x: 2800, z: 120, to: { x: 2500, z: 130 }, text: '中間的門' },
    { id: 'door_c', type: 'door', x: 2950, z: 30, to: { x: 3300, z: 130 }, flag: 'ch6_mirror_done', text: '最裡面的門' },
    { id: 'gate61', type: 'gate', x: 3100, z: 0, cond: 'ch6_mirror_done', w: 1 },
    { id: 'm_star', type: 'switch', x: 4450, z: 60, group: 'memory', order: 1, text: '星', flag: 'ch6_m1' },
    { id: 'm_moon', type: 'switch', x: 4600, z: 190, group: 'memory', order: 2, text: '月', flag: 'ch6_m2' },
    { id: 'm_flower', type: 'switch', x: 4750, z: 70, group: 'memory', order: 3, text: '花', flag: 'ch6_m3' },
    { id: 'm_heart', type: 'switch', x: 4900, z: 200, group: 'memory', order: 4, text: '心', flag: 'ch6_memory_done' },
    { id: 'gate62', type: 'gate', x: 5300, z: 0, cond: 'ch6_memory_done', w: 1 },
    { id: 'heal61', type: 'heal', x: 5700, z: 110 },
    { id: 'save62', type: 'savepoint', x: 5850, z: 60 },
    { id: 'shard6', type: 'shard', x: 6400, z: 120, showIf: 'boss6&!shard6_got' },
  ],
  zones: [{ type: 'dark', x: 2400, w: 800 }],
  platforms: [],
  triggers: [
    { id: 't6_maze', x: 2500, w: 60, if: '!quest:q6_mirror&!done:q6_mirror', once: true, script: [L('violetchi', '好多鏡子……每一面都映著我們。', 'worried'), QS('q6_mirror')] },
    { id: 't6_mirror_done', x: 3250, w: 100, if: 'ch6_mirror_done&!t6_md', once: true, script: [FLAG('t6_md'), L('hero', '出來了！果然是最裡面那扇門！', 'happy')] },
    { id: 't6_page', x: 5250, w: 80, if: 'ch6_memory_done&!item:memory_page', once: true, script: [
      GIVE('memory_page'), SFX('item'),
      N('記憶之頁：「守護者永恆吉聽了太多悲傷的聲音。某一天，他說：『如果世界不再改變，就不會再有離別。』」'),
      L('hero', '永恆吉……他就是「王冠之人」！', 'surprised'),
      L('violetchi', '他不是壞人……他只是太累了。', 'sad'),
    ] },
  ],
  boss: {
    id: 'boss6', enemy: 'castle_knight', party: ['castle_knight'], x: 6150, z: 120, flag: 'boss6', music: 'boss',
    pre: [
      QS('q6_boss'), SHAKE(800), SFX('shake'),
      L('castle_knight', '……我在守護什麼？……我是誰？……不管了。闖入者，消失吧！', 'angry'),
      L('hero', '騎士先生！你一定是守護這座城堡歷史的人！', 'determined'),
      { do: 'battle', encounter: ['castle_knight'], boss: true, flag: 'boss6', music: 'boss' },
    ],
    post: [
      L('castle_knight', '……我想起來了。我發誓過，要守護大家的「記憶」。', 'sad'),
      L('castle_knight', '永恆吉大人曾是我的主人。他把碎片交給我，說：「讓城堡的時間永遠停住吧。」', 'normal'),
      L('castle_knight', '但是被停住的記憶，就只是灰塵而已。拿去吧，孩子。', 'normal'),
      SFX('shard'), N('騎士的長槍上，掛著一塊紫色的碎片。'),
    ],
  },
  outro: [
    FLAG('shard6_got'), GIVE('shard6'), SFX('shard'), FLASH(0xfff6a0),
    N('取得了星之心碎片（6/8）！城堡的窗戶一扇扇亮了起來。'),
    SHAKE(600), SFX('shake'),
    L('shadow', '……你們，到此為止了。', 'normal'),
    N('城堡的地板裂開，一道黑色的門出現了。門後是一片扭曲的黑暗——'),
    L('hero', '感應器的指針……指向那扇門裡面！', 'determined'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q6_mirror', 'q6_memory', 'q6_boss', 's6_candles'],
  partner: 'violetchi',
};

void MUSIC;
