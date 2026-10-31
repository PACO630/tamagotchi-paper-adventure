import type { CharId, SkillDef } from './types';

const list: SkillDef[] = [
  // Basic commands (power is added to the user's ATK)
  { id: 'hammer', name: '鎚子攻擊', sp: 0, desc: '用紙片鎚子敲打。時機按下確認可加重傷害。無法打到飛行敵人。時機完美（Great）還會把敵人敲皺，防禦下降。', target: 'enemy', kind: 'damage', power: 1, command: 'timing', fx: 'hammer' },
  { id: 'jump', name: '跳躍攻擊', sp: 0, desc: '跳到敵人頭上踩兩下。落地瞬間按下確認可再踩一次。刺刺的敵人不能踩。', target: 'enemy', kind: 'damage', power: 0, hits: 2, command: 'jump', hitsFlying: true, fx: 'jump' },
  // Mametchi
  { id: 'spark_hammer', name: '火花鎚', sp: 3, desc: '發明家改造的鎚子，可能讓敵人著火。', target: 'enemy', kind: 'damage', power: 3, command: 'timing', status: { type: 'burn', turns: 3, chance: 0.4, amount: 1 }, fx: 'fire' },
  { id: 'gadget_shield', name: '發明護盾', sp: 4, desc: '展開紙片護盾，全隊防禦力上升 3 回合。【按住放開】', target: 'allAllies', kind: 'buff', power: 0, command: 'hold', status: { type: 'defUp', turns: 3, chance: 1, amount: 1 }, fx: 'shield' },
  { id: 'star_beam', name: '星光射線', sp: 6, desc: '感應器射出星光，攻擊所有敵人，也能打中飛行敵人。【瞄準】', target: 'allEnemies', kind: 'damage', power: 3, command: 'aim', hitsFlying: true, fx: 'beam' },
  { id: 'heal_bot', name: '治療小機器', sp: 5, desc: '放出小機器人，替一名隊友回復大量 HP。', target: 'ally', kind: 'heal', power: 14, command: 'timing', fx: 'heal' },
  // Memetchi
  { id: 'sweet_heal', name: '甜甜治癒', sp: 3, desc: '用甜點替隊友回復 HP。【按住放開】', target: 'ally', kind: 'heal', power: 8, command: 'hold', fx: 'heal' },
  { id: 'charm_wink', name: '迷人眨眼', sp: 3, desc: '眨眼讓敵人害羞，攻擊力下降。【瞄準】', target: 'enemy', kind: 'debuff', power: 0, command: 'aim', status: { type: 'atkDown', turns: 3, chance: 0.9, amount: 1 }, fx: 'heart' },
  { id: 'heart_rain', name: '愛心雨', sp: 6, desc: '愛心從天而降，全隊回復 HP。【節奏】', target: 'allAllies', kind: 'heal', power: 7, command: 'rhythm', fx: 'heal' },
  // Kuchipatchi
  { id: 'big_bite', name: '大口咬', sp: 3, desc: '大大咬一口，造成傷害並吸收一部分 HP。', target: 'enemy', kind: 'drain', power: 3, command: 'mash', fx: 'bite' },
  { id: 'belly_bounce', name: '肚子彈跳', sp: 4, desc: '用圓肚子彈跳攻擊三次。', target: 'enemy', kind: 'damage', power: 0, hits: 3, command: 'jump', hitsFlying: true, fx: 'jump' },
  { id: 'snack_time', name: '點心時間', sp: 5, desc: '吃點心！回復自己 HP 並持續回復。【按住放開】', target: 'self', kind: 'heal', power: 8, command: 'hold', status: { type: 'regen', turns: 3, chance: 1, amount: 2 }, fx: 'heal' },
  // Mimitchi
  { id: 'ear_whirl', name: '耳朵旋風', sp: 3, desc: '轉動長耳朵捲起旋風，攻擊所有敵人。【畫線】Great 時會把快倒下的紙片敵人吹出場外！', target: 'allEnemies', kind: 'damage', power: 1, command: 'swipe', hitsFlying: true, fx: 'wind' },
  { id: 'lullaby', name: '搖籃曲', sp: 4, desc: '溫柔的歌聲，讓敵人睡著。【節奏】', target: 'allEnemies', kind: 'debuff', power: 0, command: 'rhythm', status: { type: 'sleep', turns: 2, chance: 0.6 }, fx: 'notes' },
  { id: 'moon_hop', name: '月兔跳', sp: 5, desc: '跳到月亮那麼高再落下，造成大傷害。【按住放開】', target: 'enemy', kind: 'damage', power: 5, command: 'hold', hitsFlying: true, fx: 'jump' },
  // Violetchi
  { id: 'paint_splash', name: '顏料潑灑', sp: 3, desc: '潑上顏料，可能讓敵人看不見（命中下降）。【畫線】顏料會把敵人弄濕：濕掉的紙被物理攻擊會受到 1.5 倍傷害，也燒不起來。', target: 'enemy', kind: 'damage', power: 2, command: 'swipe', status: { type: 'blind', turns: 2, chance: 0.6 }, hitsFlying: true, fx: 'paint' },
  { id: 'color_guard', name: '色彩守護', sp: 3, desc: '在隊友身上畫出護盾，抵擋下一次傷害。', target: 'ally', kind: 'buff', power: 0, command: 'timing', status: { type: 'shield', turns: 3, chance: 1, amount: 1 }, fx: 'shield' },
  { id: 'masterpiece', name: '傑作', sp: 6, desc: '畫出巨大的傑作砸向所有敵人。【畫線】也會把敵人弄濕。', target: 'allEnemies', kind: 'damage', power: 4, command: 'swipe', hitsFlying: true, fx: 'paint' },
  // Gozarutchi
  { id: 'shuriken', name: '手裏劍', sp: 3, desc: '連射三枚手裏劍，能打中飛行敵人。【瞄準】', target: 'enemy', kind: 'damage', power: -1, hits: 3, command: 'aim', hitsFlying: true, fx: 'shuriken' },
  { id: 'smoke_bomb', name: '煙霧彈', sp: 4, desc: '煙霧包圍全隊，防禦上升。', target: 'allAllies', kind: 'buff', power: 0, command: 'timing', status: { type: 'defUp', turns: 2, chance: 1, amount: 2 }, fx: 'smoke' },
  { id: 'ninja_slash', name: '忍法・一閃', sp: 6, desc: '無視防禦的一刀。【畫線】', target: 'enemy', kind: 'damage', power: 5, command: 'swipe', pierce: true, hitsFlying: true, fx: 'slash' },
  // Maskutchi
  { id: 'mask_kick', name: '假面踢', sp: 3, desc: '帥氣的飛踢，可能讓敵人頭暈。', target: 'enemy', kind: 'damage', power: 3, command: 'timing', status: { type: 'dizzy', turns: 1, chance: 0.4 }, hitsFlying: true, fx: 'kick' },
  { id: 'hero_pose', name: '英雄姿勢', sp: 4, desc: '擺出英雄姿勢，全隊攻擊力上升。【節奏】', target: 'allAllies', kind: 'buff', power: 0, command: 'rhythm', status: { type: 'atkUp', turns: 3, chance: 1, amount: 1 }, fx: 'sparkle' },
  { id: 'justice_dive', name: '正義俯衝', sp: 6, desc: '從空中俯衝，攻擊所有敵人。【按住放開】', target: 'allEnemies', kind: 'damage', power: 3, command: 'hold', hitsFlying: true, fx: 'kick' },
  // Oyajitchi
  { id: 'cane_whack', name: '拐杖敲', sp: 2, desc: '無視防禦的敲擊，可能讓敵人頭暈。', target: 'enemy', kind: 'damage', power: 1, command: 'timing', pierce: true, status: { type: 'dizzy', turns: 1, chance: 0.3 }, fx: 'hammer' },
  { id: 'old_wisdom', name: '老人智慧', sp: 4, desc: '分享人生智慧，全隊回復技能點數。【按住放開】', target: 'allAllies', kind: 'heal', power: 0, command: 'hold', fx: 'sparkle' },
  { id: 'star_story', name: '星星故事', sp: 6, desc: '講一個好長的故事，攻擊全體並可能讓敵人睡著。【節奏】', target: 'allEnemies', kind: 'damage', power: 2, command: 'rhythm', status: { type: 'sleep', turns: 1, chance: 0.4 }, hitsFlying: true, fx: 'notes' },
  // Team finisher (unlocked in the final battle)
  { id: 'star_harmony', name: '星之心合奏', sp: 0, desc: '所有夥伴的力量合而為一！只有這招能突破永恆之壁。', target: 'allEnemies', kind: 'team', power: 12, command: 'sequence', pierce: true, hitsFlying: true, fx: 'starburst' },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]));

/** SP each of the two fighters pays for a duo move. */
export const DUO_COST = 4;

/**
 * Duo moves (合體技), keyed by the partner who joins in: the acting fighter plays the first
 * command, the partner plays `cmd2`, and both attack together with their ATK added up.
 */
export const DUOS: Partial<Record<CharId, SkillDef & { cmd2: 'timing' | 'mash' | 'sequence' | 'hold' | 'swipe' | 'rhythm' | 'aim' }>> = {
  kuchipatchi: { id: 'duo_kuchi', name: '鎚鎚大口吞', sp: 0, desc: '把敵人敲進大嘴吉的大嘴巴！造成傷害並吸收 HP。（時機 → 連打）', target: 'enemy', kind: 'drain', power: 3, command: 'timing', cmd2: 'mash', fx: 'bite' },
  memetchi: { id: 'duo_meme', name: '甜蜜進行曲', sp: 0, desc: '跟著美眉吉的節拍一起打！攻擊所有敵人並降低攻擊力。（時機 → 節奏）', target: 'allEnemies', kind: 'damage', power: 1, command: 'timing', cmd2: 'rhythm', status: { type: 'atkDown', turns: 2, chance: 0.7, amount: 1 }, hitsFlying: true, fx: 'heart' },
  mimitchi: { id: 'duo_mimi', name: '月光大旋風', sp: 0, desc: '長耳朵捲起超大旋風，攻擊全體，Great 時會把快倒下的敵人吹走。（時機 → 畫線）', target: 'allEnemies', kind: 'damage', power: 2, command: 'timing', cmd2: 'swipe', hitsFlying: true, fx: 'wind' },
  violetchi: { id: 'duo_vio', name: '彩色摺紙術', sp: 0, desc: '潑顏料再沿線摺起來！造成大傷害並把敵人弄濕。（時機 → 畫線）', target: 'enemy', kind: 'damage', power: 4, command: 'timing', cmd2: 'swipe', hitsFlying: true, fx: 'paint' },
  gozarutchi: { id: 'duo_goza', name: '忍法・紙吹雪', sp: 0, desc: '無數紙片手裏劍飛向全體敵人，無視防禦。（時機 → 瞄準）', target: 'allEnemies', kind: 'damage', power: 1, command: 'timing', cmd2: 'aim', pierce: true, hitsFlying: true, fx: 'shuriken' },
  maskutchi: { id: 'duo_mask', name: '雙人英雄踢', sp: 0, desc: '兩人一起飛踢！大傷害，可能讓敵人頭暈。（時機 → 按住放開）', target: 'enemy', kind: 'damage', power: 5, command: 'timing', cmd2: 'hold', status: { type: 'dizzy', turns: 1, chance: 0.5 }, hitsFlying: true, fx: 'kick' },
  oyajitchi: { id: 'duo_oya', name: '老少星光砲', sp: 0, desc: '星之燈和感應器一起發射星光，無視防禦。（時機 → 瞄準）', target: 'enemy', kind: 'damage', power: 4, command: 'timing', cmd2: 'aim', pierce: true, hitsFlying: true, fx: 'beam' },
  mametchi: { id: 'duo_mame', name: '發明家合擊', sp: 0, desc: '麻每吉的鎚子一起敲下去！Great 會把敵人敲皺。（時機 → 時機）', target: 'enemy', kind: 'damage', power: 3, command: 'timing', cmd2: 'timing', fx: 'hammer' },
};
