import type { ChapterDef } from '../types';
import { FLAG, FLASH, GIVE, JOIN, L, LOOKS, MUSIC, N, QS, SFX, SHAKE, WAIT } from './helpers';

export const ch4: ChapterDef = {
  id: 'ch4', num: 4, title: '第四章：失控的玩具工廠', location: '玩具工廠',
  summary: '原本製造歡樂的玩具工廠，現在只會做出奇怪的機械生物。',
  music: 'factory', weather: 'sparks', width: 6400, start: { x: 180, z: 130 },
  theme: {
    id: 'factory', skyTop: 0x4a4a6a, skyBottom: 0xc89a7a, far: 0x7a6a7a, farAccent: 0xc86a5a, mid: 0x8a8a98, midAccent: 0xffb84a,
    ground: 0xa8a8b8, groundAccent: 0x6a6a7a, groundEdge: 0xffc84a, pitColor: 0x2a2a3a, light: 0xffd8a0, ambient: 0xf0e8e0,
    sun: 'none', farShape: 'chimneys', midShape: 'gears', groundPattern: 'metal',
  },
  mapNodes: [{ name: '工廠大門', x: 200 }, { name: '輸送帶區', x: 1600 }, { name: '電源控制室', x: 3200 }, { name: '機械手臂通道', x: 4400 }, { name: '總裝配廠', x: 5900 }],
  intro: [
    MUSIC('factory'),
    N('玩具工廠的煙囪冒著紫色的煙。大門口散落著壞掉的玩具。'),
    L('memetchi', '好可怕……這些機器人一點都不可愛。', 'worried'),
    L('hero', '工廠的電源被黑暗力量控制了。先找到進去的方法吧！', 'determined'),
  ],
  props: [
    { t: 'smokestack', x: 150, z: -30, layer: 'back' }, { t: 'crate', x: 420, z: 30 }, { t: 'toy_block', x: 520, z: 210 }, { t: 'pipe', x: 800, z: -10, layer: 'back' },
    { t: 'gear_big', x: 1100, z: -30, layer: 'back' }, { t: 'crate', x: 1350, z: 200 }, { t: 'smokestack', x: 1900, z: -30, layer: 'back' }, { t: 'gear_small', x: 2300, z: 0, layer: 'back' },
    { t: 'pipe', x: 2700, z: -10, layer: 'back' }, { t: 'toy_block', x: 3000, z: 30 }, { t: 'gear_big', x: 3500, z: -30, layer: 'back' }, { t: 'crate', x: 3900, z: 210 },
    { t: 'pipe', x: 4300, z: -10, layer: 'back' }, { t: 'smokestack', x: 4800, z: -30, layer: 'back' }, { t: 'gear_small', x: 5200, z: 0, layer: 'back' }, { t: 'toy_block', x: 5500, z: 220 },
    { t: 'gear_big', x: 6100, z: -30, layer: 'back' }, { t: 'crate', x: 2000, z: 240, layer: 'front' }, { t: 'crate', x: 4600, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'maskutchi', name: '假面吉', look: 'maskutchi', x: 600, z: 140, showIf: '!joined:maskutchi', talk: [{ script: [
      L('maskutchi', '站住！可疑的傢伙……咦，是麻美吉？', 'surprised'),
      L('maskutchi', '我是正義的假面英雄！我在調查這座工廠為什麼會失控。', 'determined'),
      L('hero', '是星之心碎片！我們一起去阻止它吧！', 'determined'),
      L('maskutchi', '很好！正義的夥伴又增加了！……裡面有點暗，你們走前面喔。', 'worried'),
      JOIN('maskutchi'), SFX('join'), N('假面吉成為了夥伴！「英雄姿勢」可以提升全隊攻擊力。'),
    ] }] },
    { id: 'toymaker', name: '玩具修理師', look: LOOKS.robot, x: 1250, z: 120, talk: [
      { if: '!quest:s4_gears&!done:s4_gears', script: [
        L('toymaker', '嗶嗶……我是修理玩具的機器人。我還沒被黑暗控制。', 'normal'),
        L('toymaker', '通行證在輸送帶的盡頭。另外……可以幫我找 2 個玩具齒輪嗎？', 'worried'), QS('q4_card'), QS('s4_gears'),
      ] },
      { if: 'quest:s4_gears', script: [L('toymaker', '齒輪可能被機器人帶走了，或藏在箱子裡。', 'normal')] },
      { script: [L('toymaker', '修好的發條兔子又能跳了！謝謝！', 'happy')] },
    ] },
    { id: 'engineer', name: '工廠廠長', look: LOOKS.farmer, x: 3150, z: 190, talk: [
      { if: '!ch4_power', script: [L('engineer', '電源開關要照「紅、藍、黃」的順序打開，不然會跳電！', 'worried'), QS('q4_power')] },
      { script: [L('engineer', '電源恢復了！但是總裝配廠的超級機器人還在暴走……', 'worried')] },
    ] },
  ],
  enemies: [
    { id: 'e4a', enemy: 'windup_mouse', party: ['windup_mouse', 'windup_mouse'], x: 900, z: 120 },
    { id: 'e4b', enemy: 'drone', party: ['drone', 'windup_mouse'], x: 2100, z: 80 },
    { id: 'e4c', enemy: 'spring_bot', party: ['spring_bot', 'drone'], x: 2800, z: 170 },
    { id: 'e4d', enemy: 'windup_mouse', party: ['windup_mouse', 'spring_bot', 'drone'], x: 4000, z: 110 },
    { id: 'e4e', enemy: 'drone', party: ['drone', 'drone', 'spring_bot'], x: 5100, z: 140 },
  ],
  chests: [
    { id: 'c4_1', x: 450, z: 60, items: [{ id: 'sticker_10', qty: 1 }] },
    { id: 'c4_card', x: 2550, z: 120, items: [{ id: 'factory_card', qty: 1 }] },
    { id: 'c4_h1', x: 1500, z: 200, items: [{ id: 'gear_part', qty: 1 }, { id: 'juice', qty: 1 }], hidden: true },
    { id: 'c4_2', x: 3700, z: 50, items: [{ id: 'gear_part', qty: 1 }, { id: 'sticker_11', qty: 1 }], showIf: 'ch4_power' },
    { id: 'c4_h2', x: 4650, z: 60, items: [{ id: 'sticker_12', qty: 1 }, { id: 'b_power', qty: 1 }], hidden: true },
    { id: 'c4_3', x: 5450, z: 190, items: [{ id: 'elixir', qty: 1 }, { id: 'thunder_bomb', qty: 1 }] },
  ],
  objects: [
    { id: 'sign41', type: 'sign', x: 350, z: 170, text: '【警告】輸送帶運轉中。機械手臂落下的地方請勿停留！' },
    { id: 'save41', type: 'savepoint', x: 1150, z: 60 },
    { id: 'gate41', type: 'gate', x: 2750, z: 0, cond: 'item:factory_card', w: 1 },
    { id: 'pw_r', type: 'switch', x: 3350, z: 60, group: 'power', order: 1, text: '紅', flag: 'ch4_pw1' },
    { id: 'pw_b', type: 'switch', x: 3500, z: 190, group: 'power', order: 2, text: '藍', flag: 'ch4_pw2' },
    { id: 'pw_y', type: 'switch', x: 3650, z: 120, group: 'power', order: 3, text: '黃', flag: 'ch4_power' },
    { id: 'gate42', type: 'gate', x: 3850, z: 0, cond: 'ch4_power', w: 1 },
    { id: 'blk41', type: 'breakable', x: 4600, z: 0, w: 1, flag: 'ch4_blk' },
    { id: 'heal41', type: 'heal', x: 5550, z: 100 },
    { id: 'save42', type: 'savepoint', x: 5650, z: 60 },
    { id: 'shard4', type: 'shard', x: 6200, z: 120, showIf: 'boss4&!shard4_got' },
  ],
  zones: [
    { type: 'conveyor', x: 1600, w: 450, fx: 120, look: 'conveyor' },
    { type: 'conveyor', x: 2100, w: 350, fx: -140, look: 'conveyor' },
    { type: 'hazard', x: 4150, w: 120, z0: 0, z1: 240, period: 2.4, duty: 0.4, dmg: 2, look: 'press' },
    { type: 'hazard', x: 4380, w: 120, z0: 0, z1: 240, period: 2.0, duty: 0.4, dmg: 2, look: 'press' },
    { type: 'hazard', x: 4900, w: 120, z0: 0, z1: 240, period: 1.8, duty: 0.45, dmg: 2, look: 'press' },
  ],
  platforms: [],
  triggers: [
    { id: 't4_arms', x: 4050, w: 60, once: true, script: [L('maskutchi', '機械手臂！看準它抬起來的時候衝過去！', 'determined')] },
  ],
  boss: {
    id: 'boss4', enemy: 'mega_robot', party: ['mega_robot', 'drone'], x: 5950, z: 120, flag: 'boss4', music: 'boss',
    pre: [
      QS('q4_boss'), SHAKE(900), SFX('shake'),
      L('mega_robot', '偵測到……入侵者。執行……永久停止程序。', 'angry'),
      L('maskutchi', '好、好大！不過正義的英雄不會退縮的！', 'worried'),
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
    N('取得了星之心碎片（4/8）！工廠又開始生產可愛的玩具了。'),
    L('maskutchi', '戴王冠的身影……我們離真相越來越近了！', 'determined'),
    L('hero', '感應器指向海邊。下一塊碎片在大海裡！', 'normal'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q4_card', 'q4_power', 'q4_boss', 's4_gears'],
  partner: 'maskutchi',
};

void SHAKE; void MUSIC;
