import type { ChapterDef, PropDef, Script } from '../types';
import {
  BOOK, BOUNCE, CINE, EMOTE, FLAG, FLASH, FOLLOW, FX, GAME, GIVE, JOIN, JUMP, L, LOOKS, MUSIC, N, PAN, PL, QS, RUN, SFX, SHAKE, SHIVER, WAIT,
  WALK, WALKN, CAP,
} from './helpers';

const MASK_JOIN: Script = [
  CINE(),
  L('maskutchi', '站住！可疑的傢伙……咦，是麻每吉？', 'surprised'),
  L('maskutchi', '我是正義的假面英雄！我在調查這座工廠為什麼會失控。', 'determined'),
  L('maskutchi', '裡面到處都是監視器，被照到就會被抓出去。不過——我有秘密武器！', 'happy'),
  L('hero', '是星之心碎片讓工廠失控的！我們一起去阻止它吧！', 'determined'),
  L('maskutchi', '很好！正義的夥伴又增加了！……裡面有點暗，你們走前面喔。', 'worried'),
  JOIN('maskutchi'), SFX('join'), N('假面吉成為了夥伴！能力「英雄變裝」：躲進紙箱，一段時間內敵人和監視器都認不出你。'),
];

/** The central control room, a side room past the end of the factory floor. */
const ROOM_X = 6800;
const ROOM_PROPS: PropDef[] = [
  { t: 'pipe', x: ROOM_X + 150, z: -10, layer: 'back' }, { t: 'gear_big', x: ROOM_X + 500, z: -30, layer: 'back' }, { t: 'crate', x: ROOM_X + 380, z: 200 },
  { t: 'gear_small', x: ROOM_X + 900, z: 0, layer: 'back' }, { t: 'toy_block', x: ROOM_X + 1150, z: 40 }, { t: 'pipe', x: ROOM_X + 1400, z: -10, layer: 'back' },
  { t: 'smokestack', x: ROOM_X + 1650, z: -30, layer: 'back' }, { t: 'crate', x: ROOM_X + 1500, z: 210 },
];

const BROS_FIGHT: Script = [
  CINE(),
  L('xiaohui', '來了嗎！這次我們不逃了！', 'angry'),
  L('dahui', '控制室好溫暖……不想走。', 'sleepy'),
  L('hero', '為什麼要讓工廠做出可怕的機器？大家的玩具都不見了！', 'angry'),
  L('xiaohui', '只要工廠一直停著，玩具就不會壞掉，也不會被丟掉！', 'determined'),
  L('xiaohui', '被丟掉的感覺……你們才不懂！', 'sad'),
  PL('maskutchi', '就算是那樣，也不能把大家的快樂一起停掉！正義英雄，出擊！', 'determined'),
  { do: 'battle', encounter: ['dahui', 'xiaohui'], boss: true, flag: 'ch4_bros', music: 'boss' },
  CINE(),
  L('xiaohui', '嗚……又輸了……', 'hurt'),
  L('dahui', '小灰，生產線……是我們亂設定的。要不要告訴他們怎麼修？', 'worried'),
  L('xiaohui', '大哥！……哼！要修好的話，就得自己一個一個組裝玩具喔！', 'angry'),
  WALKN('xiaohui_c', ROOM_X + 1750, 120, true), RUN('dahui_c', ROOM_X + 1750, 150),
  FLAG('ch4_bros_gone'),
  L('hero', '控制台……這裡就是生產線的開關！來修吧！', 'determined'),
  GAME('assembly'),
  FLAG('ch4_line_fixed'), SFX('quest'),
  L('hero', '修好了！外面的門應該打開了！', 'happy'),
  PL('maskutchi', '正義的勝利！……那兩個人，好像有點可憐呢。', 'normal'),
  CINE(false),
];

export const ch4: ChapterDef = {
  id: 'ch4', num: 4, title: '第四章：失控的玩具工廠', location: '玩具工廠',
  summary: '原本製造歡樂的玩具工廠，現在只會做出奇怪的機械生物。到處都是監視器的紅光。',
  music: 'factory', weather: 'sparks', width: 6400, start: { x: 180, z: 130 }, grey: -0.6, eggDrain: 0.1,
  theme: {
    id: 'factory', skyTop: 0x4a4a6a, skyBottom: 0xc89a7a, far: 0x7a6a7a, farAccent: 0xc86a5a, mid: 0x8a8a98, midAccent: 0xffb84a,
    ground: 0xa8a8b8, groundAccent: 0x6a6a7a, groundEdge: 0xffc84a, pitColor: 0x2a2a3a, light: 0xffd8a0, ambient: 0xf0e8e0,
    sun: 'none', farShape: 'chimneys', midShape: 'gears', groundPattern: 'metal',
  },
  mapNodes: [{ name: '工廠大門', x: 200 }, { name: '輸送帶區', x: 1600 }, { name: '電源控制室', x: 3200 }, { name: '機械手臂通道', x: 4400 }, { name: '總裝配廠', x: 5900 }],
  intro: [
    MUSIC('factory'),
    CINE(),
    N('玩具工廠的煙囪冒著紫色的煙。大門口散落著壞掉的玩具。'),
    PL('memetchi', '好可怕……這些機器人一點都不可愛。', 'worried'),
    PAN(1250, 1400), CAP('工廠裡，監視器的燈光來回掃著。', 2200), FOLLOW(800),
    L('hero', '工廠的電源被黑暗力量控制了。先找到進去的方法吧！', 'determined'),
    CINE(false),
  ],
  props: [
    { t: 'smokestack', x: 150, z: -30, layer: 'back' }, { t: 'crate', x: 420, z: 30 }, { t: 'toy_block', x: 520, z: 210 }, { t: 'pipe', x: 800, z: -10, layer: 'back' },
    { t: 'gear_big', x: 1100, z: -30, layer: 'back' }, { t: 'crate', x: 1350, z: 200 }, { t: 'smokestack', x: 1900, z: -30, layer: 'back' }, { t: 'gear_small', x: 2300, z: 0, layer: 'back' },
    { t: 'pipe', x: 2700, z: -10, layer: 'back' }, { t: 'toy_block', x: 3000, z: 30 }, { t: 'gear_big', x: 3500, z: -30, layer: 'back' }, { t: 'crate', x: 3900, z: 210 },
    { t: 'pipe', x: 4300, z: -10, layer: 'back' }, { t: 'smokestack', x: 4800, z: -30, layer: 'back' }, { t: 'gear_small', x: 5200, z: 0, layer: 'back' }, { t: 'toy_block', x: 5500, z: 220 },
    { t: 'gear_big', x: 6100, z: -30, layer: 'back' }, { t: 'crate', x: 2000, z: 240, layer: 'front' }, { t: 'crate', x: 4600, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'maskutchi', name: '假面吉', look: 'maskutchi', x: 600, z: 140, showIf: '!joined:maskutchi', talk: [{ script: MASK_JOIN }] },
    { id: 'toymaker', name: '玩具修理師', look: LOOKS.robot, x: 820, z: 200, talk: [
      { if: '!quest:s4_gears&!done:s4_gears', script: [
        L('toymaker', '嗶嗶……我是修理玩具的機器人。我還沒被黑暗控制。', 'normal'),
        L('toymaker', '通行證在輸送帶的盡頭。另外……可以幫我找 2 個玩具齒輪嗎？', 'worried'), QS('q4_card'), QS('s4_gears'),
      ] },
      { if: 'quest:s4_gears', script: [L('toymaker', '齒輪可能被機器人帶走了，或藏在箱子裡。', 'normal')] },
      { script: [L('toymaker', '修好的發條兔子又能跳了！謝謝！', 'happy')] },
    ] },
    { id: 'engineer', name: '工廠廠長', look: LOOKS.farmer, x: 3300, z: 200, talk: [
      { if: '!ch4_power', script: [L('engineer', '電源開關要照「紅、藍、黃」的順序打開，不然會跳電！', 'worried'), QS('q4_power')] },
      { if: '!ch4_line_fixed', script: [L('engineer', '電源回來了，可是控制室被兩個灰灰的傢伙佔領了！生產線被亂設定，門也打不開……', 'worried'), L('engineer', '控制室的門就在前面，最裡面的那扇。', 'normal'), QS('q4_bros')] },
      { script: [L('engineer', '生產線恢復了！但是總裝配廠的超級機器人還在暴走……', 'worried')] },
    ] },
    { id: 'xiaohui_c', name: '小灰', look: { species: 'xiaohui', color: '#cfd0d8', accent: '#7a5aa0' }, x: ROOM_X + 1100, z: 110, showIf: '!ch4_bros_gone', talk: [{ script: BROS_FIGHT }] },
    { id: 'dahui_c', name: '大灰', look: { species: 'dahui', color: '#aeb0bc', accent: '#5a5c6e' }, x: ROOM_X + 1230, z: 150, showIf: '!ch4_bros_gone', talk: [{ script: BROS_FIGHT }] },
  ],
  enemies: [
    { id: 'e4a', enemy: 'windup_mouse', party: ['windup_mouse', 'windup_mouse'], x: 1700, z: 120, ai: 'chaser', small: true },
    { id: 'e4b', enemy: 'drone', party: ['drone', 'windup_mouse'], x: 2100, z: 80 },
    { id: 'e4c', enemy: 'spring_bot', party: ['spring_bot', 'drone'], x: 2600, z: 170, ai: 'sleeper' },
    { id: 'e4d', enemy: 'windup_mouse', party: ['windup_mouse', 'spring_bot', 'drone'], x: 3700, z: 110, ai: 'ambush' },
    { id: 'e4e', enemy: 'drone', party: ['drone', 'drone', 'spring_bot'], x: 5200, z: 140, ai: 'chaser' },
  ],
  chests: [
    { id: 'c4_px1', x: 2250, z: 225, items: [{ id: 'thunder_bomb', qty: 1 }, { id: 'juice', qty: 1 }], world: 'pixel' },
    { id: 'c4_1', x: 450, z: 60, items: [{ id: 'sticker_10', qty: 1 }] },
    { id: 'c4_card', x: 2550, z: 120, items: [{ id: 'factory_card', qty: 1 }] },
    { id: 'c4_h1', x: 1500, z: 200, items: [{ id: 'gear_part', qty: 1 }, { id: 'juice', qty: 1 }], hidden: true },
    { id: 'c4_2', x: 3700, z: 50, items: [{ id: 'gear_part', qty: 1 }, { id: 'sticker_11', qty: 1 }], showIf: 'ch4_power' },
    { id: 'c4_h2', x: 4650, z: 60, items: [{ id: 'sticker_12', qty: 1 }, { id: 'b_power', qty: 1 }], hidden: true },
    { id: 'c4_3', x: 5450, z: 190, items: [{ id: 'elixir', qty: 1 }, { id: 'thunder_bomb', qty: 1 }] },
    { id: 'c4_room', x: ROOM_X + 1500, z: 60, items: [{ id: 'sticker_10', qty: 1 }, { id: 'power_cookie', qty: 2 }], showIf: 'ch4_bros_gone' },
  ],
  objects: [
    { id: 'sign_egg4', type: 'sign', x: 4090, z: 215, text: '像素世界裡，所有機器都會停下來——壓板也是！不過壓板中間有只在像素世界才有的牆。' },
    { id: 'eggw41', type: 'egg_wall', x: 4325, z: 0, w: 1, world: 'pixel' },
    { id: 'eggw42', type: 'egg_wall', x: 4845, z: 0, w: 1, world: 'pixel' },
    { id: 'sign41', type: 'sign', x: 350, z: 170, text: '【警告】監視器運轉中。被燈光照到的人會被送回入口！機械手臂落下的地方請勿停留！' },
    { id: 'save41', type: 'savepoint', x: 920, z: 60 },
    { id: 'gate41', type: 'gate', x: 2750, z: 0, cond: 'item:factory_card', w: 1 },
    { id: 'pw_r', type: 'switch', x: 3420, z: 60, group: 'power', order: 1, text: '紅', flag: 'ch4_pw1' },
    { id: 'pw_b', type: 'switch', x: 3550, z: 190, group: 'power', order: 2, text: '藍', flag: 'ch4_pw2' },
    { id: 'pw_y', type: 'switch', x: 3680, z: 120, group: 'power', order: 3, text: '黃', flag: 'ch4_power' },
    { id: 'gate42', type: 'gate', x: 3850, z: 0, cond: 'ch4_power', w: 1 },
    { id: 'door_ctrl', type: 'door', x: 3960, z: 30, to: { x: ROOM_X + 200, z: 130 }, text: '控制室', look: 'room' },
    { id: 'gate43', type: 'gate', x: 4060, z: 0, cond: 'ch4_line_fixed', w: 1 },
    { id: 'door_back', type: 'door', x: ROOM_X + 90, z: 30, to: { x: 3960, z: 140 }, text: '出口', look: 'room' },
    { id: 'blk41', type: 'breakable', x: 4600, z: 0, w: 1, flag: 'ch4_blk' },
    { id: 'heal41', type: 'heal', x: 5550, z: 100 },
    { id: 'save42', type: 'savepoint', x: 5650, z: 60 },
    { id: 'save43', type: 'savepoint', x: ROOM_X + 400, z: 60 },
    { id: 'shard4', type: 'shard', x: 6200, z: 120, showIf: 'boss4&!shard4_got' },
  ],
  zones: [
    { type: 'spotlight', x: 1000, w: 520, period: 4.2 },
    { type: 'conveyor', x: 1600, w: 450, fx: 120, look: 'conveyor' },
    { type: 'conveyor', x: 2100, w: 350, fx: -140, look: 'conveyor' },
    { type: 'spotlight', x: 2850, w: 420, period: 3.2 },
    { type: 'hazard', x: 4150, w: 120, z0: 0, z1: 240, period: 2.4, duty: 0.4, dmg: 2, look: 'press' },
    { type: 'hazard', x: 4380, w: 120, z0: 0, z1: 240, period: 2.0, duty: 0.4, dmg: 2, look: 'press' },
    { type: 'hazard', x: 4900, w: 120, z0: 0, z1: 240, period: 1.8, duty: 0.45, dmg: 2, look: 'press' },
  ],
  platforms: [],
  rooms: [{ id: 'control', x: ROOM_X, w: 1800, name: '中央控制室' }],
  triggers: [
    { id: 't4_egg', x: 4110, w: 60, once: true, script: [
      L('hero', '在像素世界，壓板就不會動了……可是中間有像素的牆！', 'determined'),
      PL('maskutchi', '那就在牆前面切回紙片世界，看準壓板抬起來的瞬間衝過去！', 'determined'),
    ] },
    { id: 't4_mask', x: 540, w: 60, if: '!joined:maskutchi', once: true, block: true, script: [EMOTE('maskutchi', '!'), ...MASK_JOIN] },
    { id: 't4_spot', x: 930, w: 50, once: true, script: [
      CINE(), PAN(1260, 800),
      L('hero', '監視器的燈光……被照到就會被送回入口！', 'worried'),
      PL('maskutchi', '這時候就輪到正義的「英雄變裝」了！按 C 躲進紙箱，監視器就認不出我們！', 'determined'),
      PL('maskutchi', '變裝的時間不長，要趁燈光掃開的時候快點過去喔！', 'normal'),
      FOLLOW(600), CINE(false),
    ] },
    { id: 't4_ctrl', x: ROOM_X + 500, w: 80, if: '!ch4_bros', once: true, script: [
      CINE(), PAN(ROOM_X + 1150, 800),
      L('xiaohui', '嘿嘿嘿，有了這個控制台，工廠就永遠是我們的了！', 'happy'),
      L('dahui', '小灰，這個按鈕是做什麼的？', 'normal'),
      L('xiaohui', '別亂按——！', 'surprised'),
      SHAKE(300), FOLLOW(600), CINE(false),
    ] },
    { id: 't4_arms', x: 4080, w: 60, once: true, script: [PL('maskutchi', '機械手臂！看準它抬起來的時候衝過去！', 'determined')] },
  ],
  boss: {
    id: 'boss4', enemy: 'mega_robot', party: ['mega_robot', 'drone'], x: 5950, z: 120, flag: 'boss4', music: 'boss',
    pre: [
      QS('q4_boss'), SHAKE(900), SFX('shake'),
      L('mega_robot', '偵測到……入侵者。執行……永久停止程序。', 'angry'),
      PL('maskutchi', '好、好大！不過正義的英雄不會退縮的！', 'worried'),
      L('hero', '它的裝甲很硬，先把裝甲打破！', 'determined'),
      { do: 'battle', encounter: ['mega_robot', 'drone'], boss: true, flag: 'boss4', music: 'boss' },
    ],
    post: [
      L('mega_robot', '系統……重新啟動。我的工作是……讓大家微笑。', 'normal'),
      L('mega_robot', '在記憶體裡……有一段紀錄。請帶走它。', 'sad'),
      GIVE('secret_record'), SFX('item'),
      N('「秘密紀錄」：星之心碎裂的前一晚，一個戴著王冠的身影站在星之心前面，喃喃說著：「只要一切都不再改變……就不會再有人哭了。」'),
      L('hero', '這個人……他想讓世界停下來？', 'surprised'),
      SFX('shard'), N('機器人的胸口打開，露出了碎片。'),
    ],
  },
  outro: [
    FLAG('shard4_got'), GIVE('shard4'), SFX('shard'), FLASH(0xfff6a0),
    N('取得了星之心碎片（4/8）！工廠又開始生產可愛的玩具了。碎片裡的回憶，變得有點悲傷——'),
    BOOK(
      { bg: 'night', chars: [{ look: 'young_eter', x: 0.38, face: 'sad' }, { look: 'lumi', x: 0.62, y: 0.55, face: 'happy', s: 0.8 }], deco: [{ t: 'light', x: 0.62, y: 0.42, s: 1.2 }], text: '但是，星星終究要回到天上。小光長大了，到了該回家的時候。' },
      { bg: 'night', chars: [{ look: 'young_eter', x: 0.5, face: 'sad' }], deco: [{ t: 'star', x: 0.5, y: 0.12, s: 0.6 }, { t: 'tear', x: 0.55, y: 0.55 }], text: '「再見」——那是守護者聽過的聲音裡，最痛的一句話。' },
    ),
    CINE(),
    PL('maskutchi', '戴王冠的身影……其實是個很寂寞的人吧。', 'normal'),
    L('hero', '感應器指向海邊。下一塊碎片在大海裡！', 'normal'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q4_card', 'q4_power', 'q4_bros', 'q4_boss', 's4_gears'],
  partner: 'maskutchi',
};

ch4.props.push(...ROOM_PROPS);

void BOUNCE; void FX; void JUMP; void SHIVER; void WALK;
