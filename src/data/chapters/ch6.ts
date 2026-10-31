import type { ChapterDef, NpcLook, PropDef, Script } from '../types';
import {
  BOOK, CAP, CINE, DESPAWN, EMOTE, FACE, FLAG, FLASH, FOLLOW, FX, GIVE, IF, JOIN, JUMP, L, LOOKS, MUSIC, N, PAN, PL, QS, SFX, SHAKE, SPAWN,
  WAIT, WALK, WALKN,
} from './helpers';

const VIO_JOIN: Script = [
  CINE(),
  L('violetchi', '別過來……我的畫……我的畫全都變成灰色了……', 'sad'),
  L('hero', '紫羅蘭吉！只要找回星之心，顏色就會回來的！', 'determined'),
  L('violetchi', '……真的嗎？那我要親眼看著它回來。我也要去！', 'determined'),
  L('violetchi', '而且，只要還記得原本的樣子，我的畫筆就能把灰色的輪廓畫回真的東西喔！', 'happy'),
  JOIN('violetchi'), SFX('join'), N('紫羅蘭吉成為了夥伴！能力「彩繪」：把灰色虛線的輪廓畫回真正的橋、門和平台。'),
];

/** The portrait gallery: a side room where three paintings remember the candle order. */
const ROOM_X = 6900;
const ROOM_PROPS: PropDef[] = [
  { t: 'castle_window', x: ROOM_X + 250, z: -20, layer: 'back' }, { t: 'banner', x: ROOM_X + 520, z: -30, layer: 'back' }, { t: 'candelabra', x: ROOM_X + 700, z: 20 },
  { t: 'castle_window', x: ROOM_X + 1100, z: -20, layer: 'back' }, { t: 'bookshelf', x: ROOM_X + 1350, z: -10, layer: 'back' }, { t: 'candelabra', x: ROOM_X + 1650, z: 20 },
  { t: 'banner', x: ROOM_X + 1800, z: -30, layer: 'back' }, { t: 'mirror', x: ROOM_X + 1900, z: 0 },
];
const PORTRAIT_QUEEN: NpcLook = { color: '#ffd0f0', accent: '#a040c0', ears: 'bunny', hat: 'crown' };
const PORTRAIT_KNIGHT: NpcLook = { color: '#c0c8e0', accent: '#4060c0', ears: 'pointy', hat: 'helmet' };
const PORTRAIT_YOUNG: NpcLook = { color: '#ffffc0', accent: '#4000c0', ears: 'horn', hat: 'crown' };

const CLUES_DONE = 'ch6_clue1&ch6_clue2&ch6_clue3';

/** The memory door asks three questions about everything the shards have shown so far. */
const QUIZ: Script = [
  CINE(),
  L('door_spirit', '我是記憶之門。想通過的話，就回答我三個問題。', 'normal'),
  { label: 'q1' },
  { choice: [
    { text: '大家的心聲', goto: 'q2' },
    { text: '星星的腳步聲', goto: 'w1' },
    { text: '城堡的鐘聲', goto: 'w1' },
  ], who: 'door_spirit', prompt: '第一題：戴王冠的守護者，能聽見什麼？' },
  { label: 'w1' }, L('door_spirit', '……不對。回想第一塊碎片給你看的回憶吧。', 'sad'), { goto: 'q1' },
  { label: 'q2' }, L('door_spirit', '正確。', 'happy'),
  { choice: [
    { text: '一隻迷路的小貓', goto: 'w2' },
    { text: '一顆從天上掉下來的小星星', goto: 'q3' },
    { text: '一朵會唱歌的花', goto: 'w2' },
  ], who: 'door_spirit', prompt: '第二題：守護者細心照顧的「小光」，是什麼？' },
  { label: 'w2' }, L('door_spirit', '……不對。天空島的回憶裡，有答案。', 'sad'), { goto: 'q2' },
  { label: 'q3' }, L('door_spirit', '正確。', 'happy'),
  { choice: [
    { text: '因為想當全世界的國王', goto: 'w3' },
    { text: '因為討厭顏色', goto: 'w3' },
    { text: '因為不想再聽到「再見」', goto: 'ok' },
  ], who: 'door_spirit', prompt: '最後一題：守護者為什麼想讓世界停下來？' },
  { label: 'w3' }, L('door_spirit', '……不對。他不是壞人。想想他哭的理由。', 'sad'), { goto: 'q3' },
  { label: 'ok' },
  L('door_spirit', '……你真的有好好看著他的回憶。記憶之門，為你打開。', 'happy'),
  FLAG('ch6_quiz_done'), SFX('quest'),
  CINE(false),
];

export const ch6: ChapterDef = {
  id: 'ch6', num: 6, title: '第六章：夢幻城堡', location: '夢幻城堡',
  summary: '這座城堡保存著拓麻歌子世界的歷史。在這裡，麻美吉將知道「王冠之人」真正的名字。',
  music: 'castle', weather: 'dust', width: 6600, start: { x: 180, z: 130 }, grey: -0.6,
  theme: {
    id: 'castle', skyTop: 0x2a1a4a, skyBottom: 0x8a5a9a, far: 0x5a4a7a, farAccent: 0x8a6ad8, mid: 0x6a5a8a, midAccent: 0xffc84a,
    ground: 0xb8a8d0, groundAccent: 0x7a6aa0, groundEdge: 0xd8c8f0, pitColor: 0x1a0a2a, light: 0xffe0a0, ambient: 0xe8e0ff,
    sun: 'moon', farShape: 'castle', midShape: 'towers', groundPattern: 'stone',
  },
  mapNodes: [{ name: '城門', x: 200 }, { name: '畫廊', x: 1300 }, { name: '鏡子迷宮', x: 2600 }, { name: '記憶大廳', x: 4300 }, { name: '王座廳', x: 6100 }],
  intro: [
    MUSIC('castle'),
    CINE(),
    N('夜色中的夢幻城堡。窗戶裡沒有一點光，走廊上飄著輕輕的歌聲。'),
    PL('mimitchi', '有……有人在哭的聲音……', 'worried'),
    PL('maskutchi', '幽、幽靈什麼的，正義英雄才不怕呢！', 'worried'),
    PAN(1300, 1400), CAP('走廊的盡頭，有人抱著畫板，蹲在地上。', 2200), FOLLOW(800),
    L('hero', '這裡保存著世界的歷史。也許能找到「王冠之人」的線索。', 'determined'),
    CINE(false),
  ],
  props: [
    { t: 'castle_tower', x: 150, z: -40, layer: 'back' }, { t: 'banner', x: 450, z: 0 }, { t: 'candelabra', x: 700, z: 30 }, { t: 'castle_window', x: 1000, z: -10, layer: 'back' },
    { t: 'bookshelf', x: 1300, z: -10, layer: 'back' }, { t: 'banner', x: 1600, z: 0 }, { t: 'mirror', x: 2400, z: 0 }, { t: 'mirror', x: 2900, z: 0 },
    { t: 'mirror', x: 3400, z: 0 }, { t: 'castle_window', x: 3800, z: -10, layer: 'back' }, { t: 'bookshelf', x: 4200, z: -10, layer: 'back' }, { t: 'candelabra', x: 4700, z: 30 },
    { t: 'banner', x: 5200, z: 0 }, { t: 'castle_tower', x: 5600, z: -40, layer: 'back' }, { t: 'banner', x: 6000, z: 0 }, { t: 'banner', x: 6400, z: 0 },
    { t: 'candelabra', x: 1100, z: 240, layer: 'front' }, { t: 'candelabra', x: 5000, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'violetchi', name: '紫羅蘭吉', look: 'violetchi', x: 1300, z: 140, showIf: '!joined:violetchi', talk: [{ script: VIO_JOIN }] },
    { id: 'friendly_ghost', name: '友善的幽靈', look: LOOKS.ghost, x: 2000, z: 190, talk: [
      { if: '!quest:s6_candles&!done:s6_candles', script: [L('friendly_ghost', '嗚嗚……我忘記自己的名字了。聽說點亮記憶蠟燭就能想起來……可以幫我找 2 根嗎？', 'sad'), QS('s6_candles')] },
      { if: 'quest:s6_candles', script: [L('friendly_ghost', '蠟燭……在城堡的某個角落……', 'worried')] },
      { script: [L('friendly_ghost', '我想起來了！我叫做「小咕」！謝謝你們！', 'happy')] },
    ] },
    { id: 'historian', name: '城堡史官', look: LOOKS.sage, x: 4250, z: 170, talk: [
      { if: '!ch6_memory_done', script: [
        L('historian', '這座大廳記錄著世界的歷史。這頁寫著……', 'normal'),
        N('「很久以前，星之心由一位守護者照顧。他聆聽世上所有的心聲——喜悅，以及悲傷。」'),
        L('historian', '想看下去，就要依照正確的順序點亮記憶燭台。', 'normal'),
        L('historian', '順序……被畫成了故事，掛在東邊的畫廊裡。去聽聽畫像們怎麼說吧。', 'normal'),
        QS('q6_memory'), QS('q6_clues'),
      ] },
      { script: [L('historian', '那位守護者的名字叫做「永恆吉」……後來，他就消失了。', 'sad')] },
    ] },
    { id: 'door_spirit', name: '記憶之門', look: LOOKS.light, x: 5180, z: 120, showIf: '!ch6_quiz_done', talk: [
      { if: '!ch6_memory_done', script: [L('door_spirit', '……先點亮記憶燭台吧。燭台會讓你想起更多事。', 'normal')] },
      { script: QUIZ },
    ] },
    { id: 'p_king', name: '國王的畫像', look: LOOKS.king, x: ROOM_X + 600, z: 30, talk: [
      { script: [L('p_king', '呵呵，好久沒有人來看我了。告訴你一個故事吧。', 'happy'), L('p_king', '這個世界的一切，都是從天上的「星」開始的。', 'normal'), FLAG('ch6_clue1'), SFX('item')] },
    ] },
    { id: 'p_queen', name: '王后的畫像', look: PORTRAIT_QUEEN, x: ROOM_X + 1150, z: 30, talk: [
      { script: [L('p_queen', '星星之後，夜空升起了溫柔的「月」，照著睡著的孩子們。', 'happy'), FLAG('ch6_clue2'), SFX('item')] },
    ] },
    { id: 'p_knight', name: '騎士的畫像', look: PORTRAIT_KNIGHT, x: ROOM_X + 1700, z: 30, talk: [
      { script: [L('p_knight', '月光下開出了「花」。最後，大家的「心」連在了一起。……我曾經發誓要守護這個故事。', 'normal'), FLAG('ch6_clue3'), SFX('item')] },
    ] },
    { id: 'p_young', name: '無名的畫像', look: PORTRAIT_YOUNG, x: ROOM_X + 1420, z: 20, talk: [
      { script: [L('p_young', '……', 'happy'), N('畫框下面刻著一行小字：「獻給永遠的守護者——永恆吉」。'), PL('violetchi', '這幅畫……好溫柔。畫的人一定很喜歡他。', 'sad')] },
    ] },
  ],
  enemies: [
    { id: 'e6a', enemy: 'sheet_ghost', party: ['sheet_ghost', 'candle_imp'], x: 850, z: 110, ai: 'ambush' },
    { id: 'e6b', enemy: 'empty_armor', party: ['empty_armor', 'sheet_ghost'], x: 1900, z: 90, ai: 'sleeper' },
    { id: 'e6c', enemy: 'candle_imp', party: ['candle_imp', 'candle_imp', 'sheet_ghost'], x: 3950, z: 150, ai: 'chaser', small: true },
    { id: 'e6d', enemy: 'empty_armor', party: ['empty_armor', 'empty_armor'], x: 4900, z: 120, ai: 'sleeper' },
    { id: 'e6e', enemy: 'sheet_ghost', party: ['sheet_ghost', 'empty_armor', 'candle_imp'], x: 5550, z: 170, ai: 'ambush' },
  ],
  chests: [
    { id: 'c6_1', x: 550, z: 50, items: [{ id: 'sticker_16', qty: 1 }] },
    { id: 'c6_h1', x: 1700, z: 200, items: [{ id: 'candle', qty: 1 }], hidden: true },
    { id: 'c6_secret', x: 2200, z: 120, items: [{ id: 'sticker_17', qty: 1 }, { id: 'b_star', qty: 1 }], showIf: 'ch6_secret' },
    { id: 'c6_2', x: 3850, z: 200, items: [{ id: 'candle', qty: 1 }, { id: 'cake', qty: 1 }] },
    { id: 'c6_h2', x: 5100, z: 60, items: [{ id: 'sticker_18', qty: 1 }, { id: 'elixir', qty: 1 }], hidden: true },
    { id: 'c6_3', x: 5800, z: 200, items: [{ id: 'life_mushroom', qty: 1 }, { id: 'star_candy', qty: 2 }] },
    { id: 'c6_room', x: ROOM_X + 1880, z: 200, items: [{ id: 'elixir', qty: 1 }, { id: 'sticker_18', qty: 1 }], hidden: true },
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
    { id: 'bridge', type: 'ability', x: 3570, z: 120, need: 'violetchi', look: 'paint_bridge', flag: 'ch6_bridge', script: [
      L('violetchi', '橋本來是這個顏色……欄杆是這樣彎的……好了！', 'happy'), JUMP('violetchi'),
      L('hero', '畫出來的橋變成真的了！', 'surprised'),
    ] },
    { id: 'door_gal', type: 'door', x: 4050, z: 30, to: { x: ROOM_X + 200, z: 130 }, text: '畫廊', look: 'room' },
    { id: 'door_gback', type: 'door', x: ROOM_X + 90, z: 30, to: { x: 4050, z: 140 }, text: '出口', look: 'room' },
    { id: 'm_star', type: 'switch', x: 4450, z: 60, group: 'memory', order: 1, text: '星', flag: 'ch6_m1', showIf: CLUES_DONE },
    { id: 'm_moon', type: 'switch', x: 4600, z: 190, group: 'memory', order: 2, text: '月', flag: 'ch6_m2', showIf: CLUES_DONE },
    { id: 'm_flower', type: 'switch', x: 4750, z: 70, group: 'memory', order: 3, text: '花', flag: 'ch6_m3', showIf: CLUES_DONE },
    { id: 'm_heart', type: 'switch', x: 4900, z: 200, group: 'memory', order: 4, text: '心', flag: 'ch6_memory_done', showIf: CLUES_DONE },
    { id: 'gate62', type: 'gate', x: 5300, z: 0, cond: 'ch6_memory_done&ch6_quiz_done', w: 1 },
    { id: 'heal61', type: 'heal', x: 5700, z: 110 },
    { id: 'save62', type: 'savepoint', x: 5850, z: 60 },
    { id: 'save63', type: 'savepoint', x: ROOM_X + 400, z: 60 },
    { id: 'shard6', type: 'shard', x: 6400, z: 120, showIf: 'boss6&!shard6_got' },
  ],
  zones: [
    { type: 'dark', x: 2400, w: 800 },
    { type: 'pit', x: 3420, w: 300, z0: 0, z1: 240, look: 'void' },
  ],
  platforms: [
    { id: 'pbridge', x: 3570, z: 120, w: 340, d: 250, look: 'plank', showIf: 'ch6_bridge' },
  ],
  rooms: [{ id: 'gallery', x: ROOM_X, w: 2000, name: '肖像畫廊' }],
  triggers: [
    { id: 't6_vio', x: 1240, w: 60, if: '!joined:violetchi', once: true, block: true, script: [EMOTE('violetchi', '!'), ...VIO_JOIN] },
    { id: 't6_maze', x: 2500, w: 60, if: '!quest:q6_mirror&!done:q6_mirror', once: true, script: [PL('violetchi', '好多鏡子……每一面都映著我們。', 'worried'), QS('q6_mirror')] },
    { id: 't6_mirror_done', x: 3250, w: 100, if: 'ch6_mirror_done&!t6_md', once: true, script: [FLAG('t6_md'), L('hero', '出來了！果然是最裡面那扇門！', 'happy')] },
    { id: 't6_bridge', x: 3330, w: 60, if: '!ch6_bridge', once: true, script: [
      L('hero', '地板塌掉了……只剩下一條灰灰的虛線。', 'worried'),
      PL('violetchi', '那是橋的「輪廓」！我記得它原本的樣子——讓我把它畫回來！（按 C）', 'determined'),
    ] },
    { id: 't6_gallery', x: ROOM_X + 300, w: 80, once: true, script: [
      CINE(),
      SPAWN('xiaohui', 'xiaohui', ROOM_X + 1320, 70, { dir: -1 }), SPAWN('dahui', 'dahui', ROOM_X + 1500, 73, { dir: -1 }),
      PAN(ROOM_X + 1350, 900),
      L('xiaohui', '……這幅畫，是大人？', 'surprised'),
      L('dahui', '大人以前……笑得好開心喔。', 'sad'),
      L('xiaohui', '為什麼……現在都不笑了呢。', 'sad'),
      EMOTE('xiaohui', '!'),
      L('xiaohui', '……你們。今天不打了。', 'normal'),
      L('xiaohui', '畫廊的畫像知道燭台的順序。……快點聽完，快點離開。這裡會讓人變得好難過。', 'sad'),
      WALKN('xiaohui', ROOM_X + 1990, 70), WALK('dahui', ROOM_X + 1990, 73),
      DESPAWN('xiaohui', 'poof'), DESPAWN('dahui', 'poof'),
      FOLLOW(600), CINE(false),
    ] },
    { id: 't6_clues', x: 0, w: ROOM_X + 2000, if: `${CLUES_DONE}&!t6_clues_done`, once: true, script: [
      FLAG('t6_clues_done'), L('hero', '星、月、花、心！回去大廳點亮記憶燭台吧！', 'determined'),
    ] },
    { id: 't6_page', x: 5380, w: 80, if: 'ch6_memory_done&!item:memory_page', once: true, script: [
      GIVE('memory_page'), SFX('item'),
      N('記憶之頁：「守護者永恆吉聽了太多悲傷的聲音。某一天，他說：『如果世界不再改變，就不會再有離別。』」'),
      L('hero', '永恆吉……他就是「王冠之人」！', 'surprised'),
      PL('violetchi', '他不是壞人……他只是太累了。', 'sad'),
    ] },
  ],
  boss: {
    id: 'boss6', enemy: 'castle_knight', party: ['castle_knight'], x: 6150, z: 120, flag: 'boss6', music: 'boss',
    pre: [
      QS('q6_boss'), SHAKE(800), SFX('shake'),
      L('castle_knight', '……我在守護什麼？……我是誰？……不管了。闖入者，消失吧！', 'angry'),
      L('hero', '騎士先生！你一定是守護這座城堡歷史的人！畫廊裡有你的畫像！', 'determined'),
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
    N('取得了星之心碎片（6/8）！城堡的窗戶一扇扇亮了起來。碎片裡，是一段爭吵的回憶——'),
    BOOK(
      { bg: 'temple', chars: [{ look: 'oyajitchi', x: 0.32, face: 'worried' }, { look: 'young_eter', x: 0.68, face: 'angry' }], deco: [{ t: 'heart', x: 0.5, y: 0.25, s: 0.6 }], text: '「如果什麼都不會改變，就不會再有人說再見了。」老爺爺吉想阻止他，可是他再也聽不進去。' },
      { bg: 'dark', chars: [{ look: 'shadow', x: 0.5, face: 'sad' }], text: '守護者離開了神殿，戴上了陰影的斗篷。後來，大家都忘了他的名字——永恆吉。' },
    ),
    CINE(),
    SHAKE(600), SFX('shake'),
    SPAWN('shadow', 'shadow', 6550, 43, { dir: -1, fx: 'poof' }),
    L('shadow', '……你們，看到了不該看的東西。', 'normal'),
    L('hero', '永恆吉！我們都知道了——你只是不想再和大家說再見！', 'determined'),
    L('shadow', '……知道了又怎樣。到黑暗異世界來吧。在那裡，你會明白「分開」有多痛。', 'sad'),
    DESPAWN('shadow', 'poof'),
    N('城堡的地板裂開，一道黑色的門出現了。門後是一片扭曲的黑暗——'),
    L('hero', '感應器的指針……指向那扇門裡面！', 'determined'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q6_mirror', 'q6_clues', 'q6_memory', 'q6_quiz', 'q6_boss', 's6_candles'],
  partner: 'violetchi',
};

ch6.props.push(...ROOM_PROPS);

void FACE; void FX; void IF;
