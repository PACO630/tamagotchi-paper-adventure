import type { CharDef, CharId, Stats } from './types';

export const CHARACTERS: Record<CharId, CharDef> = {
  mametchi: {
    id: 'mametchi', name: '麻美吉', nameEn: 'Mametchi', title: '天才小發明家',
    desc: '頭腦聰明、充滿好奇心的發明家。手上的星之感應器能找到星之心碎片。',
    base: { maxHP: 20, maxSP: 10, atk: 3, def: 0 }, growth: { maxHP: 3, maxSP: 2, atk: 0.5, def: 0.25 },
    skills: [{ id: 'spark_hammer', level: 1 }, { id: 'gadget_shield', level: 3 }, { id: 'star_beam', level: 6 }, { id: 'heal_bot', level: 10 }],
    color: '#ffd84a', fieldAbility: '鎚子可以敲碎裂開的方塊',
  },
  memetchi: {
    id: 'memetchi', name: '美美吉', nameEn: 'Memetchi', title: '溫柔的甜點師',
    desc: '喜歡漂亮東西和甜點的女孩，總是在大家受傷時第一個衝過來。',
    base: { maxHP: 18, maxSP: 14, atk: 2, def: 0 }, growth: { maxHP: 2.5, maxSP: 2.5, atk: 0.4, def: 0.25 },
    skills: [{ id: 'sweet_heal', level: 1 }, { id: 'charm_wink', level: 3 }, { id: 'heart_rain', level: 6 }],
    color: '#ff8ac4', fieldAbility: '治療技能特別有效',
  },
  kuchipatchi: {
    id: 'kuchipatchi', name: '庫奇帕奇', nameEn: 'Kuchipatchi', title: '永遠吃不飽',
    desc: '悠哉又貪吃，嘴巴大大的。肚子餓的時候力氣特別大。',
    base: { maxHP: 26, maxSP: 8, atk: 3, def: 1 }, growth: { maxHP: 3.5, maxSP: 1.5, atk: 0.5, def: 0.3 },
    skills: [{ id: 'big_bite', level: 1 }, { id: 'belly_bounce', level: 3 }, { id: 'snack_time', level: 6 }],
    color: '#7fd35b', fieldAbility: '體力最高的坦克',
  },
  mimitchi: {
    id: 'mimitchi', name: '咪咪吉', nameEn: 'Mimitchi', title: '長耳朵的歌手',
    desc: '有一對長長的耳朵，能聽見很遠的聲音，唱歌可以讓敵人睡著。',
    base: { maxHP: 18, maxSP: 12, atk: 3, def: 0 }, growth: { maxHP: 2.5, maxSP: 2.2, atk: 0.5, def: 0.2 },
    skills: [{ id: 'ear_whirl', level: 1 }, { id: 'lullaby', level: 3 }, { id: 'moon_hop', level: 6 }],
    color: '#9fd8ff', fieldAbility: '跳得特別高',
  },
  violetchi: {
    id: 'violetchi', name: '紫羅蘭吉', nameEn: 'Violetchi', title: '色彩藝術家',
    desc: '熱愛畫畫的藝術家，覺得世界失去顏色是最可怕的事。',
    base: { maxHP: 19, maxSP: 13, atk: 3, def: 0 }, growth: { maxHP: 2.6, maxSP: 2.3, atk: 0.5, def: 0.2 },
    skills: [{ id: 'paint_splash', level: 1 }, { id: 'color_guard', level: 3 }, { id: 'masterpiece', level: 6 }],
    color: '#b88cff', fieldAbility: '技能能讓敵人看不見',
  },
  gozarutchi: {
    id: 'gozarutchi', name: '忍者吉', nameEn: 'Gozarutchi', title: '修行中的忍者',
    desc: '說話總是加上「在下」，認真修行的小忍者。動作非常敏捷。',
    base: { maxHP: 20, maxSP: 10, atk: 4, def: 0 }, growth: { maxHP: 2.8, maxSP: 1.8, atk: 0.6, def: 0.2 },
    skills: [{ id: 'shuriken', level: 1 }, { id: 'smoke_bomb', level: 3 }, { id: 'ninja_slash', level: 6 }],
    color: '#4a7dff', fieldAbility: '攻擊力成長最快',
  },
  maskutchi: {
    id: 'maskutchi', name: '假面吉', nameEn: 'Maskutchi', title: '神秘假面英雄',
    desc: '戴著面具的正義英雄，喜歡擺帥氣的姿勢，其實有點怕黑。',
    base: { maxHP: 22, maxSP: 10, atk: 3, def: 1 }, growth: { maxHP: 3, maxSP: 1.8, atk: 0.5, def: 0.3 },
    skills: [{ id: 'mask_kick', level: 1 }, { id: 'hero_pose', level: 3 }, { id: 'justice_dive', level: 6 }],
    color: '#ff5a4a', fieldAbility: '能幫全隊加油',
  },
  oyajitchi: {
    id: 'oyajitchi', name: '老爺爺吉', nameEn: 'Oyajitchi', title: '神秘的長者',
    desc: '留著白鬍子的老爺爺，知道很多關於星之心的古老故事。',
    base: { maxHP: 22, maxSP: 14, atk: 2, def: 1 }, growth: { maxHP: 2.8, maxSP: 2.5, atk: 0.4, def: 0.3 },
    skills: [{ id: 'cane_whack', level: 1 }, { id: 'old_wisdom', level: 3 }, { id: 'star_story', level: 6 }],
    color: '#8fd6d0', fieldAbility: '能幫全隊回復技能點數',
  },
};

export const CHAR_IDS = Object.keys(CHARACTERS) as CharId[];

export function statsAt(id: CharId, level: number): Stats {
  const c = CHARACTERS[id];
  const l = level - 1;
  return {
    maxHP: Math.floor(c.base.maxHP + c.growth.maxHP * l),
    maxSP: Math.floor(c.base.maxSP + c.growth.maxSP * l),
    atk: Math.floor(c.base.atk + c.growth.atk * l),
    def: Math.floor(c.base.def + c.growth.def * l),
  };
}

export function skillsAt(id: CharId, level: number): string[] {
  return CHARACTERS[id].skills.filter((s) => s.level <= level).map((s) => s.id);
}

/** EXP required to go from `level` to `level + 1`. */
export function expToNext(level: number): number {
  return Math.floor(20 + level * level * 6 + level * 10);
}
