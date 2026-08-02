import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type IdiomEntry = {
  freq: number;
  id: string;
  meaning: string;
  pinyin: string;
  tip: string;
  word: string;
};

export type IdiomPair = {
  focus: string;
  id: string;
  left: { note: string; word: string };
  right: { note: string; word: string };
};

/**
 * 河北省考（含联考卷）近 5 年言语理解高频成语。
 * freq 为在近 5 年真题与官方模考中出现的大致次数，用于排序与突击。
 */
export const HEBEI_IDIOMS: IdiomEntry[] = [
  { id: "i01", word: "因地制宜", pinyin: "yīn dì zhì yí", meaning: "根据各地的具体条件，制定适宜的办法。", tip: "常搭配“分类施策”“一村一策”，写乡村振兴、基层治理必用。", freq: 9 },
  { id: "i02", word: "循序渐进", pinyin: "xún xù jiàn jìn", meaning: "按照一定步骤逐渐深入或提高。", tip: "强调“步骤、顺序”，不能用于形容速度快。", freq: 8 },
  { id: "i03", word: "潜移默化", pinyin: "qián yí mò huà", meaning: "人的思想、性格在不知不觉中受到影响而发生变化。", tip: "只用于“无形影响”，不能带明显的外力强制。", freq: 8 },
  { id: "i04", word: "一以贯之", pinyin: "yī yǐ guàn zhī", meaning: "用一个根本性的事理贯通事情的始末。", tip: "强调“始终坚持”，常与“久久为功”连用。", freq: 8 },
  { id: "i05", word: "行之有效", pinyin: "xíng zhī yǒu xiào", meaning: "实行起来有成效，多指已经实践过的办法。", tip: "必须是“已经试过”的方法，不能修饰新设想。", freq: 7 },
  { id: "i06", word: "立竿见影", pinyin: "lì gān jiàn yǐng", meaning: "比喻收效非常迅速。", tip: "强调“快”，与“久久为功”常构成反义对比。", freq: 7 },
  { id: "i07", word: "标本兼治", pinyin: "biāo běn jiān zhì", meaning: "既解决表面问题，又解决根本问题。", tip: "治理类文段高频，注意与“治标不治本”对照。", freq: 7 },
  { id: "i08", word: "举足轻重", pinyin: "jǔ zú qīng zhòng", meaning: "所处地位重要，一举一动都影响全局。", tip: "只能形容人或事物的“地位”，不形容数量多。", freq: 7 },
  { id: "i09", word: "势在必行", pinyin: "shì zài bì xíng", meaning: "从形势上看必须采取行动。", tip: "主语通常是改革、转型等“事”，不是人。", freq: 6 },
  { id: "i10", word: "首当其冲", pinyin: "shǒu dāng qí chōng", meaning: "最先受到攻击或遭遇灾难。", tip: "高频错用！不是“first”“首要”，只表示最先受害。", freq: 6 },
  { id: "i11", word: "不胜枚举", pinyin: "bù shèng méi jǔ", meaning: "数量很多，无法一一列举。", tip: "只用于数量，不能形容程度深。", freq: 6 },
  { id: "i12", word: "相辅相成", pinyin: "xiāng fǔ xiāng chéng", meaning: "互相补充，互相配合，缺一不可。", tip: "两者是“互助”关系，不是“互相制约”。", freq: 6 },
  { id: "i13", word: "水到渠成", pinyin: "shuǐ dào qú chéng", meaning: "条件成熟，事情自然会成功。", tip: "强调“自然而然”，不能强调人为推动。", freq: 6 },
  { id: "i14", word: "众所周知", pinyin: "zhòng suǒ zhōu zhī", meaning: "大家普遍知道。", tip: "后面接的应是常识，接冷门信息即为语义矛盾。", freq: 6 },
  { id: "i15", word: "望其项背", pinyin: "wàng qí xiàng bèi", meaning: "能够赶得上。", tip: "高频错用！多用于否定式“难以望其项背”。", freq: 6 },
  { id: "i16", word: "别具一格", pinyin: "bié jù yī gé", meaning: "另有一种独特的风格。", tip: "偏重“风格独特”，不强调创新程度。", freq: 5 },
  { id: "i17", word: "独树一帜", pinyin: "dú shù yī zhì", meaning: "自成一家，形成独特的风格或主张。", tip: "比“别具一格”更强调自成体系、影响更大。", freq: 5 },
  { id: "i18", word: "层出不穷", pinyin: "céng chū bù qióng", meaning: "接连不断地出现，没有穷尽。", tip: "多修饰新事物、新问题，含中性偏多义。", freq: 5 },
  { id: "i19", word: "屡见不鲜", pinyin: "lǚ jiàn bù xiān", meaning: "常常见到，不足为奇。", tip: "略带贬义，常修饰负面现象。", freq: 5 },
  { id: "i20", word: "无可厚非", pinyin: "wú kě hòu fēi", meaning: "虽有缺点，但可以谅解，不必过分责难。", tip: "程度轻于“无可非议”，注意二者区别。", freq: 5 },
  { id: "i21", word: "无可非议", pinyin: "wú kě fēi yì", meaning: "没有什么可以指责的，完全合理。", tip: "表示完全正确，比“无可厚非”肯定程度更高。", freq: 5 },
  { id: "i22", word: "捉襟见肘", pinyin: "zhuō jīn jiàn zhǒu", meaning: "形容顾此失彼，困难重重。", tip: "多用于资金、人手、能力不足。", freq: 5 },
  { id: "i23", word: "顾此失彼", pinyin: "gù cǐ shī bǐ", meaning: "顾了这个，丢了那个。", tip: "强调无法兼顾，常与“统筹兼顾”对照。", freq: 5 },
  { id: "i24", word: "统筹兼顾", pinyin: "tǒng chóu jiān gù", meaning: "统一筹划，全面照顾。", tip: "政策类文段的正面表述，几乎年年出现。", freq: 5 },
  { id: "i25", word: "对症下药", pinyin: "duì zhèng xià yào", meaning: "针对病症用药，比喻针对问题采取有效措施。", tip: "强调“有针对性”，与“因地制宜”侧重不同。", freq: 5 },
  { id: "i26", word: "急功近利", pinyin: "jí gōng jìn lì", meaning: "急于求成，贪图眼前利益。", tip: "贬义，常与“久久为功”“行稳致远”对照。", freq: 5 },
  { id: "i27", word: "行稳致远", pinyin: "xíng wěn zhì yuǎn", meaning: "走得稳才能走得远。", tip: "近年高频新表述，写发展、改革都能用。", freq: 5 },
  { id: "i28", word: "久久为功", pinyin: "jiǔ jiǔ wéi gōng", meaning: "长期坚持不懈才能取得成效。", tip: "与“一蹴而就”“立竿见影”构成反义。", freq: 5 },
  { id: "i29", word: "一蹴而就", pinyin: "yī cù ér jiù", meaning: "一步就成功，形容事情轻而易举。", tip: "常用否定式“并非一蹴而就”。", freq: 5 },
  { id: "i30", word: "根深蒂固", pinyin: "gēn shēn dì gù", meaning: "基础深厚，不易动摇。", tip: "多修饰观念、习惯、问题，偏贬义。", freq: 4 },
  { id: "i31", word: "耳濡目染", pinyin: "ěr rú mù rǎn", meaning: "经常听到看到，不知不觉受到影响。", tip: "与“潜移默化”近义，但强调“听与看”的渠道。", freq: 4 },
  { id: "i32", word: "如出一辙", pinyin: "rú chū yī zhé", meaning: "像出自同一个车辙，形容非常相似。", tip: "多用于负面现象的雷同，含贬义。", freq: 4 },
  { id: "i33", word: "大相径庭", pinyin: "dà xiāng jìng tíng", meaning: "彼此相差很远，大不相同。", tip: "强调差距大，不能形容轻微差异。", freq: 4 },
  { id: "i34", word: "南辕北辙", pinyin: "nán yuán běi zhé", meaning: "行动和目的完全相反。", tip: "强调“方向错了”，不是单纯的“不同”。", freq: 4 },
  { id: "i35", word: "抽丝剥茧", pinyin: "chōu sī bō jiǎn", meaning: "形容分析事物极为细致，层层深入。", tip: "多修饰调查、分析的过程。", freq: 4 },
  { id: "i36", word: "举一反三", pinyin: "jǔ yī fǎn sān", meaning: "从一件事类推而知道许多事。", tip: "强调迁移能力，学习类文段常见。", freq: 4 },
  { id: "i37", word: "浅尝辄止", pinyin: "qiǎn cháng zhé zhǐ", meaning: "略微尝试一下就停止，不深入钻研。", tip: "贬义，与“持之以恒”对照。", freq: 4 },
  { id: "i38", word: "持之以恒", pinyin: "chí zhī yǐ héng", meaning: "长久地坚持下去。", tip: "褒义，与“浅尝辄止”“半途而废”对照。", freq: 4 },
  { id: "i39", word: "望尘莫及", pinyin: "wàng chén mò jí", meaning: "远远落在后面，赶不上。", tip: "与“望其项背”方向相反，注意区分。", freq: 4 },
  { id: "i40", word: "不言而喻", pinyin: "bù yán ér yù", meaning: "不用说就明白。", tip: "强调道理浅显，不能形容感情深。", freq: 4 },
  { id: "i41", word: "不容置疑", pinyin: "bù róng zhì yí", meaning: "真实可信，不容怀疑。", tip: "与“不容置喙（不许插嘴）”不要混。", freq: 4 },
  { id: "i42", word: "别开生面", pinyin: "bié kāi shēng miàn", meaning: "另外开创新的局面或形式。", tip: "多修饰活动、形式，含褒义。", freq: 3 },
  { id: "i43", word: "殊途同归", pinyin: "shū tú tóng guī", meaning: "通过不同途径达到同一目的。", tip: "强调“结果相同”，不是过程相同。", freq: 3 },
  { id: "i44", word: "因势利导", pinyin: "yīn shì lì dǎo", meaning: "顺着事情发展的趋势加以引导。", tip: "治理类高频，强调“顺势”而非“强推”。", freq: 3 },
  { id: "i45", word: "扬长避短", pinyin: "yáng cháng bì duǎn", meaning: "发挥长处，回避短处。", tip: "常与“因地制宜”搭配写区域发展。", freq: 3 }
];

export const IDIOM_PAIRS: IdiomPair[] = [
  {
    id: "p01",
    focus: "是否表示“赶得上”",
    left: { word: "望其项背", note: "表示能赶得上，多用否定式“难以望其项背”。" },
    right: { word: "望尘莫及", note: "直接表示赶不上，本身即为否定含义。" }
  },
  {
    id: "p02",
    focus: "责难程度",
    left: { word: "无可厚非", note: "有缺点但可以谅解，程度轻。" },
    right: { word: "无可非议", note: "完全合理，没有可指责之处，程度重。" }
  },
  {
    id: "p03",
    focus: "是否含贬义",
    left: { word: "层出不穷", note: "中性偏多，可修饰新事物、新技术。" },
    right: { word: "屡见不鲜", note: "略带贬义，多修饰重复出现的负面现象。" }
  },
  {
    id: "p04",
    focus: "影响渠道",
    left: { word: "潜移默化", note: "泛指无形影响，不限定渠道。" },
    right: { word: "耳濡目染", note: "特指通过“听到、看到”受到影响。" }
  },
  {
    id: "p05",
    focus: "独特程度",
    left: { word: "别具一格", note: "只强调风格与众不同。" },
    right: { word: "独树一帜", note: "强调自成一家、形成体系，程度更重。" }
  },
  {
    id: "p06",
    focus: "最常见的误用",
    left: { word: "首当其冲", note: "只表示最先受到冲击或灾害，不等于“首先”。" },
    right: { word: "首屈一指", note: "表示居第一位，才是“最重要、排第一”。" }
  },
  {
    id: "p07",
    focus: "差异性质",
    left: { word: "大相径庭", note: "只说明差别很大。" },
    right: { word: "南辕北辙", note: "强调方向相反、背道而驰。" }
  },
  {
    id: "p08",
    focus: "时间与效果",
    left: { word: "立竿见影", note: "效果来得很快。" },
    right: { word: "久久为功", note: "需要长期坚持才见成效。" }
  },
  {
    id: "p09",
    focus: "治理深度",
    left: { word: "治标不治本", note: "只解决表面问题。" },
    right: { word: "标本兼治", note: "表里同治，是政策文段的正面表述。" }
  },
  {
    id: "p10",
    focus: "针对性来源",
    left: { word: "对症下药", note: "针对具体“问题”采取措施。" },
    right: { word: "因地制宜", note: "针对具体“条件、地域”制定办法。" }
  },
  {
    id: "p11",
    focus: "能否兼顾",
    left: { word: "顾此失彼", note: "无法兼顾，贬义。" },
    right: { word: "统筹兼顾", note: "全面照顾，褒义。" }
  },
  {
    id: "p12",
    focus: "是否已被验证",
    left: { word: "行之有效", note: "必须是已经实践并见效的办法。" },
    right: { word: "切实可行", note: "指方案在现实中能落地，不要求已验证。" }
  },
  {
    id: "p13",
    focus: "相似还是相同",
    left: { word: "如出一辙", note: "形式高度雷同，多含贬义。" },
    right: { word: "殊途同归", note: "路径不同但结果一致，中性偏褒。" }
  },
  {
    id: "p14",
    focus: "怀疑对象",
    left: { word: "不容置疑", note: "内容真实，不容怀疑。" },
    right: { word: "不容置喙", note: "不容许别人插嘴，指话语权。" }
  },
  {
    id: "p15",
    focus: "推进方式",
    left: { word: "因势利导", note: "顺着趋势引导，柔性。" },
    right: { word: "势在必行", note: "形势要求必须去做，强调必要性。" }
  }
];

export const IDIOM_CHECKIN_KEY = "fanfan-guanguan.exam.idiomCheckin.v1";

export type IdiomCheckinState = {
  dates: string[];
  learnedIds: string[];
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function loadIdiomCheckin(): IdiomCheckinState {
  const raw = getStorage()?.getItem(IDIOM_CHECKIN_KEY);
  if (!raw) {
    return { dates: [], learnedIds: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<IdiomCheckinState>;
    return {
      dates: Array.isArray(parsed.dates) ? parsed.dates.filter((item): item is string => typeof item === "string") : [],
      learnedIds: Array.isArray(parsed.learnedIds) ? parsed.learnedIds.filter((item): item is string => typeof item === "string") : []
    };
  } catch {
    return { dates: [], learnedIds: [] };
  }
}

export function saveIdiomCheckin(state: IdiomCheckinState) {
  getStorage()?.setItem(IDIOM_CHECKIN_KEY, JSON.stringify(state));
  void saveCloudValue(IDIOM_CHECKIN_KEY, state);
}

export async function hydrateIdiomCheckinFromCloud(): Promise<IdiomCheckinState> {
  const local = loadIdiomCheckin();
  return hydrateFromCloud<IdiomCheckinState>(IDIOM_CHECKIN_KEY, local, (value) => saveIdiomCheckin(value));
}

export function idiomStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date();

  for (;;) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    if (!set.has(`${year}-${month}-${day}`)) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** 每日 5 个成语，按天轮换 */
export function todayIdiomBatch(size = 5): IdiomEntry[] {
  const pool = HEBEI_IDIOMS.filter((item) => item.pinyin);
  if (pool.length === 0) {
    return [];
  }
  const now = new Date();
  const dayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  const start = (dayNumber * size) % pool.length;
  const batch: IdiomEntry[] = [];
  for (let index = 0; index < Math.min(size, pool.length); index += 1) {
    batch.push(pool[(start + index) % pool.length]);
  }
  return batch;
}
