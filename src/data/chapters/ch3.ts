import type { ChapterDef } from '../types';
import { FLAG, FLASH, GIVE, JOIN, L, LOOKS, MUSIC, N, QS, SFX, SHAKE, WAIT } from './helpers';

export const ch3: ChapterDef = {
  id: 'ch3', num: 3, title: '第三章：雲朵天空島', location: '雲朵天空島',
  summary: '搭乘飛行器來到天空島。島嶼正在一塊塊分裂，風車也停止了轉動。',
  music: 'sky', weather: 'clouds', width: 6400, start: { x: 180, z: 130 },
  theme: {
    id: 'sky', skyTop: 0x5ab0ff, skyBottom: 0xd8f0ff, far: 0xe8f4ff, farAccent: 0xffffff, mid: 0xb8dcff, midAccent: 0xffffff,
    ground: 0xf4f8ff, groundAccent: 0xc8dcf8, groundEdge: 0xffffff, pitColor: 0x8ac8ff, light: 0xffffff, ambient: 0xf0f8ff,
    sun: 'sun', farShape: 'clouds', midShape: 'clouds', groundPattern: 'cloud',
  },
  mapNodes: [{ name: '降落平台', x: 200 }, { name: '風車小屋', x: 1100 }, { name: '漂浮島群', x: 2400 }, { name: '雲朵城市', x: 3800 }, { name: '天空神殿', x: 5800 }],
  intro: [
    MUSIC('sky'),
    N('舊飛行器搖搖晃晃地飛上了天，降落在雲朵天空島上。'),
    L('memetchi', '好高喔！下面的雲好像棉花糖！', 'happy'),
    SHAKE(500), SFX('shake'),
    L('kuchipatchi', '哇！地面裂開了！島……島在分裂！', 'surprised'),
    L('hero', '風車都停了，島嶼之間的氣流也亂掉了。先去風車小屋看看！', 'determined'),
  ],
  props: [
    { t: 'balloon', x: 160, z: -20, layer: 'back' }, { t: 'cloud_puff', x: 420, z: 220, layer: 'front' }, { t: 'windmill', x: 1050, z: -20, layer: 'back' }, { t: 'sky_column', x: 1400, z: 10 },
    { t: 'float_rock', x: 1900, z: -40, layer: 'back' }, { t: 'cloud_puff', x: 2500, z: 240, layer: 'front' }, { t: 'windmill', x: 3000, z: -10, layer: 'back' }, { t: 'house_b', x: 3700, z: -20, layer: 'back' },
    { t: 'house_b', x: 4100, z: -30, layer: 'back' }, { t: 'sky_column', x: 3950, z: 20 }, { t: 'balloon', x: 4500, z: -20, layer: 'back' }, { t: 'windmill', x: 4900, z: -10, layer: 'back' },
    { t: 'sky_column', x: 5600, z: 10 }, { t: 'sky_column', x: 6100, z: 10 }, { t: 'float_rock', x: 5300, z: -40, layer: 'back' }, { t: 'cloud_puff', x: 5900, z: 240, layer: 'front' },
  ],
  npcs: [
    { id: 'windgran', name: '風車婆婆', look: LOOKS.granny, x: 1100, z: 130, talk: [
      { if: '!item:wind_feather', script: [
        L('windgran', '哎呀，地上的孩子們。風車停了以後，島嶼就一直在分開。', 'worried'),
        L('windgran', '帶著這根「風之羽毛」吧。拿著它，就能乘著風車的上升氣流。', 'normal'),
        GIVE('wind_feather'), QS('q3_feather'),
        L('windgran', '島上還有兩座停下的風車。敲一敲風車的開關，讓它們重新轉起來吧！', 'happy'), QS('q3_windmills'),
      ] },
      { script: [L('windgran', '風很強的地方，要逆著風走才不會被吹走喔。', 'normal')] },
    ] },
    { id: 'mimitchi', name: '咪咪吉', look: 'mimitchi', x: 3500, z: 150, showIf: '!joined:mimitchi', talk: [{ script: [
      L('mimitchi', '～啦啦～咦，有聲音！是地上來的朋友！', 'surprised'),
      L('mimitchi', '我本來在雲朵城市唱歌，結果風一亂，就被困在這裡了。', 'sad'),
      L('hero', '我們要去天空神殿找星之心碎片，一起走吧！', 'happy'),
      L('mimitchi', '好呀！我的耳朵很靈，可以聽到風的方向！', 'determined'),
      JOIN('mimitchi'), SFX('join'), N('咪咪吉成為了夥伴！可以使用「耳朵旋風」攻擊所有敵人。'),
    ] }] },
    { id: 'cloud_citizen', name: '雲朵居民', look: LOOKS.cloudling, x: 4000, z: 180, talk: [
      { if: '!quest:s3_cotton&!done:s3_cotton', script: [L('cloud_citizen', '晚上好冷……可以幫我找 3 團雲朵棉花嗎？我想做一條棉被。', 'sad'), QS('s3_cotton')] },
      { if: 'quest:s3_cotton', script: [L('cloud_citizen', '雲朵棉花常常藏在看不見的地方喔。', 'normal')] },
      { script: [L('cloud_citizen', '棉被好溫暖！這個招財徽章送你！', 'happy')] },
    ] },
  ],
  enemies: [
    { id: 'e3a', enemy: 'puff_cloud', party: ['puff_cloud', 'puff_cloud'], x: 800, z: 100 },
    { id: 'e3b', enemy: 'gale_bird', party: ['gale_bird', 'puff_cloud'], x: 1750, z: 160 },
    { id: 'e3c', enemy: 'sky_beetle', party: ['sky_beetle', 'gale_bird'], x: 3300, z: 90 },
    { id: 'e3d', enemy: 'puff_cloud', party: ['puff_cloud', 'sky_beetle', 'gale_bird'], x: 4400, z: 150 },
    { id: 'e3e', enemy: 'gale_bird', party: ['gale_bird', 'gale_bird', 'sky_beetle'], x: 5300, z: 120 },
  ],
  chests: [
    { id: 'c3_1', x: 600, z: 40, items: [{ id: 'sticker_7', qty: 1 }] },
    { id: 'c3_h1', x: 1550, z: 200, items: [{ id: 'cloud_cotton', qty: 1 }, { id: 'star_candy', qty: 1 }], hidden: true },
    { id: 'c3_2', x: 2650, z: 40, items: [{ id: 'cloud_cotton', qty: 1 }, { id: 'sticker_8', qty: 1 }] },
    { id: 'c3_h2', x: 4250, z: 60, items: [{ id: 'cloud_cotton', qty: 1 }], hidden: true },
    { id: 'c3_3', x: 4700, z: 210, items: [{ id: 'cake', qty: 1 }, { id: 'iron_bread', qty: 1 }] },
    { id: 'c3_h3', x: 5150, z: 200, items: [{ id: 'sticker_9', qty: 1 }, { id: 'elixir', qty: 1 }], hidden: true },
  ],
  objects: [
    { id: 'sign31', type: 'sign', x: 450, z: 160, text: '注意：強風區會把你往旁邊推。羽毛能讓你在風中跳得更遠。' },
    { id: 'save31', type: 'savepoint', x: 1300, z: 80 },
    { id: 'gate31', type: 'gate', x: 1980, z: 0, cond: 'item:wind_feather', w: 1 },
    { id: 'mill1', type: 'switch', x: 2850, z: 120, flag: 'ch3_mill1', text: '風車１' },
    { id: 'mill2', type: 'switch', x: 4850, z: 120, flag: 'ch3_mill2', text: '風車２' },
    { id: 'spring31', type: 'spring', x: 4950, z: 170 },
    { id: 'gate32', type: 'gate', x: 5450, z: 0, cond: 'ch3_mill1&ch3_mill2', w: 1 },
    { id: 'heal31', type: 'heal', x: 5550, z: 130 },
    { id: 'save32', type: 'savepoint', x: 5650, z: 60 },
    { id: 'shard3', type: 'shard', x: 6200, z: 120, showIf: 'boss3&!shard3_got' },
  ],
  zones: [
    { type: 'pit', x: 2100, w: 500, z0: 0, z1: 240, look: 'sky' },
    { type: 'wind', x: 2950, w: 400, fx: -90 },
    { type: 'pit', x: 5040, w: 200, z0: 0, z1: 240, look: 'sky' },
    { type: 'wind', x: 3800, w: 300, fz: 60 },
  ],
  platforms: [
    { id: 'cl1', x: 2170, z: 120, w: 120, d: 60, dx: 60, period: 3.0, look: 'cloud' },
    { id: 'cl2', x: 2340, z: 100, w: 120, d: 60, dz: 90, period: 3.6, look: 'cloud' },
    { id: 'cl3', x: 2500, z: 130, w: 120, d: 60, dx: -50, period: 2.8, look: 'cloud' },
  ],
  triggers: [
    { id: 't3_temple', x: 5500, w: 60, if: 'ch3_mill1&ch3_mill2', once: true, script: [L('hero', '兩座風車都轉起來了！島嶼連起來了！', 'happy'), L('mimitchi', '神殿上面……有很大很大的風聲。', 'worried')] },
  ],
  boss: {
    id: 'boss3', enemy: 'storm_dragon', party: ['storm_dragon', 'puff_cloud'], x: 5950, z: 120, flag: 'boss3', music: 'boss',
    pre: [
      QS('q3_boss'), SHAKE(800), SFX('shake'),
      L('storm_dragon', '吼——！誰也不許靠近星之光！', 'angry'),
      L('mimitchi', '它一直在天上飛……鎚子打不到！', 'worried'),
      L('hero', '那就跳起來踩它！連續踩兩次，它就會掉下來！', 'determined'),
      { do: 'battle', encounter: ['storm_dragon', 'puff_cloud'], boss: true, flag: 'boss3', music: 'boss' },
    ],
    post: [
      L('storm_dragon', '……原來你們不是來搶碎片的。', 'sad'),
      L('storm_dragon', '神殿的主人離開很久了。他說「再也不想看到任何改變」，然後把碎片丟進了雲裡。', 'normal'),
      SFX('shard'), N('暴雲散開，一塊藍色的碎片落了下來。'),
    ],
  },
  outro: [
    FLAG('shard3_got'), GIVE('shard3'), SFX('shard'), FLASH(0xfff6a0),
    N('取得了星之心碎片（3/8）！天空島的裂縫慢慢合了起來。'),
    L('hero', '「不想看到任何改變」……那個人到底是誰？', 'worried'),
    L('mimitchi', '我聽到了……感應器的方向傳來齒輪轉動的聲音。', 'normal'),
    L('kuchipatchi', '是玩具工廠！那裡的玩具最好玩了！', 'happy'),
    WAIT(300), { do: 'chapterEnd' },
  ],
  quests: ['q3_feather', 'q3_windmills', 'q3_boss', 's3_cotton'],
  partner: 'mimitchi',
};

void MUSIC;
