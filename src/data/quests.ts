import type { QuestDef } from './types';

const list: QuestDef[] = [
  // Chapter 1
  { id: 'q1_elder', chapter: 1, type: 'main', title: '神秘的長者', desc: '村莊廣場附近有一位留著白鬍子的長者，去找他談談。', objective: { kind: 'flag', flag: 'ch1_met_elder' }, reward: { exp: 10 } },
  { id: 'q1_villagers', chapter: 1, type: 'main', title: '迷路的村民', desc: '星之心碎掉後，三位村民失去記憶走丟了。把他們找回來吧！', objective: { kind: 'flags', flags: ['found_v1', 'found_v2', 'found_v3'] }, reward: { exp: 30, coins: 20 } },
  { id: 'q1_bell', chapter: 1, type: 'main', title: '村莊的小鈴鐺', desc: '村長的鈴鐺被放在東邊倉庫的寶箱裡。', objective: { kind: 'collect', item: 'village_bell', count: 1 }, reward: { exp: 20 } },
  { id: 'q1_boss', chapter: 1, type: 'main', title: '廣場的守護者', desc: '廣場上的守護石像開始暴走了！阻止它。', objective: { kind: 'flag', flag: 'boss1' } },
  { id: 's1_doll', chapter: 1, type: 'side', title: '小布偶在哪裡？', desc: '村裡的小朋友弄丟了布偶，聽說掉在池塘附近。', objective: { kind: 'flag', flag: 's1_doll_returned' }, reward: { exp: 25, items: [{ id: 'b_flower', qty: 1 }] } },
  { id: 's1_blobs', chapter: 1, type: 'side', title: '果凍大掃除', desc: '幫守衛打倒 3 隻嘟嘟果凍。', objective: { kind: 'defeat', enemy: 'grumble_blob', count: 3 }, reward: { exp: 20, coins: 15, items: [{ id: 'onigiri', qty: 2 }] } },
  // Chapter 2
  { id: 'q2_compass', chapter: 2, type: 'main', title: '糖果指南針', desc: '森林入口的糖果師傅說，沒有指南針會在迷宮裡迷路。', objective: { kind: 'collect', item: 'candy_compass', count: 1 }, reward: { exp: 40 } },
  { id: 'q2_river', chapter: 2, type: 'main', title: '越過巧克力河', desc: '利用漂浮的餅乾平台越過巧克力河。', objective: { kind: 'flag', flag: 'ch2_crossed' }, reward: { exp: 40 } },
  { id: 'q2_maze', chapter: 2, type: 'main', title: '糖果迷宮', desc: '按照正確順序敲響迷宮裡的三個糖果開關。', objective: { kind: 'flag', flag: 'ch2_maze_open' }, reward: { exp: 60 } },
  { id: 'q2_boss', chapter: 2, type: 'main', title: '暴走的樹王', desc: '森林中心的糖果樹王失控了。', objective: { kind: 'flag', flag: 'boss2' } },
  { id: 's2_flowers', chapter: 2, type: 'side', title: '糖霜花束', desc: '美美吉想做一個花束，收集 3 朵糖霜花。', objective: { kind: 'collect', item: 'candy_flower', count: 3 }, takeItems: true, reward: { exp: 60, items: [{ id: 'cake', qty: 2 }] } },
  // Chapter 3
  { id: 'q3_feather', chapter: 3, type: 'main', title: '風之羽毛', desc: '風車小屋的老奶奶有能乘上氣流的羽毛。', objective: { kind: 'collect', item: 'wind_feather', count: 1 }, reward: { exp: 80 } },
  { id: 'q3_windmills', chapter: 3, type: 'main', title: '重啟風車', desc: '啟動兩座停止的風車，讓漂浮島重新連接。', objective: { kind: 'flags', flags: ['ch3_mill1', 'ch3_mill2'] }, reward: { exp: 120 } },
  { id: 'q3_boss', chapter: 3, type: 'main', title: '天空神殿的暴風', desc: '天空神殿上空盤旋著一條暴風雲龍。', objective: { kind: 'flag', flag: 'boss3' } },
  { id: 's3_cotton', chapter: 3, type: 'side', title: '雲朵棉被', desc: '雲朵城市的居民想要 3 團雲朵棉花做棉被。', objective: { kind: 'collect', item: 'cloud_cotton', count: 3 }, takeItems: true, reward: { exp: 120, items: [{ id: 'b_coin', qty: 1 }] } },
  // Chapter 4
  { id: 'q4_card', chapter: 4, type: 'main', title: '工廠通行證', desc: '找到工廠通行證才能進入生產線。', objective: { kind: 'collect', item: 'factory_card', count: 1 }, reward: { exp: 150 } },
  { id: 'q4_power', chapter: 4, type: 'main', title: '電源控制室', desc: '依照「紅、藍、黃」的順序打開電源開關。', objective: { kind: 'flag', flag: 'ch4_power' }, reward: { exp: 200 } },
  { id: 'q4_boss', chapter: 4, type: 'main', title: '超級機器人', desc: '工廠最深處的超級機器人失控了。', objective: { kind: 'flag', flag: 'boss4' } },
  { id: 's4_gears', chapter: 4, type: 'side', title: '壞掉的玩具', desc: '玩具修理師需要 2 個玩具齒輪。', objective: { kind: 'collect', item: 'gear_part', count: 2 }, takeItems: true, reward: { exp: 200, items: [{ id: 'thunder_bomb', qty: 2 }, { id: 'b_first', qty: 1 }] } },
  // Chapter 5
  { id: 'q5_helmet', chapter: 5, type: 'main', title: '泡泡頭盔', desc: '向海邊的發明家借泡泡頭盔才能潛水。', objective: { kind: 'collect', item: 'bubble_helmet', count: 1 }, reward: { exp: 250 } },
  { id: 'q5_ruins', chapter: 5, type: 'main', title: '海底遺跡之門', desc: '在沉船裡找到打開遺跡大門的方法。', objective: { kind: 'flag', flag: 'ch5_ruins_open' }, reward: { exp: 300 } },
  { id: 'q5_boss', chapter: 5, type: 'main', title: '古代守護者', desc: '遺跡深處沉睡著古代守護者。', objective: { kind: 'flag', flag: 'boss5' } },
  { id: 's5_pearls', chapter: 5, type: 'side', title: '彩虹珍珠', desc: '人魚歌手想要 3 顆彩虹珍珠做項鍊。', objective: { kind: 'collect', item: 'pearl', count: 3 }, takeItems: true, reward: { exp: 300, items: [{ id: 'elixir', qty: 2 }] } },
  // Chapter 6
  { id: 'q6_mirror', chapter: 6, type: 'main', title: '鏡子迷宮', desc: '穿過鏡子迷宮。有些門會把你送回原點。', objective: { kind: 'flag', flag: 'ch6_mirror_done' }, reward: { exp: 350 } },
  { id: 'q6_memory', chapter: 6, type: 'main', title: '記憶解謎', desc: '點亮記憶燭台。正確的順序藏在畫廊裡畫像們說的故事中。', objective: { kind: 'flag', flag: 'ch6_memory_done' }, reward: { exp: 400 } },
  { id: 'q6_boss', chapter: 6, type: 'main', title: '失憶的騎士', desc: '王座廳的騎士忘記了自己是誰。', objective: { kind: 'flag', flag: 'boss6' } },
  { id: 's6_candles', chapter: 6, type: 'side', title: '幽靈的請求', desc: '友善的幽靈想要 2 根記憶蠟燭，好想起自己的名字。', objective: { kind: 'collect', item: 'candle', count: 2 }, takeItems: true, reward: { exp: 400, items: [{ id: 'b_heart', qty: 1 }] } },
  // Chapter 7
  { id: 'q7_mirror_friends', chapter: 7, type: 'main', title: '黑暗中的夥伴', desc: '打倒黑暗異世界中的夥伴影子。', objective: { kind: 'defeat', enemy: 'dark_kuchi', count: 1 }, reward: { exp: 500 } },
  { id: 'q7_crystals', chapter: 7, type: 'main', title: '光與影的機關', desc: '影子麻美吉會反方向模仿你的動作。讓「光」和「影」的踏板同時亮起來！（紫色柵欄只擋得住影子）', objective: { kind: 'flag', flag: 'ch7_mirror' }, reward: { exp: 700 } },
  { id: 'q7_boss', chapter: 7, type: 'main', title: '另一個自己', desc: '道路盡頭有一個和麻美吉一模一樣的影子。', objective: { kind: 'flag', flag: 'boss7' } },
  { id: 's7_lost', chapter: 7, type: 'side', title: '小光的心願', desc: '陪著小光走到黑暗的盡頭。她說，她在找一個很重要的人。', objective: { kind: 'flag', flag: 's7_light_home' }, reward: { exp: 600, items: [{ id: 'elixir', qty: 1 }, { id: 'star_candy', qty: 3 }] } },
  // Chapter 8
  { id: 'q8_seals', chapter: 8, type: 'main', title: '三道星之封印', desc: '解開神殿的三道星之封印。', objective: { kind: 'flags', flags: ['ch8_seal1', 'ch8_seal2', 'ch8_seal3'] }, reward: { exp: 800 } },
  { id: 'q8_final', chapter: 8, type: 'main', title: '星之心的真相', desc: '前往神殿最深處，面對永恆吉。', objective: { kind: 'flag', flag: 'boss8' } },
  // v2 story quests
  { id: 'q2_chase', chapter: 2, type: 'main', title: '口香糖大追擊', desc: '灰灰兄弟推來了巨大的口香糖球！一路往右跑，別被追上！', objective: { kind: 'flag', flag: 'ch2_chase_done' }, reward: { exp: 70 } },
  { id: 'q3_listen', chapter: 3, type: 'main', title: '看不見的雲', desc: '神殿前的裂縫上有看不見的雲朵。讓咪咪吉用「順風耳」聽出它們在哪裡（按 C）。', objective: { kind: 'flag', flag: 'ch3_crossed' }, reward: { exp: 100 } },
  { id: 'q4_bros', chapter: 4, type: 'main', title: '控制室的灰灰兄弟', desc: '灰灰兄弟佔領了中央控制室，把生產線弄亂了。打倒他們，修好生產線！', objective: { kind: 'flags', flags: ['ch4_bros', 'ch4_line_fixed'] }, reward: { exp: 300, coins: 50 } },
  { id: 'q5_escape', chapter: 5, type: 'main', title: '黑暗中的大嘴巴', desc: '巨大的鮟鱇魚追上來了！往右逃！', objective: { kind: 'flag', flag: 'ch5_chase_done' }, reward: { exp: 300 } },
  { id: 'q6_clues', chapter: 6, type: 'main', title: '會說話的畫像', desc: '畫廊裡的三幅畫像知道記憶燭台的順序。去聽聽他們的故事。', objective: { kind: 'flags', flags: ['ch6_clue1', 'ch6_clue2', 'ch6_clue3'] }, reward: { exp: 350 } },
  { id: 'q6_quiz', chapter: 6, type: 'main', title: '記憶之門的提問', desc: '記憶之門會問你三個問題。回想一路上看到的回憶吧！', objective: { kind: 'flag', flag: 'ch6_quiz_done' }, reward: { exp: 400 } },
  { id: 'q7_rescue', chapter: 7, type: 'main', title: '被帶走的夥伴', desc: '灰灰兄弟把夥伴們帶走了。和老爺爺吉一起，把大家救回來！', objective: { kind: 'flags', flags: ['ch7_free1', 'ch7_free2', 'ch7_free3'] }, reward: { exp: 800 } },
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(list.map((q) => [q.id, q]));
