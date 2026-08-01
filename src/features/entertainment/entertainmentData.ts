export type FashionGender = "女" | "男";
export type FashionCategory = "衣服" | "鞋子" | "上衣" | "裤子" | "裙子";

export type FashionItem = {
  category: FashionCategory;
  id: string;
  imageEmoji: string;
  keyword: string;
  tip: string;
  title: string;
};

export type MakeupItem = {
  emoji: string;
  id: string;
  keyword: string;
  level: string;
  title: string;
};

/** 每个渠道都是真实可打开的搜索地址 */
export type Channel = {
  build: (keyword: string) => string;
  id: string;
  label: string;
};

export const FASHION_CHANNELS: Channel[] = [
  { build: (k) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(k)}`, id: "xhs", label: "小红书穿搭" },
  { build: (k) => `https://s.taobao.com/search?q=${encodeURIComponent(k)}`, id: "taobao", label: "淘宝同款" },
  { build: (k) => `https://www.dewu.com/search?title=${encodeURIComponent(k)}`, id: "dewu", label: "得物" },
  { build: (k) => `https://search.jd.com/Search?keyword=${encodeURIComponent(k)}`, id: "jd", label: "京东" }
];

export const MAKEUP_CHANNELS: Channel[] = [
  { build: (k) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(k)}`, id: "bili", label: "B站教程" },
  { build: (k) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(k)}`, id: "xhs", label: "小红书" },
  { build: (k) => `https://www.douyin.com/search/${encodeURIComponent(k)}`, id: "douyin", label: "抖音" }
];

const FASHION_EMOJIS: Record<FashionCategory, string> = {
  上衣: "👕",
  衣服: "🧥",
  裙子: "👗",
  裤子: "👖",
  鞋子: "👟"
};

type FashionSeed = { tip: string; title: string };

const FASHION_POOLS: Record<FashionCategory, Record<FashionGender, FashionSeed[]>> = {
  上衣: {
    女: [
      { title: "条纹短袖T恤", tip: "海军蓝细条纹显白，配高腰裤最稳" },
      { title: "法式方领上衣", tip: "露锁骨拉长颈线，约会通勤都合适" },
      { title: "冰丝防晒衣", tip: "夏天户外必备，选带拇指孔的版型" },
      { title: "牛仔衬衫", tip: "浅蓝水洗最百搭，可当薄外套" },
      { title: "复古Polo针织衫", tip: "领口做旧感，配半裙很显气质" }
    ],
    男: [
      { title: "重磅纯棉T恤", tip: "240g以上克重不透不塌，白灰黑先囤" },
      { title: "亨利领长袖", tip: "半开襟显脸小，配工装裤有质感" },
      { title: "牛津纺衬衫", tip: "免烫版型，通勤和面试都能穿" },
      { title: "条纹海魂衫", tip: "配卡其短裤是夏日基础公式" },
      { title: "机能马甲", tip: "叠穿神器，选轻薄尼龙不臃肿" }
    ]
  },
  裙子: {
    女: [
      { title: "碎花茶歇裙", tip: "V领收腰，小个子选及膝长度" },
      { title: "A字牛仔半身裙", tip: "高腰款配短T，比例立刻拉高" },
      { title: "百褶中长裙", tip: "垂坠感面料显瘦，配乐福鞋" },
      { title: "吊带缎面长裙", tip: "配开衫防晒又慵懒" },
      { title: "工装口袋半裙", tip: "中性风，配马丁靴很飒" }
    ],
    男: [
      { title: "工装裙裤", tip: "看着像裙实际是裤，通勤也能穿" },
      { title: "山系速干裙裤", tip: "露营徒步透气不闷" },
      { title: "日系袴裤", tip: "宽松阔腿，配草履很有味道" },
      { title: "中性纱笼围裙", tip: "海边度假单品，轻便好收纳" },
      { title: "苏格兰格纹裙", tip: "叠穿在长裤外，街头风必备" }
    ]
  },
  裤子: {
    女: [
      { title: "高腰阔腿西装裤", tip: "垂感面料显腿长，黑灰米三色最实用" },
      { title: "微喇牛仔裤", tip: "遮小腿肚，配尖头鞋更修饰" },
      { title: "工装直筒裤", tip: "选低饱和卡其色，配紧身上衣" },
      { title: "束脚运动卫裤", tip: "居家外出通吃，选加长版盖鞋面" },
      { title: "冰丝直筒休闲裤", tip: "夏天不粘腿，办公室空调房友好" }
    ],
    男: [
      { title: "原色直筒牛仔裤", tip: "养牛入门款，选13oz左右不厚重" },
      { title: "锥形西裤", tip: "上宽下窄，商务休闲都能压得住" },
      { title: "多口袋工装裤", tip: "配简单上衣，避免全身都太花" },
      { title: "束脚机能裤", tip: "防泼水面料，通勤骑行方便" },
      { title: "亚麻休闲短裤", tip: "膝上5cm最显腿长" }
    ]
  },
  衣服: {
    女: [
      { title: "极简白衬衫", tip: "落肩版型遮肩宽，扎进裤腰更利落" },
      { title: "Oversize卫衣", tip: "配紧身下装平衡上下比例" },
      { title: "薄款针织开衫", tip: "空调房必备，选短款不压个子" },
      { title: "工装夹克", tip: "叠穿卫衣或衬衫，秋天最实用" },
      { title: "西装小外套", tip: "肩线合身最重要，宁可小一码" }
    ],
    男: [
      { title: "休闲西装外套", tip: "无衬结构更软，配T恤不显正式" },
      { title: "工装夹克", tip: "军绿卡其最百搭，内搭卫衣很稳" },
      { title: "连帽卫衣", tip: "选帽围挺括的，不塌才有型" },
      { title: "教练夹克", tip: "轻薄挡风，春秋通勤外套首选" },
      { title: "针织Polo衫", tip: "比T恤精致，商务休闲万能" }
    ]
  },
  鞋子: {
    女: [
      { title: "德训鞋", tip: "白灰配色最百搭，裙裤都能配" },
      { title: "乐福鞋", tip: "配西裤秒变通勤精英，建议买大半码" },
      { title: "马丁靴", tip: "8孔中筒最显腿细，配阔腿裤" },
      { title: "玛丽珍鞋", tip: "一字带显脚背窄，配袜子更甜" },
      { title: "厚底老爹鞋", tip: "增高神器，注意整体不要太重" }
    ],
    男: [
      { title: "德训鞋", tip: "复古麂皮拼接，通勤休闲都不出错" },
      { title: "工装靴", tip: "黄靴配直筒牛仔裤是经典组合" },
      { title: "乐福鞋", tip: "配九分西裤露脚踝更清爽" },
      { title: "帆布鞋", tip: "低帮更百搭，选硫化底耐穿" },
      { title: "缓震跑鞋", tip: "日常通勤久站首选，认准中底科技" }
    ]
  }
};

const MAKEUP_SEEDS: Array<{ level: string; title: string }> = [
  { level: "新手", title: "10分钟通勤淡妆教程" },
  { level: "新手", title: "新手画眉教程 野生眉" },
  { level: "新手", title: "底妆不卡粉不脱妆技巧" },
  { level: "进阶", title: "单眼皮眼妆放大双眼" },
  { level: "进阶", title: "修容高光打造小脸" },
  { level: "进阶", title: "内双肿眼泡眼妆教程" },
  { level: "日常", title: "伪素颜裸妆步骤" },
  { level: "日常", title: "油皮持妆定妆秘籍" },
  { level: "日常", title: "黄皮显白口红色号" },
  { level: "场合", title: "约会心机氛围感妆容" },
  { level: "场合", title: "证件照通用妆容" },
  { level: "场合", title: "新中式旗袍妆造" },
  { level: "省钱", title: "学生党平价彩妆推荐" },
  { level: "省钱", title: "百元内好用粉底液测评" }
];

const MAKEUP_EMOJIS = ["💄", "💅", "🌸", "✨", "🎀", "🪞"];

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function generateFashion(gender: FashionGender, category: FashionCategory): FashionItem[] {
  return shuffle(FASHION_POOLS[category][gender])
    .slice(0, 4)
    .map((seed, index) => ({
      category,
      id: `fashion-${category}-${gender}-${index}-${seed.title}`,
      imageEmoji: FASHION_EMOJIS[category],
      keyword: `${gender}${seed.title}`,
      tip: seed.tip,
      title: seed.title
    }));
}

export function generateMakeup(): MakeupItem[] {
  return shuffle(MAKEUP_SEEDS)
    .slice(0, 6)
    .map((seed, index) => ({
      emoji: MAKEUP_EMOJIS[index % MAKEUP_EMOJIS.length],
      id: `makeup-${index}-${seed.title}`,
      keyword: seed.title,
      level: seed.level,
      title: seed.title
    }));
}

export function openLink(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
