/**
 * Interludes played between chapters (after the CLEAR card):
 *  "<chapter id>"  and optionally "<chapter id>b".
 * set "lair": meanwhile, in the crowned shadow's star palace — the grey brothers report back.
 * set "airship": the party on the flying ship, on the way to the next place.
 * Stage coordinates: the visible area is about x 560–1840; z 0 (back) … 240 (front).
 */
import type { Script } from './types';
import { ANIM, BOUNCE, CAP, GAME, EMOTE, FACE, FX, IF, JUMP, L, N, PL, RUN, SFX, SHAKE, SHIVER, SPAWN, WAIT, WALK, WALKN, DESPAWN } from './chapters/helpers';

export interface Interlude { set: 'lair' | 'airship'; script: Script }

/** The party on deck: Mametchi plus every partner who has joined so far. */
const CREW = (): Script => [
  SPAWN('hero', 'mametchi', 1180, 140, { dir: 1 }),
  IF('joined:kuchipatchi', [SPAWN('kuchipatchi', 'kuchipatchi', 1040, 180, { dir: 1 })]),
  IF('joined:memetchi', [SPAWN('memetchi', 'memetchi', 1320, 100, { dir: -1 })]),
  IF('joined:mimitchi', [SPAWN('mimitchi', 'mimitchi', 1460, 170, { dir: -1 })]),
  IF('joined:maskutchi', [SPAWN('maskutchi', 'maskutchi', 900, 110, { dir: 1 })]),
  IF('joined:gozarutchi', [SPAWN('gozarutchi', 'gozarutchi', 1580, 90, { dir: -1 })]),
  IF('joined:violetchi', [SPAWN('violetchi', 'violetchi', 780, 170, { dir: 1 })]),
  IF('joined:oyajitchi', [SPAWN('oyajitchi', 'oyajitchi', 1700, 150, { dir: -1 })]),
];

/** The crowned shadow on the throne, the brothers in front of him. */
const LAIR = (): Script => [
  SPAWN('shadow', 'shadow', 1200, 40, { dir: 1 }),
  SPAWN('xiaohui', 'xiaohui', 1440, 170, { dir: -1 }),
  SPAWN('dahui', 'dahui', 1560, 150, { dir: -1 }),
  WAIT(900),
];

const FLY_TO = (place: string): Script => [WAIT(300), FX('shipFly'), CAP(`前往：${place}`, 2600), WAIT(600)];

export const INTERLUDES: Record<string, Interlude> = {
  /* ---- after chapter 1: the villain's helpers are introduced ---- */
  ch1: { set: 'lair', script: [
    ...LAIR(),
    L('xiaohui', '報、報告大人！村莊的守護石像……被一個拿著奇怪機器的小鬼打倒了！', 'worried'),
    L('dahui', '他還有一個很會吃的朋友喔。肚子好圓，好羨慕。', 'normal'),
    L('shadow', '……星之感應器。那個老傢伙，還留著那種東西啊。', 'normal'),
    L('shadow', '無妨。碎片還有七塊。只要世界一直停著，就不會再有人說「再見」。', 'sad'),
    L('xiaohui', '大人放心！下一塊碎片在糖果森林，我們這就去讓樹王更～加暴走！', 'happy'),
    L('dahui', '糖果森林！那……可以順便吃一顆糖嗎？', 'happy'),
    L('xiaohui', '不行！……好啦，一顆。', 'angry'),
    BOUNCE('dahui', 3),
    L('shadow', '去吧，灰灰兄弟。別讓那個孩子靠近碎片。', 'normal'),
    WALKN('xiaohui', 2000, 170, true), RUN('dahui', 2000, 150),
    DESPAWN('xiaohui'), DESPAWN('dahui'),
    WAIT(500),
    L('shadow', '……「再見」這兩個字，我再也不想聽到了。', 'sad'),
    WAIT(400),
  ] },

  /* ---- after chapter 2 ---- */
  ch2: { set: 'lair', script: [
    ...LAIR(),
    L('dahui', '大人……我們被一顆好大的口香糖壓扁了……', 'hurt'),
    L('xiaohui', '那是我們自己推的口香糖啦！總之……樹王的碎片被搶走了。', 'worried'),
    L('shadow', '……樹王恢復了？那個叫美眉吉的孩子，把花束送給了它？', 'surprised'),
    L('shadow', '（花束……很久以前，也有人送過我一束花。）', 'sad'),
    L('xiaohui', '大人？', 'surprised'),
    L('shadow', '……沒什麼。下一塊碎片在天空島。用你們的飛艇，把他們擋在雲層下面。', 'normal'),
    L('xiaohui', '是！灰灰號，起飛準備！', 'determined'),
    L('dahui', '起飛前可以先吃午餐嗎……', 'sad'),
    WALKN('xiaohui', 2000, 170, true), RUN('dahui', 2000, 150), DESPAWN('xiaohui'), DESPAWN('dahui'),
  ] },
  ch2b: { set: 'airship', script: [
    ...CREW(),
    CAP('樹王送給大家的舊飛行器，嘎吱嘎吱地飛上了天空。', 2800),
    PL('kuchipatchi', '哇——飛起來了！下面的森林變得好小喔！', 'happy'),
    PL('memetchi', '樹王說，他失控之前看到一個戴王冠的影子。', 'worried'),
    L('hero', '在村莊也是。那個影子說「讓村莊也停止下來吧」……', 'determined'),
    PL('memetchi', '為什麼要讓世界停下來呢？停下來的話，花就不會開，蛋糕也不會烤好了呀。', 'sad'),
    PL('kuchipatchi', '蛋糕不會烤好！？那太可怕了！', 'surprised'),
    JUMP('kuchipatchi'),
    L('hero', '感應器的指針指著上面——更高的雲層裡。目標：雲朵天空島！', 'determined'),
    ...FLY_TO('雲朵天空島'),
    SHAKE(700),
    L('xiaohui', '哇哈哈哈！別想去天空島！灰灰號，發射！', 'happy'),
    L('hero', '是灰灰兄弟的飛艇！大家抓緊了！', 'determined'),
    GAME('sky'),
    CAP('甩開灰灰號了！飛行器朝著天空島降落……', 2400),
  ] },

  /* ---- after chapter 3 ---- */
  ch3: { set: 'lair', script: [
    ...LAIR(),
    L('xiaohui', '灰灰號……墜機了。', 'sad'),
    L('dahui', '風車又開始轉了。轉啊轉的，很好看耶。', 'happy'),
    L('xiaohui', '大哥！你是哪一邊的！？', 'angry'),
    L('shadow', '……天空島的龍，對他們說了什麼？', 'normal'),
    L('xiaohui', '它說……「原來你們不是來搶碎片的」。', 'worried'),
    L('shadow', '……', 'sad'),
    L('shadow', '去玩具工廠。我交給那台機器人一道命令：「讓工廠永遠停止」。你們去守著控制室。', 'normal'),
    L('dahui', '工廠！有玩具可以玩嗎！', 'happy'),
    L('xiaohui', '是去工作的啦！', 'angry'),
    WALKN('xiaohui', 2000, 170, true), RUN('dahui', 2000, 150), DESPAWN('xiaohui'), DESPAWN('dahui'),
  ] },
  ch3b: { set: 'airship', script: [
    ...CREW(),
    CAP('飛行器載著大家，穿過剛剛恢復顏色的雲層。', 2600),
    PL('mimitchi', '～啦啦啦～風的聲音變溫柔了。', 'happy'),
    PL('memetchi', '咪咪吉的歌好好聽！', 'happy'),
    PL('mimitchi', '謝謝……其實，風亂掉的時候，我一直不敢唱歌。怕歌聲被吹散，誰都聽不見。', 'sad'),
    L('hero', '我們都聽見了喔。在天空神殿，就是妳的歌讓雲龍冷靜下來的。', 'happy'),
    PL('mimitchi', '……嗯！那我以後要唱更多更多的歌！', 'determined'),
    PL('kuchipatchi', '那個龍說，神殿的主人「再也不想看到任何改變」……', 'worried'),
    L('hero', '戴王冠的影子……我們一定要問清楚，他為什麼要這麼做。', 'determined'),
    L('hero', '感應器這次指向——下面那座冒煙的工廠！', 'surprised'),
    ...FLY_TO('玩具工廠'),
  ] },

  /* ---- after chapter 4: the brothers start to doubt ---- */
  ch4: { set: 'lair', script: [
    ...LAIR(),
    L('xiaohui', '大人……那台機器人最後說，它的工作是「讓大家微笑」。', 'sad'),
    L('dahui', '它還送了我一隻發條小兔子。你看，會跳喔。', 'happy'),
    BOUNCE('dahui', 2),
    L('xiaohui', '大人，我們……真的在做對的事嗎？', 'worried'),
    SHAKE(500),
    L('shadow', '小灰。你們兩個被大家丟下的時候，是誰收留了你們？', 'angry'),
    SHIVER('xiaohui', 600),
    L('xiaohui', '……是大人。', 'sad'),
    L('shadow', '那就相信我。改變只會帶走重要的東西。我……不會再讓任何東西被帶走。', 'sad'),
    L('shadow', '去海底遺跡。古代守護者會讓潮水永遠停住。', 'normal'),
    WALK('xiaohui', 1700, 170), FACE('xiaohui', -1),
    L('xiaohui', '（大人的聲音……聽起來好像快哭了。）', 'sad'),
    WALKN('xiaohui', 2000, 170), WALK('dahui', 2000, 150), DESPAWN('xiaohui'), DESPAWN('dahui'),
  ] },
  ch4b: { set: 'airship', script: [
    ...CREW(),
    CAP('從工廠帶回來的「秘密紀錄」，在甲板上被大家圍著看。', 2600),
    L('hero', '「只要一切都不再改變……就不會再有人哭了。」', 'worried'),
    PL('maskutchi', '這句話……好像不是壞人會說的話。', 'normal'),
    PL('memetchi', '聽起來，他好像很難過。', 'sad'),
    PL('maskutchi', '可是，就算是為了別人好，讓整個世界停下來也是不對的！正義英雄會好好告訴他！', 'determined'),
    PL('maskutchi', '……如果他住的地方不會太暗的話。', 'worried'),
    PL('kuchipatchi', '假面吉怕黑～', 'happy'),
    PL('maskutchi', '才、才沒有！', 'angry'),
    L('hero', '感應器指向大海的方向。下一塊碎片在海底！', 'determined'),
    ...FLY_TO('夢幻海洋'),
  ] },

  /* ---- after chapter 5: a memory surfaces ---- */
  ch5: { set: 'lair', script: [
    ...LAIR(),
    L('dahui', '大人，這是我在海邊撿的貝殼。送給你。', 'happy'),
    WALK('dahui', 1300, 90),
    L('shadow', '……', 'surprised'),
    L('shadow', '……以前，也有一個小傢伙，每天撿亮晶晶的東西給我。', 'sad'),
    L('xiaohui', '是誰呀？', 'surprised'),
    L('shadow', '一顆從天上掉下來的小星星。我叫它「小光」。', 'sad'),
    L('shadow', '後來，它回到天上去了。說了一聲「再見」，就再也沒有回來。', 'sad'),
    L('dahui', '……大人，你一定很寂寞吧。', 'sad'),
    L('shadow', '……走吧。去夢幻城堡。那裡記錄著一切——也記錄著我。不能讓他們看到。', 'normal'),
    WALKN('dahui', 2000, 150), WALK('xiaohui', 2000, 170), DESPAWN('xiaohui'), DESPAWN('dahui'),
  ] },
  ch5b: { set: 'airship', script: [
    ...CREW(),
    CAP('海水恢復了清澈。飛行器在夕陽下，往夢幻城堡飛去。', 2600),
    PL('gozarutchi', '主公，在下有一事相問。', 'normal'),
    L('hero', '……我真的不是什麼主公啦。', 'worried'),
    PL('gozarutchi', '在下一直以為，修行就是一個人變強。但是在海底，是各位救了在下。', 'normal'),
    PL('gozarutchi', '原來，能依靠別人，也是一種強大。', 'happy'),
    PL('kuchipatchi', '還有一起吃飯！一起吃飯最強！', 'happy'),
    PL('mimitchi', '……王冠之人，是不是沒有人可以依靠呢？', 'worried'),
    L('hero', '去城堡吧。那裡保存著世界的歷史，一定能知道他是誰。', 'determined'),
    ...FLY_TO('夢幻城堡'),
  ] },

  /* ---- after chapter 6: the shadow shows his face ---- */
  ch6: { set: 'lair', script: [
    ...LAIR(),
    L('xiaohui', '大人……城堡的記錄，被他們看見了。他們知道了你的名字。', 'worried'),
    L('shadow', '……是嗎。', 'normal'),
    SHAKE(600), FX('darkPuff', 'shadow'),
    DESPAWN('shadow'), SPAWN('eternatchi', 'eternatchi', 1200, 40, { dir: 1, fx: 'pop' }),
    L('eternatchi', '那就不用再躲了。我是星之心的守護者——永恆吉。', 'normal'),
    L('dahui', '大人的臉……好漂亮。為什麼一直要藏起來呢？', 'surprised'),
    L('eternatchi', '小灰、大灰，最後一個命令。把麻每吉的朋友們，全部帶到黑暗異世界。', 'normal'),
    L('xiaohui', '抓、抓走他們！？', 'surprised'),
    L('eternatchi', '只要分開，他們就不會再為彼此受傷了。這是……溫柔。', 'sad'),
    L('xiaohui', '……', 'sad'),
    L('dahui', '小灰，我們……要去嗎？', 'worried'),
    L('xiaohui', '……走吧，大哥。', 'sad'),
    WALKN('xiaohui', 2000, 170), WALK('dahui', 2000, 150), DESPAWN('xiaohui'), DESPAWN('dahui'),
    L('eternatchi', '……來吧，麻每吉。我在黑暗的盡頭等你。', 'normal'),
  ] },

  /* ---- after chapter 7: everyone, together, to the last temple ---- */
  ch7: { set: 'airship', script: [
    ...CREW(),
    SPAWN('xiaohui', 'xiaohui', 620, 200, { dir: 1 }),
    SPAWN('dahui', 'dahui', 700, 150, { dir: 1 }),
    SPAWN('lumi', 'lumi', 1240, 60, { dir: -1 }),
    CAP('七塊碎片的光，在夜空中鋪出一條星星的階梯。飛行器沿著階梯往上飛。', 3000),
    L('xiaohui', '……那個，我們真的可以一起去嗎？我們之前做了那麼多壞事……', 'worried'),
    L('hero', '你們在黑暗異世界放了大家，還幫我們打開了門。現在是一起的夥伴了！', 'happy'),
    L('dahui', '夥伴……嘿嘿，夥伴。', 'happy'),
    BOUNCE('dahui', 3),
    L('lumi', '永恆吉……他還在等我嗎？', 'worried'),
    PL('oyajitchi', '他一直在等。只是他自己忘記了，他在等的是「重逢」，而不是「永遠」。', 'normal'),
    L('lumi', '那我要親口告訴他：我回來了。', 'determined'),
    L('hero', '大家——最後一塊碎片，一起去拿回來吧！', 'determined'),
    ANIM('hero', 'win', 1200),
    ...FLY_TO('最終星之神殿'),
  ] },
};

void N; void SFX; void EMOTE;
