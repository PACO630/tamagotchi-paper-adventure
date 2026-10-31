import type { ItemDef } from './types';

const items: ItemDef[] = [
  // Healing
  { id: 'apple', name: '紅蘋果', kind: 'heal', desc: '脆脆的蘋果。回復 5 HP。', icon: { shape: 'apple', color: '#ff0000' }, hp: 5, target: 'ally', fieldUse: true },
  { id: 'onigiri', name: '飯糰', kind: 'heal', desc: '大大的三角飯糰。回復 10 HP。', icon: { shape: 'cookie', color: '#ffffff', accent: '#000000' }, hp: 10, target: 'ally', fieldUse: true },
  { id: 'cake', name: '草莓蛋糕', kind: 'heal', desc: '美眉吉推薦！回復 20 HP。', icon: { shape: 'cake', color: '#ffc0e0', accent: '#ff0000' }, hp: 20, target: 'ally', fieldUse: true },
  { id: 'feast', name: '豪華便當', kind: 'heal', desc: '大家一起吃！全隊回復 15 HP。', icon: { shape: 'cake', color: '#ff8040', accent: '#ffff00' }, hp: 15, target: 'allAllies', fieldUse: true },
  { id: 'juice', name: '星星果汁', kind: 'sp', desc: '冰涼果汁。回復 5 技能點數。', icon: { shape: 'bottle', color: '#ff8040' }, sp: 5, target: 'ally', fieldUse: true },
  { id: 'star_candy', name: '星星糖', kind: 'sp', desc: '亮晶晶的糖果。回復 12 技能點數。', icon: { shape: 'star', color: '#ffff00' }, sp: 12, target: 'ally', fieldUse: true },
  { id: 'elixir', name: '彩虹汽水', kind: 'heal', desc: '回復 30 HP 和 10 技能點數。', icon: { shape: 'bottle', color: '#80ffff', accent: '#ff00ff' }, hp: 30, sp: 10, target: 'ally', fieldUse: true },
  { id: 'life_mushroom', name: '復活香菇', kind: 'revive', desc: '讓倒下的隊友以一半 HP 站起來。', icon: { shape: 'mushroom', color: '#00ff80', accent: '#ffffff' }, hp: 50, target: 'ally' },
  { id: 'herb_tea', name: '草本茶', kind: 'cure', desc: '治好所有不良狀態並回復 3 HP。', icon: { shape: 'leaf', color: '#00a000' }, hp: 3, target: 'ally', fieldUse: true },
  // Buffs
  { id: 'power_cookie', name: '力量餅乾', kind: 'buff', desc: '攻擊力上升 3 回合。', icon: { shape: 'cookie', color: '#c08040', accent: '#ff0000' }, status: { type: 'atkUp', turns: 3, chance: 1, amount: 2 }, target: 'ally' },
  { id: 'iron_bread', name: '鐵板麵包', kind: 'buff', desc: '防禦力上升 3 回合。', icon: { shape: 'cookie', color: '#c0c0c0', accent: '#0000ff' }, status: { type: 'defUp', turns: 3, chance: 1, amount: 2 }, target: 'ally' },
  // Battle items
  { id: 'fire_candy', name: '火焰糖', kind: 'battle', desc: '丟向敵人造成 6 傷害並燃燒。', icon: { shape: 'candy', color: '#ff4000', accent: '#ffff00' }, damage: 6, status: { type: 'burn', turns: 3, chance: 0.8, amount: 1 }, target: 'enemy' },
  { id: 'thunder_bomb', name: '雷電炸彈', kind: 'battle', desc: '對所有敵人造成 5 傷害。', icon: { shape: 'bomb', color: '#000080', accent: '#ffff00' }, damage: 5, target: 'allEnemies' },
  { id: 'sleep_bubble', name: '睡眠泡泡', kind: 'battle', desc: '讓所有敵人可能睡著。', icon: { shape: 'ring', color: '#8080ff' }, status: { type: 'sleep', turns: 2, chance: 0.7 }, target: 'allEnemies' },
  { id: 'pop_rock', name: '跳跳糖', kind: 'battle', desc: '對一名敵人造成 3 傷害並可能頭暈。', icon: { shape: 'candy', color: '#ff00ff', accent: '#00ffff' }, damage: 3, status: { type: 'dizzy', turns: 1, chance: 0.5 }, target: 'enemy' },
  // Badges (equipment)
  { id: 'b_power', name: '力量徽章', kind: 'badge', desc: '裝備後攻擊力 +1。', icon: { shape: 'badge', color: '#ff0000' }, badge: { atk: 1 } },
  { id: 'b_guard', name: '守護徽章', kind: 'badge', desc: '裝備後防禦力 +1。', icon: { shape: 'badge', color: '#0000ff' }, badge: { def: 1 } },
  { id: 'b_heart', name: '愛心徽章', kind: 'badge', desc: '裝備後最大 HP +8。', icon: { shape: 'badge', color: '#ff0080' }, badge: { maxHP: 8 } },
  { id: 'b_flower', name: '花朵徽章', kind: 'badge', desc: '裝備後最大技能點數 +6。', icon: { shape: 'badge', color: '#ffff00' }, badge: { maxSP: 6 } },
  { id: 'b_spike', name: '防刺徽章', kind: 'badge', desc: '可以踩刺刺的敵人而不受傷。', icon: { shape: 'badge', color: '#808080' }, badge: { special: 'spikeGuard' } },
  { id: 'b_learn', name: '學習徽章', kind: 'badge', desc: '戰鬥獲得的經驗值增加 50%。', icon: { shape: 'badge', color: '#00ff80' }, badge: { special: 'expUp' } },
  { id: 'b_coin', name: '招財徽章', kind: 'badge', desc: '戰鬥獲得的金幣加倍。', icon: { shape: 'badge', color: '#ffd700' }, badge: { special: 'coinUp' } },
  { id: 'b_first', name: '先手徽章', kind: 'badge', desc: '在地圖上碰到敵人時，一定先手攻擊。', icon: { shape: 'badge', color: '#ff8040' }, badge: { special: 'firstStrike' } },
  { id: 'b_perfect', name: '完美防禦徽章', kind: 'badge', desc: '防禦按鍵的判定時間變長。', icon: { shape: 'badge', color: '#00ffff' }, badge: { special: 'guardPlus' } },
  { id: 'b_vampire', name: '吸收徽章', kind: 'badge', desc: '普通攻擊命中時回復 1 HP。', icon: { shape: 'badge', color: '#800080' }, badge: { special: 'hpDrain' } },
  { id: 'b_star', name: '星光徽章', kind: 'badge', desc: '攻擊力 +2、防禦力 +1。', icon: { shape: 'badge', color: '#ffff80', accent: '#ff8040' }, badge: { atk: 2, def: 1 } },
  { id: 'b_light', name: '心之光徽章', kind: 'badge', desc: '最大 HP +10、技能點數 +5。只有溫柔的人才能得到。', icon: { shape: 'badge', color: '#ffffff', accent: '#ff80c0' }, badge: { maxHP: 10, maxSP: 5 } },
  { id: 'b_shadow', name: '暗影徽章', kind: 'badge', desc: '攻擊力 +3，但防禦力 -1。', icon: { shape: 'badge', color: '#202020', accent: '#8000ff' }, badge: { atk: 3, def: -1 } },
  // Key items
  { id: 'star_sensor', name: '星之感應器', kind: 'key', desc: '麻每吉發明的裝置，能感應星之心碎片的方向。', icon: { shape: 'gear', color: '#ffd700', accent: '#0080ff' } },
  { id: 'village_bell', name: '村莊的小鈴鐺', kind: 'key', desc: '村長的鈴鐺，搖一搖可以讓大家想起回家的路。', icon: { shape: 'ring', color: '#ffd700' } },
  { id: 'candy_compass', name: '糖果指南針', kind: 'key', desc: '指向糖果森林深處的指南針。', icon: { shape: 'candy', color: '#ff80c0', accent: '#ffffff' } },
  { id: 'wind_feather', name: '風之羽毛', kind: 'key', desc: '能夠乘著上升氣流的神奇羽毛。', icon: { shape: 'feather', color: '#80ffff' } },
  { id: 'factory_card', name: '工廠通行證', kind: 'key', desc: '玩具工廠的員工通行證。', icon: { shape: 'key', color: '#ff8040' } },
  { id: 'secret_record', name: '秘密紀錄', kind: 'key', desc: '星之心破碎前一晚的監視紀錄。上面有一個熟悉的身影…', icon: { shape: 'scroll', color: '#ffffc0', accent: '#800000' } },
  { id: 'bubble_helmet', name: '泡泡頭盔', kind: 'key', desc: '可以在海底自由呼吸的泡泡頭盔。', icon: { shape: 'ring', color: '#80ffff', accent: '#ffffff' } },
  { id: 'memory_page', name: '記憶之頁', kind: 'key', desc: '城堡歷史書遺失的一頁，記載著星之守護者的故事。', icon: { shape: 'book', color: '#c0a0ff' } },
  { id: 'gear_part', name: '玩具齒輪', kind: 'key', desc: '修理玩具需要的齒輪零件。', icon: { shape: 'gear', color: '#c0c0c0' } },
  { id: 'pearl', name: '彩虹珍珠', kind: 'key', desc: '海底閃閃發光的珍珠。', icon: { shape: 'gem', color: '#ffc0ff' } },
  { id: 'candle', name: '記憶蠟燭', kind: 'key', desc: '點亮後能看見過去的蠟燭。', icon: { shape: 'bottle', color: '#ffff80', accent: '#ff8040' } },
  { id: 'lost_doll', name: '小布偶', kind: 'key', desc: '村裡小朋友弄丟的布偶。', icon: { shape: 'heart', color: '#ff8040' } },
  { id: 'candy_flower', name: '糖霜花', kind: 'key', desc: '糖果森林才有的花，甜甜的。', icon: { shape: 'leaf', color: '#ff80ff' } },
  { id: 'cloud_cotton', name: '雲朵棉花', kind: 'key', desc: '軟綿綿的雲朵碎片。', icon: { shape: 'ring', color: '#ffffff', accent: '#80c0ff' } },
  { id: 'dark_crystal', name: '暗晶', kind: 'key', desc: '黑暗異世界的結晶，冷冰冰的。', icon: { shape: 'gem', color: '#400080' } },
];

const shardColors = ['#ff4040', '#ff80ff', '#80ffff', '#ff8040', '#4080ff', '#c080ff', '#202060', '#ffff40'];
for (let i = 1; i <= 8; i++) {
  items.push({
    id: `shard${i}`, name: `星之心碎片 ${['一', '二', '三', '四', '五', '六', '七', '八'][i - 1]}`, kind: 'key',
    desc: `星之心的第 ${i} 塊碎片，摸起來暖暖的，好像在跳動。`, icon: { shape: 'shard', color: shardColors[i - 1], accent: '#ffffff' },
  });
}

const stickerNames = [
  '跳舞的蘋果', '睡覺的雲', '生氣的太陽', '微笑石頭', '彩虹蝸牛', '戴帽子的貓', '會飛的魚', '哭哭的冰淇淋',
  '棒棒糖國王', '紙飛機', '閃亮星星', '鬍子月亮', '三隻小鳥', '翻滾齒輪', '發條兔', '海星朋友',
  '章魚畫家', '城堡門口', '幽靈好朋友', '水晶花', '黑暗中的燈', '紙片皇冠', '大家的合照', '星之心',
];
stickerNames.forEach((n, i) => {
  items.push({
    id: `sticker_${i + 1}`, name: `貼紙：${n}`, kind: 'collectible', desc: `第 ${i + 1} 號收藏貼紙。畫得歪歪的，但很可愛。`,
    icon: { shape: 'sticker', color: ['#ff8040', '#80ffff', '#ffff80', '#ff80c0', '#80ff80', '#c0a0ff'][i % 6], accent: '#000000' },
  });
});

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(items.map((i) => [i.id, i]));
export const STICKER_COUNT = stickerNames.length;

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
