import type { ChapterDef } from '../types';
import { FLAG, FLASH, GIVE, JOIN, L, LOOKS, MUSIC, N, QS, SFX, SHAKE, WAIT } from './helpers';

export const ch5: ChapterDef = {
  id: 'ch5', num: 5, title: '第五章：神秘海洋', location: '夢幻海洋',
  summary: '戴上泡泡頭盔潛入海底。沉船、遺跡和神秘的海洋生物在等待著。',
  music: 'ocean', weather: 'bubbles', width: 6400, start: { x: 180, z: 130 },
  theme: {
    id: 'ocean', skyTop: 0x0a3a7a, skyBottom: 0x3ab0c8, far: 0x2a6a9a, farAccent: 0x4ab0a0, mid: 0x3a8a9a, midAccent: 0x3aa86a,
    ground: 0xe8d8a0, groundAccent: 0xffa8c8, groundEdge: 0xf8f0d0, pitColor: 0x0a2a5a, light: 0xa0f0ff, ambient: 0xd0f0ff,
    sun: 'none', farShape: 'reef', midShape: 'kelp', groundPattern: 'sand', underwater: true,
  },
  mapNodes: [{ name: '海底入口', x: 200 }, { name: '珊瑚礁', x: 1400 }, { name: '沉船', x: 3000 }, { name: '海流隧道', x: 4300 }, { name: '海底遺跡', x: 5900 }],
  intro: [
    MUSIC('ocean'),
    N('海邊的發明家借給大家「泡泡頭盔」。一群人咕嚕咕嚕地沉入了夢幻海洋。'),
    GIVE('bubble_helmet'), QS('q5_helmet'),
    L('kuchipatchi', '咕嚕……我、我可以呼吸耶！', 'surprised'),
    L('hero', '在水裡跳起來會飄很久。小心海流，會把人沖走！', 'normal'),
  ],
  props: [
    { t: 'coral', x: 300, z: 10, layer: 'back' }, { t: 'kelp', x: 520, z: 20 }, { t: 'shell_big', x: 700, z: 220 }, { t: 'coral_b', x: 950, z: -10, layer: 'back' },
    { t: 'kelp', x: 1250, z: 10 }, { t: 'coral', x: 1500, z: -20, layer: 'back' }, { t: 'anchor', x: 1800, z: 200 }, { t: 'kelp', x: 2100, z: 30 },
    { t: 'shipwreck', x: 3000, z: -40, layer: 'back' }, { t: 'coral_b', x: 3500, z: 210 }, { t: 'kelp', x: 3900, z: 20 }, { t: 'ruin_pillar', x: 4700, z: 0 },
    { t: 'coral', x: 5000, z: -20, layer: 'back' }, { t: 'ruin_pillar', x: 5500, z: 10 }, { t: 'ruin_pillar', x: 6100, z: 10 }, { t: 'kelp', x: 5800, z: 220 },
    { t: 'kelp', x: 1000, z: 240, layer: 'front' }, { t: 'kelp', x: 3200, z: 240, layer: 'front' }, { t: 'kelp', x: 5200, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'gozarutchi', name: '忍者吉', look: 'gozarutchi', x: 900, z: 140, showIf: '!joined:gozarutchi', talk: [{ script: [
      L('gozarutchi', '……（咕嚕咕嚕）……在下正在修行「水中閉氣之術」。', 'determined'),
      L('hero', '你在海底待多久了？臉都發紫了！', 'surprised'),
      L('gozarutchi', '……三天。呼哈！在下撐不住了！', 'hurt'),
      L('memetchi', '快戴上備用的泡泡頭盔！', 'worried'),
      L('gozarutchi', '多謝相救！在下願意以忍者之名，陪各位找到碎片！', 'determined'),
      JOIN('gozarutchi'), SFX('join'), N('忍者吉成為了夥伴！「手裏劍」可以打中飛行的敵人。'),
    ] }] },
    { id: 'mermaid', name: '人魚歌手', look: LOOKS.mermaid, x: 1650, z: 160, talk: [
      { if: '!quest:s5_pearls&!done:s5_pearls', script: [L('mermaid', '我的珍珠項鍊斷了……能幫我找回 3 顆彩虹珍珠嗎？', 'sad'), QS('s5_pearls')] },
      { if: 'quest:s5_pearls', script: [L('mermaid', '珍珠喜歡藏在暗暗的地方。', 'normal')] },
      { script: [L('mermaid', '～謝謝你們，這首歌送給你們～', 'happy')] },
    ] },
    { id: 'captain', name: '沉船的船長', look: LOOKS.sailor, x: 2900, z: 180, talk: [
      { if: '!ch5_ruins_open', script: [L('captain', '遺跡的大門？船艙最裡面有個舵輪開關，轉一下就能打開。', 'normal'), L('captain', '不過要小心，那附近的螃蟹很兇。', 'worried'), QS('q5_ruins')] },
      { script: [L('captain', '我的船以前也載過星星喔……那是好久以前的事了。', 'happy')] },
    ] },
  ],
  enemies: [
    { id: 'e5a', enemy: 'puffer', party: ['puffer', 'zap_jelly'], x: 700, z: 90 },
    { id: 'e5b', enemy: 'zap_jelly', party: ['zap_jelly', 'zap_jelly'], x: 1950, z: 150 },
    { id: 'e5c', enemy: 'reef_crab', party: ['reef_crab', 'puffer'], x: 3300, z: 110 },
    { id: 'e5d', enemy: 'puffer', party: ['puffer', 'reef_crab', 'zap_jelly'], x: 4200, z: 170 },
    { id: 'e5e', enemy: 'reef_crab', party: ['reef_crab', 'reef_crab', 'zap_jelly'], x: 5300, z: 100 },
  ],
  chests: [
    { id: 'c5_1', x: 500, z: 50, items: [{ id: 'sticker_13', qty: 1 }] },
    { id: 'c5_h1', x: 1350, z: 200, items: [{ id: 'pearl', qty: 1 }], hidden: true },
    { id: 'c5_2', x: 2600, z: 40, items: [{ id: 'pearl', qty: 1 }, { id: 'cake', qty: 1 }] },
    { id: 'c5_h2', x: 3550, z: 60, items: [{ id: 'sticker_14', qty: 1 }, { id: 'b_spike', qty: 1 }], hidden: true },
    { id: 'c5_3', x: 4550, z: 210, items: [{ id: 'pearl', qty: 1 }, { id: 'sticker_15', qty: 1 }] },
    { id: 'c5_4', x: 5600, z: 200, items: [{ id: 'elixir', qty: 1 }, { id: 'life_mushroom', qty: 1 }] },
  ],
  objects: [
    { id: 'sign51', type: 'sign', x: 380, z: 170, text: '海流會把你推走。逆著海流前進要多花點力氣！' },
    { id: 'save51', type: 'savepoint', x: 1150, z: 60 },
    { id: 'wheel', type: 'switch', x: 3650, z: 130, flag: 'ch5_ruins_open', text: '舵輪' },
    { id: 'gate51', type: 'gate', x: 3850, z: 0, cond: 'ch5_ruins_open', w: 1 },
    { id: 'heal51', type: 'heal', x: 5500, z: 120 },
    { id: 'save52', type: 'savepoint', x: 5650, z: 60 },
    { id: 'shard5', type: 'shard', x: 6200, z: 120, showIf: 'boss5&!shard5_got' },
  ],
  zones: [
    { type: 'current', x: 2000, w: 500, fx: 110, look: 'current' },
    { type: 'current', x: 4100, w: 600, fx: -120, look: 'current' },
    { type: 'current', x: 4800, w: 300, fz: 80, look: 'current' },
    { type: 'pit', x: 4950, w: 240, z0: 0, z1: 240, look: 'abyss' },
    { type: 'dark', x: 3000, w: 700 },
  ],
  platforms: [
    { id: 'sh1', x: 5000, z: 120, w: 110, d: 60, dz: 80, period: 3.2, look: 'stone' },
    { id: 'sh2', x: 5120, z: 120, w: 110, d: 60, dz: -80, period: 3.2, look: 'stone' },
  ],
  triggers: [
    { id: 't5_wreck', x: 2900, w: 60, once: true, script: [L('gozarutchi', '沉船裡很暗。主公，跟緊在下。', 'determined'), L('hero', '主、主公？', 'surprised')] },
  ],
  boss: {
    id: 'boss5', enemy: 'abyss_guardian', party: ['abyss_guardian', 'zap_jelly'], x: 5950, z: 120, flag: 'boss5', music: 'boss',
    pre: [
      QS('q5_boss'), SHAKE(900), SFX('shake'),
      L('abyss_guardian', '……誰……吵醒了……古老的海……', 'angry'),
      L('abyss_guardian', '王冠之人說……海不需要潮汐……潮起潮落……太令人悲傷……', 'sad'),
      L('hero', '可是沒有潮汐，大海就不會呼吸了！', 'determined'),
      { do: 'battle', encounter: ['abyss_guardian', 'zap_jelly'], boss: true, flag: 'boss5', music: 'boss' },
    ],
    post: [
      L('abyss_guardian', '……你說得對。潮水會退，也會再來。這才是大海。', 'normal'),
      SFX('shard'), N('古代守護者吐出了一個泡泡，裡面裝著碎片。'),
    ],
  },
  outro: [
    FLAG('shard5_got'), GIVE('shard5'), SFX('shard'), FLASH(0xfff6a0),
    N('取得了星之心碎片（5/8）！海水重新變得清澈透明。'),
    L('gozarutchi', '那位「王冠之人」……似乎很害怕改變。', 'normal'),
    L('hero', '下一個方向……是保存著世界歷史的夢幻城堡。', 'determined'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q5_helmet', 'q5_ruins', 'q5_boss', 's5_pearls'],
  partner: 'gozarutchi',
};

void MUSIC;
