import type { ChapterDef, NpcLook } from '../types';
import {
  BOOK, BOUNCE, CAP, CHASE, CINE, DESPAWN, EMOTE, FLAG, FLASH, FOLLOW, FX, GATHER, GIVE, JUMP, L, LOOKS, MUSIC, N, PAN, PL, QS, SFX, SHAKE,
  SPAWN, WAIT, WALK,
} from './helpers';

const DAHUI: NpcLook = { color: '#a8a8b4', accent: '#5a5a6a', ears: 'round', hat: 'cap', size: 1.15 };
const XIAOHUI: NpcLook = { color: '#c4c4cc', accent: '#7a5aa0', ears: 'pointy', glasses: true, size: 0.82 };
const LUMI: NpcLook = { color: '#fff6a0', accent: '#ffb0d8', ears: 'none', size: 0.7 };

export const ch8: ChapterDef = {
  id: 'ch8', num: 8, title: '第八章：星之心的真相', location: '最終星之神殿',
  summary: '星空最高處的神殿。所有夥伴的力量——還有新朋友的心意——將在這裡合而為一。',
  music: 'temple', weather: 'stars', width: 6200, start: { x: 180, z: 130 }, grey: -0.45,
  theme: {
    id: 'temple', skyTop: 0x1a1450, skyBottom: 0x8a6ac8, far: 0x4a3a8a, farAccent: 0xffd23a, mid: 0x6a5aa8, midAccent: 0xfff6a0,
    ground: 0xf8f0d8, groundAccent: 0xffd23a, groundEdge: 0xfff8e0, pitColor: 0x0a0830, light: 0xfff0c0, ambient: 0xfff8f0,
    sun: 'star', farShape: 'pillars', midShape: 'stars', groundPattern: 'marble',
  },
  mapNodes: [{ name: '星之階梯', x: 200 }, { name: '第一封印', x: 1500 }, { name: '第二封印', x: 3000 }, { name: '第三封印', x: 4300 }, { name: '星之心祭壇', x: 5800 }],
  intro: [
    MUSIC('temple'),
    CINE(),
    GATHER(),
    N('七塊碎片發出光芒，在夜空中鋪出一條星星的階梯。階梯的盡頭，是最終星之神殿。'),
    PL('mimitchi', '好安靜……一點聲音都沒有。', 'worried'),
    PL('violetchi', '連星星都不會眨眼了。這就是「不會改變的世界」嗎？', 'sad'),
    PAN(1500, 1500), CAP('神殿的封印上，刻著大家一路走來的回憶。', 2400), FOLLOW(800),
    L('xiaohui8', '封印一共有三道。每一道，都要用你們一路學會的力量才解得開。', 'normal'),
    L('hero', '大家，最後一塊碎片就在這裡。我們一起，把星之心——還有永恆吉——帶回來！', 'determined'),
    QS('q8_seals'),
    CINE(false),
  ],
  props: [
    { t: 'star_pillar', x: 150, z: -30, layer: 'back' }, { t: 'star_lamp', x: 450, z: 30 }, { t: 'gold_arch', x: 900, z: -40, layer: 'back' }, { t: 'star_pillar', x: 1300, z: -30, layer: 'back' },
    { t: 'star_lamp', x: 1700, z: 30 }, { t: 'star_pillar', x: 2500, z: -30, layer: 'back' }, { t: 'star_lamp', x: 2900, z: 30 }, { t: 'gold_arch', x: 3500, z: -40, layer: 'back' },
    { t: 'star_pillar', x: 4100, z: -30, layer: 'back' }, { t: 'star_lamp', x: 4600, z: 30 }, { t: 'star_altar', x: 5900, z: -20, layer: 'back' }, { t: 'star_pillar', x: 5400, z: -30, layer: 'back' },
    { t: 'star_lamp', x: 1000, z: 240, layer: 'front' }, { t: 'star_lamp', x: 3800, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'xiaohui8', name: '小灰', look: XIAOHUI, x: 520, z: 80, talk: [{ script: [
      L('xiaohui8', '以前我們被大家說「灰灰的、好無聊」，就被丟下了。是大人收留了我們。', 'sad'),
      L('xiaohui8', '所以這次……換我們幫大人了。', 'determined'),
    ] }] },
    { id: 'dahui8', name: '大灰', look: DAHUI, x: 620, z: 170, talk: [{ script: [
      L('dahui8', '打完以後，大家可以一起吃點心嗎？', 'happy'),
      PL('kuchipatchi', '當然！我知道村莊最好吃的麵包店！', 'happy'),
      BOUNCE('dahui8', 2),
    ] }] },
    { id: 'lumi8', name: '小光', look: LUMI, x: 330, z: 200, talk: [{ script: [L('lumi8', '……他就在最上面。我感覺得到。', 'normal')] }] },
    { id: 'star_spirit', name: '星之精靈', look: LOOKS.light, x: 760, z: 120, talk: [
      { script: [L('star_spirit', '三道封印由永恆吉的心守護著。每一道，都只為「一起走過來的人」打開。', 'normal'), L('star_spirit', '神殿裡的時間是停止的……但你們的心跳聲，我聽得很清楚。', 'happy')] },
    ] },
  ],
  enemies: [
    { id: 'e8a', enemy: 'star_sentinel', party: ['star_sentinel', 'fallen_star'], x: 1100, z: 120, ai: 'sleeper' },
    { id: 'e8b', enemy: 'fallen_star', party: ['fallen_star', 'fallen_star'], x: 2520, z: 160, ai: 'chaser' },
    { id: 'e8c', enemy: 'star_sentinel', party: ['star_sentinel', 'star_sentinel', 'fallen_star'], x: 3550, z: 90 },
    { id: 'e8d', enemy: 'eternal_shade', party: ['eternal_shade', 'fallen_star', 'eternal_shade'], x: 4050, z: 170, ai: 'ambush' },
    { id: 'e8e', enemy: 'star_sentinel', party: ['star_sentinel', 'eternal_shade', 'fallen_star'], x: 5000, z: 120, ai: 'chaser' },
  ],
  chests: [
    { id: 'c8_px1', x: 3650, z: 210, items: [{ id: 'elixir', qty: 1 }, { id: 'cake', qty: 1 }], world: 'pixel' },
    { id: 'c8_1', x: 550, z: 50, items: [{ id: 'sticker_22', qty: 1 }, { id: 'feast', qty: 1 }] },
    { id: 'c8_h1', x: 1900, z: 200, items: [{ id: 'sticker_23', qty: 1 }, { id: 'elixir', qty: 1 }], hidden: true },
    { id: 'c8_2', x: 3650, z: 40, items: [{ id: 'life_mushroom', qty: 2 }, { id: 'star_candy', qty: 2 }] },
    { id: 'c8_h2', x: 4800, z: 210, items: [{ id: 'sticker_24', qty: 1 }, { id: 'b_star', qty: 1 }], hidden: true },
    { id: 'c8_3', x: 5450, z: 200, items: [{ id: 'elixir', qty: 2 }, { id: 'feast', qty: 1 }] },
  ],
  objects: [
    { id: 'sign_egg8', type: 'sign', x: 1960, z: 215, text: '星之階梯：紙片的星、像素的星、再一顆紙片的星。用上你學會的所有蛋機技巧吧！' },
    { id: 'eggw81', type: 'egg_wall', x: 4930, z: 0, w: 1, world: 'pixel' },
    { id: 'eggw82', type: 'egg_wall', x: 5060, z: 0, w: 1, world: 'paper' },
    { id: 'save81', type: 'savepoint', x: 900, z: 60 },
    { id: 'wall81', type: 'ability', x: 1400, z: 120, need: 'violetchi', look: 'paint_wall', flag: 'ch8_wall1', script: [
      L('violetchi', '這面牆，是用「忘記的顏色」做的。只要想起來——就畫得出來！', 'determined'),
      L('violetchi', '……村莊的紅屋頂、森林的粉紅色、天空的藍。我全部都記得！', 'happy'),
    ] },
    { id: 'seal1', type: 'switch', x: 1550, z: 120, flag: 'ch8_seal1', text: '封印一' },
    { id: 'seal2', type: 'switch', x: 3580, z: 160, flag: 'ch8_seal2', text: '封印二' },
    { id: 'candy81', type: 'ability', x: 4180, z: 120, need: 'kuchipatchi', look: 'food_wall', flag: 'ch8_candy', script: [
      L('kuchipatchi', '星星糖做的牆！……嗯！這是我吃過最「閃閃發亮」的味道！', 'happy'),
      L('dahui8', '……我也想吃一口。', 'sad'),
    ] },
    { id: 'seal3', type: 'switch', x: 4350, z: 120, flag: 'ch8_seal3', text: '封印三' },
    { id: 'gate81', type: 'gate', x: 5150, z: 0, cond: 'ch8_seal1&ch8_seal2&ch8_seal3', w: 1 },
    { id: 'heal81', type: 'heal', x: 5300, z: 120 },
    { id: 'save82', type: 'savepoint', x: 5400, z: 60 },
  ],
  zones: [
    { type: 'pit', x: 2000, w: 400, z0: 0, z1: 240, look: 'stars' },
    { type: 'pit', x: 3720, w: 300, z0: 0, z1: 240, look: 'stars' },
    { type: 'wind', x: 4450, w: 400, fx: -100 },
  ],
  platforms: [
    { id: 'st1', x: 2060, z: 120, w: 110, d: 60, dz: 90, period: 2.6, look: 'star' },
    { id: 'st2', x: 2200, z: 120, w: 110, d: 60, dx: 40, dz: -80, period: 3.2, look: 'pixel', world: 'pixel' },
    { id: 'st3', x: 2330, z: 120, w: 110, d: 60, dz: 90, period: 2.2, look: 'star', world: 'paper' },
    // the dark star bridge: only Oyajitchi's lantern shows it
    { id: 'sl1', x: 3780, z: 120, w: 120, d: 150, look: 'star', secret: 'light' },
    { id: 'sl2', x: 3900, z: 120, w: 120, d: 150, look: 'star', secret: 'light' },
    { id: 'sl3', x: 4000, z: 120, w: 100, d: 150, look: 'star', secret: 'light' },
  ],
  chases: [{ id: 'shades', x0: 2620, x1: 3480, look: 'shadow', speed: 268, flag: 'ch8_chase_done', armed: 'ch8_chase_armed' }],
  triggers: [
    { id: 't8_wall', x: 1300, w: 40, if: '!ch8_wall1', once: true, script: [L('hero', '封印前面……有一面灰色的牆。', 'worried'), PL('violetchi', '交給我。最後一次，讓我把顏色畫回來！（按 C）', 'determined')] },
    { id: 't8_chase', x: 2580, w: 40, if: 'ch8_seal1&!ch8_chase_armed', once: true, script: [
      CINE(), PAN(2400, 700),
      SHAKE(900), SFX('shake'),
      CAP('身後的星星，一顆接一顆地熄滅了——「永恆之影」湧了上來！', 2400),
      L('xiaohui8', '是大人的影子！被吞進去，就會停在原地，永遠動不了！', 'worried'),
      L('hero', '大家，往前跑！', 'determined'),
      FOLLOW(300), FLAG('ch8_chase_armed'), CINE(false), CHASE('shades'),
    ] },
    { id: 't8_chase_end', x: 3480, w: 200, if: 'ch8_chase_done', once: true, script: [L('hero', '甩、甩掉了……！', 'happy'), PL('oyajitchi', '前面的星橋暗掉了。讓我用星之燈照亮它吧（按 C）。', 'normal')] },
    { id: 't8_seals', x: 5100, w: 60, if: 'ch8_seal1&ch8_seal2&ch8_seal3&!t8_open', once: true, script: [
      FLAG('t8_open'), CINE(), SHAKE(500), SFX('shard'),
      PAN(5150, 800), CAP('三道封印亮起，大門緩緩打開。', 2000), FOLLOW(600),
      L('hero', '三道封印都解開了！祭壇就在前面！', 'determined'), QS('q8_final'), CINE(false),
    ] },
  ],
  boss: {
    id: 'boss8', enemy: 'eternatchi', party: ['eternatchi'], x: 5750, z: 120, flag: 'boss8', music: 'final',
    pre: [
      SHAKE(900), SFX('shake'),
      L('eternatchi', '歡迎來到停止的世界。在這裡，沒有人會老去，沒有人會分開。', 'normal'),
      PL('oyajitchi', '永恆吉，你看看這裡。花不會開，星星不會眨眼。這不是你想守護的世界！', 'sad'),
      L('eternatchi', '我聽了好幾千年的心聲……每一聲「再見」，都像碎片一樣刺進我的心裡。', 'sad'),
      L('hero', '可是也有很多「你好」和「謝謝」啊！改變會帶來離別，也會帶來相遇！', 'determined'),
      L('eternatchi', '……那就用你們的力量證明給我看吧！', 'angry'),
      { do: 'battle', encounter: ['eternatchi'], boss: true, flag: 'boss8', music: 'final' },
    ],
    post: [
      L('eternatchi', '……好溫暖。這就是……大家的心嗎？', 'sad'),
      SPAWN('lumi', 'lumi', 5600, 67, { dir: 1, fx: 'drop' }),
      L('lumi', '永恆吉！', 'happy'),
      L('eternatchi', '……小光？真的……是你？', 'surprised'),
      L('lumi', '我回來了。……因為說了「再見」，所以今天才能說「我回來了」呀。', 'happy'),
      L('eternatchi', '……原來是這樣。我一直害怕「再見」，卻忘了還有「好久不見」……', 'sad'),
      JUMP('lumi'), FX('sparkle', 'lumi'),
      SPAWN('xiaohui', 'xiaohui', 5300, 49, { dir: 1, fx: 'pop' }), SPAWN('dahui', 'dahui', 5360, 82, { dir: 1, fx: 'pop' }),
      L('xiaohui', '大人！', 'sad'),
      L('eternatchi', '小灰、大灰……對不起，讓你們做了那麼多難過的事。', 'sad'),
      L('dahui', '大人，下次……一起吃點心吧。', 'happy'),
      L('eternatchi', '……嗯。', 'happy'),
      PL('oyajitchi', '老朋友，回來吧。悲傷的聲音，以後我們一起聽。', 'happy'),
      L('eternatchi', '……嗯。孩子們，對不起。也謝謝你們。', 'happy'),
      SFX('shard'), FLASH(0xffffff), N('永恆吉的胸口，亮起了最後一塊碎片。'),
    ],
  },
  outro: [
    FLAG('shard8_got'), GIVE('shard8'), SFX('shard'), FLASH(0xffffff),
    N('八塊碎片在空中聚集，發出了比太陽還要溫暖的光——'),
    L('guardian_voice', '謝謝你們。記憶、夢想和心情……全部都回來了。', 'happy'),
    N('星之心恢復了！光芒灑落在整個拓麻歌子星球上。'),
    BOOK(
      { bg: 'village', chars: [{ look: 'kuchipatchi', x: 0.32, face: 'happy' }, { look: 'oyajitchi', x: 0.68, face: 'happy' }], text: '村莊恢復了顏色。麵包店的麵包，又變得好香好香。', sepia: false },
      { bg: 'day', chars: [{ look: 'memetchi', x: 0.34, face: 'happy' }, { look: 'mimitchi', x: 0.66, face: 'happy' }], deco: [{ t: 'note', x: 0.6, y: 0.3 }, { t: 'note', x: 0.75, y: 0.22 }], text: '樹王收到了好多糖霜花束；天空島上，咪咪吉的歌聲每天都乘著風飛得好遠。', sepia: false },
      { bg: 'sunset', chars: [{ look: 'maskutchi', x: 0.25, face: 'happy' }, { look: 'gozarutchi', x: 0.5, face: 'happy' }, { look: 'violetchi', x: 0.75, face: 'happy' }], text: '工廠又做出了可愛的玩具，大海重新開始呼吸，城堡的畫廊裡，多了一幅新的畫。', sepia: false },
      { bg: 'village', chars: [{ look: 'dahui', x: 0.38, face: 'happy' }, { look: 'xiaohui', x: 0.62, face: 'happy' }], text: '灰灰兄弟在村莊住了下來。大灰在麵包店負責試吃，小灰則在研究新的發明。', sepia: false },
      { bg: 'night', chars: [{ look: 'oyajitchi', x: 0.3, face: 'happy' }, { look: 'eternatchi', x: 0.55, face: 'happy' }, { look: 'lumi', x: 0.75, face: 'happy', s: 0.8 }], deco: [{ t: 'heart', x: 0.5, y: 0.22, s: 0.5 }], text: '永恆吉和老爺爺吉，再一次一起守護星之心。小光說，她會常常回來看他們。', sepia: false },
      { bg: 'night', chars: [{ look: 'mametchi', x: 0.5, face: 'happy' }], deco: [{ t: 'star', x: 0.3, y: 0.2 }, { t: 'star', x: 0.7, y: 0.15 }], text: '「再見」之後，還會有「好久不見」。改變會帶來離別，也一定會帶來新的相遇。', sepia: false },
    ),
    WAIT(400), { do: 'ending' },
  ],
  quests: ['q8_seals', 'q8_final'],
};

void EMOTE; void WALK; void GIVE;
