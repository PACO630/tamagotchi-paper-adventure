/* Shared data-driven definitions: characters, skills, items, enemies, quests, chapters, scripts. */

export type CharId =
  | 'mametchi' | 'memetchi' | 'kuchipatchi' | 'mimitchi'
  | 'violetchi' | 'gozarutchi' | 'maskutchi' | 'oyajitchi';

export type Expr = 'normal' | 'happy' | 'sad' | 'angry' | 'surprised' | 'worried' | 'determined' | 'hurt' | 'sleepy';

export interface Stats { maxHP: number; maxSP: number; atk: number; def: number }

export interface CharDef {
  id: CharId;
  name: string;
  nameEn: string;
  title: string;
  desc: string;
  base: Stats;
  growth: Stats;
  skills: { id: string; level: number }[];
  color: string;
  fieldAbility: string;
}

export type StatusType =
  | 'poison' | 'burn' | 'sleep' | 'dizzy' | 'stuck'
  | 'atkUp' | 'atkDown' | 'defUp' | 'defDown' | 'regen' | 'shield' | 'blind';

export interface StatusSpec { type: StatusType; turns: number; chance: number; amount?: number }

export type ActionCommand = 'timing' | 'mash' | 'sequence' | 'jump' | 'none';
export type SkillTarget = 'enemy' | 'allEnemies' | 'ally' | 'allAllies' | 'self';

export interface SkillDef {
  id: string;
  name: string;
  sp: number;
  desc: string;
  target: SkillTarget;
  kind: 'damage' | 'heal' | 'buff' | 'debuff' | 'revive' | 'drain' | 'team';
  power: number;
  hits?: number;
  command: ActionCommand;
  status?: StatusSpec;
  pierce?: boolean;
  hitsFlying?: boolean;
  fx: string;
}

export type IconShape =
  | 'heart' | 'star' | 'bottle' | 'candy' | 'mushroom' | 'leaf' | 'gem' | 'badge' | 'key'
  | 'shard' | 'scroll' | 'sticker' | 'bomb' | 'cake' | 'cookie' | 'apple' | 'feather' | 'gear' | 'shell' | 'ring' | 'book';

export interface IconSpec { shape: IconShape; color: string; accent?: string }

export type ItemKind = 'heal' | 'sp' | 'buff' | 'battle' | 'key' | 'collectible' | 'badge' | 'revive' | 'cure';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  icon: IconSpec;
  hp?: number;
  sp?: number;
  status?: StatusSpec;
  damage?: number;
  target?: 'ally' | 'allAllies' | 'enemy' | 'allEnemies';
  badge?: Partial<Stats> & { special?: 'spikeGuard' | 'expUp' | 'coinUp' | 'firstStrike' | 'guardPlus' | 'hpDrain' };
  fieldUse?: boolean;
}

export type Trait = 'flying' | 'spiky' | 'armored' | 'ghost' | 'fiery' | 'boss';

export interface EnemyMove {
  id: string;
  name: string;
  kind: 'attack' | 'multi' | 'status' | 'heal' | 'buff' | 'summon' | 'charge' | 'drain' | 'special';
  power: number;
  hits?: number;
  target: 'one' | 'all';
  weight: number;
  status?: StatusSpec;
  summon?: string[];
  phase?: number[];
  fx?: string;
  msg?: string;
}

export type EnemyBody =
  | 'blob' | 'mushroom' | 'bug' | 'bird' | 'candy' | 'tree' | 'cloud' | 'dragon' | 'robot'
  | 'fish' | 'jelly' | 'crab' | 'ghost' | 'knight' | 'mirror' | 'guardian' | 'eye' | 'golem' | 'star';

export interface EnemyArt { body: EnemyBody; color: string; accent: string; size?: number; dark?: boolean; mimic?: CharId }

export interface BossPhase { hpBelow: number; msg: string; addTraits?: Trait[]; removeTraits?: Trait[]; def?: number; atk?: number; mechanic?: string }

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  coins: number;
  traits: Trait[];
  moves: EnemyMove[];
  drops?: { item: string; chance: number }[];
  art: EnemyArt;
  phases?: BossPhase[];
  mechanic?: string;
}

export type QuestObjective =
  | { kind: 'flag'; flag: string }
  | { kind: 'flags'; flags: string[] }
  | { kind: 'collect'; item: string; count: number }
  | { kind: 'defeat'; enemy: string; count: number };

export interface QuestDef {
  id: string;
  chapter: number;
  type: 'main' | 'side';
  title: string;
  desc: string;
  objective: QuestObjective;
  reward?: { exp?: number; coins?: number; items?: { id: string; qty: number }[] };
  takeItems?: boolean;
}

/* ---------- Story scripts ---------- */

export type ScriptStep =
  | { who: string; text: string; face?: Expr }
  | { do: 'flag'; key: string; value?: boolean | number | string }
  | { do: 'give'; item: string; qty?: number }
  | { do: 'take'; item: string; qty?: number }
  | { do: 'coins'; amount: number }
  | { do: 'quest'; start?: string; complete?: string }
  | { do: 'join'; partner: CharId }
  | { do: 'battle'; encounter: string[]; boss?: boolean; flag?: string; music?: string }
  | { do: 'heal' }
  | { do: 'exp'; amount: number }
  | { do: 'shake'; ms?: number }
  | { do: 'flash'; color?: number }
  | { do: 'sfx'; id: string }
  | { do: 'music'; id: string }
  | { do: 'wait'; ms: number }
  | { do: 'emote'; actor: string; emote: string }
  | { do: 'move'; actor: string; x: number; z?: number }
  | { do: 'hide'; actor: string }
  | { do: 'show'; actor: string }
  | { do: 'chapterEnd' }
  | { do: 'ending' }
  | { do: 'save' }
  | { do: 'tint'; color: number }
  // ---- cutscene steps ----
  | { do: 'cinema'; on: boolean }
  | { do: 'pan'; x: number; ms?: number; nowait?: boolean }
  | { do: 'follow'; ms?: number }
  | { do: 'zoom'; z: number; ms?: number }
  | { do: 'place'; actor: string; x: number; z?: number }
  | { do: 'jump'; actor: string }
  | { do: 'anim'; actor: string; anim: string; ms?: number }
  | { do: 'face'; actor: string; dir: 1 | -1 }
  | { do: 'caption'; text: string; ms?: number }
  | { do: 'banner'; title: string; sub?: string }
  | { do: 'fx'; name: string; actor?: string; x?: number }
  | { do: 'opening' }
  | { choice: { text: string; flag?: [string, boolean | number | string]; goto?: string }[]; who?: string; prompt?: string }
  | { label: string }
  | { goto: string }
  | { if: string; then: ScriptStep[]; else?: ScriptStep[] }
  | { end: true };

export type Script = ScriptStep[];

/** A condition string: "flag", "!flag", "a&b", "quest:id", "done:id", "item:id" */
export type Cond = string;

export interface NpcLook {
  color: string;
  accent: string;
  ears?: 'none' | 'round' | 'pointy' | 'bunny' | 'antenna' | 'leaf' | 'horn' | 'cat';
  hat?: 'none' | 'beret' | 'crown' | 'chef' | 'cap' | 'bow' | 'hood' | 'helmet' | 'flower';
  mustache?: boolean;
  glasses?: boolean;
  size?: number;
}

export interface NpcDef {
  id: string;
  name: string;
  look: CharId | NpcLook;
  dark?: boolean;
  x: number;
  z: number;
  talk: { if?: Cond; script: Script }[];
  showIf?: Cond;
  wander?: number;
  hidden?: boolean;
}

export type PropLayer = 'far' | 'back' | 'mid' | 'front';
export interface PropDef { t: string; x: number; z?: number; layer?: PropLayer; s?: number; flip?: boolean }

export type ZoneType = 'pit' | 'wind' | 'conveyor' | 'current' | 'hazard' | 'dark' | 'heal' | 'slow';
export interface ZoneDef {
  type: ZoneType;
  x: number;
  w: number;
  z0?: number;
  z1?: number;
  fx?: number;
  fz?: number;
  period?: number;
  duty?: number;
  look?: string;
  dmg?: number;
}

export interface PlatformDef { id: string; x: number; z: number; w: number; d: number; dx?: number; dz?: number; period?: number; look?: string }

export interface ChestDef {
  id: string;
  x: number;
  z: number;
  items?: { id: string; qty: number }[];
  coins?: number;
  hidden?: boolean;
  showIf?: Cond;
}

export type ObjType = 'breakable' | 'switch' | 'gate' | 'sign' | 'savepoint' | 'shard' | 'door' | 'spring' | 'heal';
export interface ObjDef {
  id: string;
  type: ObjType;
  x: number;
  z: number;
  flag?: string;
  cond?: Cond;
  text?: string;
  look?: string;
  to?: { x: number; z: number };
  group?: string;
  order?: number;
  w?: number;
  script?: Script;
  showIf?: Cond;
}

export interface FieldEnemyDef { id: string; enemy: string; party: string[]; x: number; z: number; range?: number; showIf?: Cond }

export interface TriggerDef { id: string; x: number; w?: number; script: Script; if?: Cond; once?: boolean; block?: boolean }

export interface BossDef { id: string; enemy: string; party: string[]; x: number; z: number; pre: Script; post: Script; flag: string; music?: string }

export type Weather = 'none' | 'petals' | 'leaves' | 'candy' | 'clouds' | 'sparks' | 'bubbles' | 'snow' | 'dust' | 'darkmotes' | 'stars' | 'rain';

export interface ThemeDef {
  id: string;
  skyTop: number;
  skyBottom: number;
  far: number;
  farAccent: number;
  mid: number;
  midAccent: number;
  ground: number;
  groundAccent: number;
  groundEdge: number;
  pitColor: number;
  light: number;
  ambient: number;
  sun?: 'sun' | 'moon' | 'none' | 'eye' | 'star';
  farShape: 'mountains' | 'hills' | 'clouds' | 'chimneys' | 'reef' | 'castle' | 'spikes' | 'pillars';
  midShape: 'hills' | 'trees' | 'candy' | 'clouds' | 'gears' | 'kelp' | 'towers' | 'crystals' | 'stars';
  groundPattern: 'grass' | 'candy' | 'cloud' | 'metal' | 'sand' | 'stone' | 'void' | 'marble';
  underwater?: boolean;
}

export interface ChapterDef {
  id: string;
  num: number;
  title: string;
  location: string;
  summary: string;
  theme: ThemeDef;
  music: string;
  weather: Weather;
  width: number;
  start: { x: number; z: number };
  intro: Script;
  props: PropDef[];
  npcs: NpcDef[];
  enemies: FieldEnemyDef[];
  chests: ChestDef[];
  objects: ObjDef[];
  zones: ZoneDef[];
  platforms: PlatformDef[];
  triggers: TriggerDef[];
  boss: BossDef;
  outro: Script;
  quests: string[];
  partner?: CharId;
  mapNodes: { name: string; x: number }[];
}
