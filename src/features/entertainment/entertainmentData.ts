export type TrendItem = {
  id: string;
  rank: number;
  source: "百度" | "微博" | "知乎";
  title: string;
};

export type FashionItem = {
  brand: string;
  category: string;
  id: string;
  imageEmoji: string;
  title: string;
};

export type FashionGender = "女" | "男";
export type FashionCategory = "衣服" | "鞋子" | "上衣" | "裤子" | "裙子";

export type MakeupItem = {
  author: string;
  duration: string;
  emoji: string;
  id: string;
  title: string;
  views: string;
};

const TREND_POOLS: Record<TrendItem["source"], string[]> = {
  百度: ["国产大模型再升级", "暑期档电影票房破纪录", "新一线城市人才政策", "新能源汽车出海", "房贷利率调整", "AI 助手写周报", "城市夜经济升温"],
  微博: ["夏日清凉穿搭", "周末去哪儿玩", "明星新剧开播", "职场反内卷", "手机摄影技巧", "露营装备清单", "治愈系vlog"],
  知乎: ["如何提升执行力", "有哪些相见恨晚的效率工具", "长期主义真的有用吗", "租房避坑指南", "如何养成阅读习惯", "普通人如何理财", "怎样缓解焦虑"]
};

const FASHION_POOLS: Record<FashionCategory, Record<FashionGender, string[]>> = {
  衣服: {
    女: ["极简白衬衫", "oversize 卫衣", "针织开衫", "工装夹克", "真丝吊带"],
    男: ["牛津纺衬衫", "工装外套", "圆领卫衣", "POLO 衫", "休闲西装"]
  },
  鞋子: {
    女: ["德训鞋", "乐福鞋", "马丁靴", "老爹鞋", "玛丽珍鞋"],
    男: ["德训鞋", "工装靴", "乐福鞋", "帆布鞋", "运动跑鞋"]
  },
  上衣: {
    女: ["条纹 T 恤", "复古 Polo", "防晒衣", "牛仔衬衫", "法式方领"],
    男: ["重磅 T 恤", "亨利领长袖", "牛仔衬衫", "机能马甲", "条纹海魂衫"]
  },
  裤子: {
    女: ["阔腿西装裤", "工装裤", "微喇牛仔裤", "束脚卫裤", "直筒休闲裤"],
    男: ["直筒工装裤", "锥形西裤", "原色牛仔裤", "束脚卫裤", "多口袋短裤"]
  },
  裙子: {
    女: ["碎花半身裙", "A 字短裙", "吊带长裙", "百褶裙", "茶歇裙"],
    男: ["苏格兰裙", "山本耀司长裙", "围裙式裙裤", "和式袴裤", "中性纱笼"]
  }
};

const FASHION_EMOJIS: Record<FashionCategory, string> = {
  衣服: "👔",
  鞋子: "👟",
  上衣: "👕",
  裤子: "👖",
  裙子: "👗"
};

const FASHION_BRANDS = ["ZARA", "UNIQLO", "MUJI", "URBAN REVIVO", "COS", "GU", "H&M", "JNBY"];

const MAKEUP_POOLS = [
  "新手化妆教程：10分钟通勤妆",
  "单眼皮放大双眼眼妆拆解",
  "伪素颜裸妆步骤全记录",
  "口红试色：黄皮显白色号榜",
  "油皮持妆定妆秘籍",
  "新手画眉教程：野生眉",
  "约会心机淡妆",
  "新手修容高光教程",
  "旗袍妆造教学",
  "学生党平价彩妆清单",
  "年会全包眼妆",
  "黄黑皮底妆不卡粉"
];

const MAKEUP_AUTHORS = ["美妆小课堂", "化妆师Lily", "种草姬", "成分党阿May", "日常妆研所", "变美研究所"];
const MAKEUP_EMOJIS = ["💄", "💅", "🌸", "✨", "🎀"];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function todaySeed(): number {
  const now = new Date();
  return now.getFullYear() * 1000 + (now.getMonth() + 1) * 31 + now.getDate();
}

export function generateTrends(): TrendItem[] {
  const sources: TrendItem["source"][] = ["百度", "微博", "知乎"];
  const items: TrendItem[] = [];
  let rank = 1;
  for (const source of sources) {
    const titles = shuffle(TREND_POOLS[source]).slice(0, 2);
    for (const title of titles) {
      items.push({ id: `trend-${rank}`, rank, source, title });
      rank++;
    }
  }
  return shuffle(items);
}

export function generateFashion(gender: FashionGender, category: FashionCategory): FashionItem[] {
  const titles = shuffle(FASHION_POOLS[category][gender]).slice(0, 3);
  return titles.map((title, index) => ({
    brand: FASHION_BRANDS[(todaySeed() + index) % FASHION_BRANDS.length],
    category,
    id: `fashion-${category}-${index}-${Math.random().toString(16).slice(2, 7)}`,
    imageEmoji: FASHION_EMOJIS[category],
    title
  }));
}

export function generateMakeup(): MakeupItem[] {
  const titles = shuffle(MAKEUP_POOLS).slice(0, 5);
  return titles.map((title, index) => ({
    author: MAKEUP_AUTHORS[(todaySeed() + index) % MAKEUP_AUTHORS.length],
    duration: `0${8 + (index % 4)}:${String(10 + ((todaySeed() + index) % 50)).padStart(2, "0")}`,
    emoji: MAKEUP_EMOJIS[index % MAKEUP_EMOJIS.length],
    id: `makeup-${index}-${Math.random().toString(16).slice(2, 7)}`,
    title,
    views: `${(1 + ((todaySeed() + index) % 28))}.${index}万`
  }));
}
