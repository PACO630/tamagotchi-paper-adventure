import type { ChapterDef } from '../types';
import { FLAG, FLASH, GIVE, IF, JOIN, L, LOOKS, MUSIC, N, QS, SFX, SHAKE, WAIT } from './helpers';

export const ch7: ChapterDef = {
  id: 'ch7', num: 7, title: '第七章：黑暗異世界', location: '黑暗異世界',
  summary: '被黑暗扭曲的世界。這裡住著大家的影子，還有另一個麻美吉。',
  music: 'dark', weather: 'darkmotes', width: 6600, start: { x: 180, z: 130 },
  theme: {
    id: 'dark', skyTop: 0x0a0414, skyBottom: 0x3a1a4a, far: 0x2a1a3a, farAccent: 0x8a3aff, mid: 0x3a2a4a, midAccent: 0xc86aff,
    ground: 0x4a3a5a, groundAccent: 0xa04aff, groundEdge: 0x6a4a8a, pitColor: 0x05020a, light: 0xc8a0ff, ambient: 0xb8a8d8,
    sun: 'eye', farShape: 'spikes', midShape: 'crystals', groundPattern: 'void',
  },
  mapNodes: [{ name: '扭曲入口', x: 200 }, { name: '影子村莊', x: 1400 }, { name: '暗晶峽谷', x: 3000 }, { name: '心之迷宮', x: 4400 }, { name: '鏡之盡頭', x: 6100 }],
  intro: [
    MUSIC('dark'),
    N('跨過黑色的門，大家來到了一個顛倒的世界。天空中有一隻巨大的眼睛。'),
    L('memetchi', '這裡好冷……感覺心裡空空的。', 'sad'),
    L('kuchipatchi', '那、那邊有一個……我？', 'surprised'),
    SFX('magic'),
    L('oyajitchi', '別怕，孩子們。那只是影子。', 'normal'),
    L('hero', '老爺爺！？你怎麼會在這裡？', 'surprised'),
    L('oyajitchi', '我一直跟在你們後面。這個地方……我曾經來過一次，很久很久以前。', 'sad'),
    L('oyajitchi', '讓我也一起去吧。有些事，我必須親口告訴你們。', 'determined'),
    JOIN('oyajitchi'), SFX('join'), N('老爺爺吉成為了夥伴！「老人智慧」可以回復全隊的技能點數。'),
  ],
  props: [
    { t: 'twisted_tree', x: 200, z: -20, layer: 'back' }, { t: 'dark_lamp', x: 450, z: 30 }, { t: 'broken_house', x: 1200, z: -30, layer: 'back' }, { t: 'broken_house', x: 1700, z: -30, layer: 'back' },
    { t: 'dark_lamp', x: 1450, z: 30 }, { t: 'crystal', x: 2200, z: 10 }, { t: 'twisted_tree', x: 2600, z: -20, layer: 'back' }, { t: 'crystal', x: 3200, z: 200 },
    { t: 'crystal', x: 3600, z: 0, layer: 'back' }, { t: 'twisted_tree', x: 4100, z: -20, layer: 'back' }, { t: 'dark_lamp', x: 4600, z: 30 }, { t: 'crystal', x: 5100, z: 210 },
    { t: 'twisted_tree', x: 5600, z: -20, layer: 'back' }, { t: 'crystal', x: 6200, z: 0 }, { t: 'crystal', x: 1000, z: 240, layer: 'front' }, { t: 'crystal', x: 4000, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'shadow_villager', name: '影子村民', look: LOOKS.farmer, dark: true, x: 1300, z: 150, talk: [{ script: [
      L('shadow_villager', '……不要再找了。找回來的東西，總有一天還是會失去。', 'sad'),
      L('hero', '可是……如果不去找，就連擁有的機會都沒有了啊。', 'determined'),
      L('shadow_villager', '……你，好亮。', 'surprised'),
    ] }] },
    { id: 'lost_light', name: '迷失的小光點', look: LOOKS.light, x: 2400, z: 190, talk: [
      { if: '!s7_light_home&!quest:s7_lost', script: [L('lost_light', '我……迷路了……家在很暗很暗的地方的另一邊……', 'sad'), L('hero', '我們一起走吧！走到盡頭，你一定能回家。', 'happy'), QS('s7_lost')] },
      { if: 'quest:s7_lost', script: [L('lost_light', '我會跟在你們後面……走到最亮的地方。', 'normal')] },
      { script: [L('lost_light', '我到家了！謝謝！', 'happy')] },
    ] },
    { id: 'dark_meme_npc', name: '黑暗美美吉', look: 'memetchi', dark: true, x: 3900, z: 140, showIf: '!ch7_meme_done', talk: [{ script: [
      L('dark_meme_npc', '呵呵……甜點？溫柔？那些東西最後都會壞掉的。', 'angry'),
      L('memetchi', '……就算會壞掉，做的時候的心情是真的！', 'determined'),
      { do: 'battle', encounter: ['dark_meme', 'shadow_blob'], flag: 'ch7_meme_done' },
      L('memetchi', '……謝謝妳。我知道妳也是我的一部分。', 'sad'),
    ] }] },
    { id: 'dark_kuchi_npc', name: '黑暗庫奇帕奇', look: 'kuchipatchi', dark: true, x: 1900, z: 120, showIf: '!ch7_kuchi_done', talk: [{ script: [
      L('dark_kuchi_npc', '肚子……永遠都不會飽……吃再多也一樣……', 'angry'),
      L('kuchipatchi', '那是因為你一個人吃！和大家一起吃，才會覺得飽啊！', 'determined'),
      QS('q7_mirror_friends'),
      { do: 'battle', encounter: ['dark_kuchi', 'shadow_blob'], flag: 'ch7_kuchi_done' },
      L('kuchipatchi', '……下次，我分你一半。', 'happy'),
    ] }] },
  ],
  enemies: [
    { id: 'e7a', enemy: 'shadow_blob', party: ['shadow_blob', 'void_eye'], x: 800, z: 110 },
    { id: 'e7b', enemy: 'void_eye', party: ['void_eye', 'void_eye'], x: 2700, z: 150 },
    { id: 'e7c', enemy: 'shadow_blob', party: ['shadow_blob', 'shadow_blob', 'void_eye'], x: 3400, z: 90 },
    { id: 'e7d', enemy: 'void_eye', party: ['void_eye', 'shadow_blob', 'void_eye'], x: 4900, z: 160 },
    { id: 'e7e', enemy: 'shadow_blob', party: ['shadow_blob', 'void_eye', 'shadow_blob'], x: 5500, z: 100 },
  ],
  chests: [
    { id: 'c7_1', x: 600, z: 50, items: [{ id: 'sticker_19', qty: 1 }] },
    { id: 'c7_cr1', x: 2300, z: 40, items: [{ id: 'dark_crystal', qty: 1 }] },
    { id: 'c7_cr2', x: 3250, z: 210, items: [{ id: 'dark_crystal', qty: 1 }, { id: 'cake', qty: 1 }] },
    { id: 'c7_h1', x: 3700, z: 120, items: [{ id: 'dark_crystal', qty: 1 }, { id: 'sticker_20', qty: 1 }], hidden: true },
    { id: 'c7_h2', x: 4700, z: 60, items: [{ id: 'sticker_21', qty: 1 }, { id: 'elixir', qty: 2 }], hidden: true },
    { id: 'c7_2', x: 5300, z: 200, items: [{ id: 'life_mushroom', qty: 1 }, { id: 'feast', qty: 1 }] },
  ],
  objects: [
    { id: 'sign71', type: 'sign', x: 380, z: 170, text: '這、裡、沒、有、出、口。（下面有人用很小的字補充：「騙人的，一直往右走」）' },
    { id: 'save71', type: 'savepoint', x: 1050, z: 60 },
    { id: 'gate71', type: 'gate', x: 2100, z: 0, cond: 'ch7_kuchi_done', w: 1 },
    { id: 'gate72', type: 'gate', x: 4050, z: 0, cond: 'ch7_meme_done', w: 1 },
    { id: 'gate73', type: 'gate', x: 5250, z: 0, cond: 'done:q7_crystals', w: 1 },
    { id: 'heal71', type: 'heal', x: 5700, z: 110 },
    { id: 'save72', type: 'savepoint', x: 5850, z: 60 },
    { id: 'shard7', type: 'shard', x: 6400, z: 120, showIf: 'boss7&!shard7_got' },
  ],
  zones: [
    { type: 'dark', x: 2900, w: 2300 },
    { type: 'pit', x: 2850, w: 260, z0: 0, z1: 240, look: 'void' },
    { type: 'pit', x: 4250, w: 300, z0: 0, z1: 240, look: 'void' },
    { type: 'wind', x: 4600, w: 400, fx: -70, fz: 40 },
  ],
  platforms: [
    { id: 'dk1', x: 2920, z: 120, w: 110, d: 60, dz: 90, period: 2.8, look: 'crystal' },
    { id: 'dk2', x: 3040, z: 120, w: 110, d: 60, dz: -90, period: 2.8, look: 'crystal' },
    { id: 'dk3', x: 4320, z: 130, w: 110, d: 60, dx: 50, dz: 60, period: 3.0, look: 'crystal' },
    { id: 'dk4', x: 4470, z: 110, w: 110, d: 60, dz: -80, period: 2.4, look: 'crystal' },
  ],
  triggers: [
    { id: 't7_crystals', x: 2250, w: 60, if: '!quest:q7_crystals&!done:q7_crystals', once: true, script: [L('oyajitchi', '前面的路被黑暗封住了。收集三個暗晶，就能照亮道路。', 'normal'), QS('q7_crystals')] },
    { id: 't7_truth', x: 5350, w: 80, if: '!t7_truth_done', once: true, block: true, script: [
      FLAG('t7_truth_done'),
      L('oyajitchi', '孩子們，聽我說。永恆吉……是我的老朋友。', 'sad'),
      L('oyajitchi', '我們一起守護過星之心。他是個比誰都溫柔的守護者，會聽每一個人的心聲。', 'normal'),
      L('oyajitchi', '但他聽了太多離別和悲傷……有一天他對我說：「如果什麼都不會改變，就不會有人哭了。」', 'sad'),
      L('oyajitchi', '那天之後，他就消失了。我沒能阻止他……這是我一直後悔的事。', 'sad'),
      L('hero', '老爺爺……我們一起把他帶回來吧。', 'determined'),
    ] },
    { id: 't7_light', x: 6000, w: 100, if: 'quest:s7_lost&boss7', once: true, script: [L('lost_light', '是光！我看到家了！', 'happy'), FLAG('s7_light_home')] },
  ],
  boss: {
    id: 'boss7', enemy: 'dark_mametchi', party: ['dark_mametchi'], x: 6150, z: 120, flag: 'boss7', music: 'boss',
    pre: [
      QS('q7_boss'), SHAKE(600), SFX('shake'),
      L('dark_mametchi', '你終於來了，我。', 'angry'),
      L('hero', '你……是我？', 'surprised'),
      L('dark_mametchi', '我是你心裡的不安。你也害怕吧？害怕失敗、害怕大家離開、害怕一切都改變。', 'angry'),
      { choice: [
        { text: '「我也會害怕。但是我不會逃避。」', flag: ['ch7_choice', 'light'] },
        { text: '「我才不害怕！」', flag: ['ch7_choice', 'shadow'] },
      ], who: 'hero', prompt: '要怎麼回答？' },
      IF('ch7_choice=light',
        [L('dark_mametchi', '……承認了啊。那就證明給我看，你帶著害怕也能往前走！', 'angry')],
        [L('dark_mametchi', '說謊。我就是你的害怕——打倒我，你也不會變勇敢！', 'angry')]),
      { do: 'battle', encounter: ['dark_mametchi'], boss: true, flag: 'boss7', music: 'boss' },
    ],
    post: [
      IF('ch7_choice=light', [
        L('dark_mametchi', '……你贏了。帶著我一起走吧，害怕的心情也是你的一部分。', 'happy'),
        GIVE('b_light'), N('黑暗麻美吉化成溫暖的光，變成了「心之光徽章」。'),
      ], [
        L('dark_mametchi', '……哼。那就把我的力量拿去。總有一天你會需要承認我。', 'normal'),
        GIVE('b_shadow'), N('黑暗麻美吉化成黑色的光，變成了「暗影徽章」。'),
      ]),
      SFX('shard'), N('影子消失的地方，留下了一塊深藍色的碎片。'),
    ],
  },
  outro: [
    FLAG('shard7_got'), GIVE('shard7'), SFX('shard'), FLASH(0xfff6a0),
    N('取得了星之心碎片（7/8）！'),
    SHAKE(800), SFX('shake'),
    L('eternatchi', '……到這裡就好了，孩子們。', 'normal'),
    L('oyajitchi', '永恆吉！', 'surprised'),
    L('eternatchi', '老朋友，你還是一樣。為什麼要讓他們繼續受傷？只要世界停下來，大家就會永遠幸福。', 'sad'),
    L('hero', '停下來的世界，不是幸福，是孤單！', 'angry'),
    L('eternatchi', '……那就來最終神殿吧。我會讓你們明白的。', 'normal'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q7_mirror_friends', 'q7_crystals', 'q7_boss', 's7_lost'],
  partner: 'oyajitchi',
};

void MUSIC;
