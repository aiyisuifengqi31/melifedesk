export type ExternalTarget = {
  appUrl?: string;
  description: string;
  icon: string;
  id: string;
  title: string;
  webUrl: string;
};

/**
 * Web 页面无法探测手机上是否安装了某个 APP。
 * 通用做法：先尝试打开 APP 的 URL Scheme，如果 1.2 秒内页面没有被切到后台，
 * 说明多半没装（或系统拦截了），再退回网页版。
 */
export function openExternal(target: ExternalTarget) {
  if (typeof window === "undefined") {
    return;
  }

  const openWeb = () => window.open(target.webUrl, "_blank", "noopener,noreferrer");

  if (!target.appUrl) {
    openWeb();
    return;
  }

  let switched = false;
  const onHide = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      switched = true;
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHide);
  }

  const frame = typeof document !== "undefined" ? document.createElement("iframe") : null;
  if (frame && document.body) {
    frame.style.display = "none";
    frame.src = target.appUrl;
    document.body.appendChild(frame);
  } else {
    window.location.href = target.appUrl;
  }

  setTimeout(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onHide);
    }
    if (frame && frame.parentNode) {
      frame.parentNode.removeChild(frame);
    }
    if (!switched) {
      openWeb();
    }
  }, 1200);
}

/** 做题主入口：粉笔 */
export const FENBI_HOME: ExternalTarget = {
  appUrl: "fenbi://",
  description: "打开粉笔题库开始刷题，未安装会自动跳网页版",
  icon: "✏️",
  id: "fenbi-home",
  title: "去粉笔做题",
  webUrl: "https://www.fenbi.com/"
};

/** 四个专项方框 */
export const PRACTICE_MODULES: Array<ExternalTarget & { accentKey: string; internal?: "idiom" }> = [
  {
    accentKey: "data",
    appUrl: "fenbi://",
    description: "速算技巧 · 百分数 · 增长率 · 比重",
    icon: "📊",
    id: "data-analysis",
    title: "资料分析速算",
    webUrl: "https://www.fenbi.com/spa/tiku/guide/catalog/xingce/ziliaofenxi"
  },
  {
    accentKey: "logic",
    appUrl: "fenbi://",
    description: "论证结构 · 加强削弱 · 前提假设",
    icon: "🧩",
    id: "argument",
    title: "加强削弱分析",
    webUrl: "https://www.fenbi.com/spa/tiku/guide/catalog/xingce/panduantuili"
  },
  {
    accentKey: "graph",
    appUrl: "fenbi://",
    description: "位置规律 · 样式规律 · 属性数量",
    icon: "🔷",
    id: "graphic",
    title: "图形推理专项",
    webUrl: "https://www.fenbi.com/spa/tiku/guide/catalog/xingce/panduantuili"
  },
  {
    accentKey: "idiom",
    description: "近5年河北省考高频 · 易混辨析 · 背诵打卡",
    icon: "📖",
    id: "hebei-idiom",
    internal: "idiom",
    title: "河北高频成语",
    webUrl: ""
  }
];

/** 申论阅读：真实可跳转的权威来源 */
export const READING_SOURCES: ExternalTarget[] = [
  {
    description: "人民日报评论版，申论论点与论据的第一来源",
    icon: "📰",
    id: "rmrb-opinion",
    title: "人民日报评论",
    webUrl: "http://opinion.people.com.cn/"
  },
  {
    description: "人民日报电子版，逐版逐篇阅读今日报纸",
    icon: "🗞️",
    id: "rmrb-paper",
    title: "人民日报数字报",
    webUrl: "http://paper.people.com.cn/rmrb/"
  },
  {
    description: "人民网“人民时评”“评论员观察”专栏合集",
    icon: "🖊️",
    id: "rmrb-column",
    title: "人民时评专栏",
    webUrl: "http://opinion.people.com.cn/GB/223228/index.html"
  },
  {
    description: "半月谈时政专题，基层治理素材非常密集",
    icon: "📗",
    id: "banyuetan",
    title: "半月谈",
    webUrl: "http://www.banyuetan.org/"
  },
  {
    description: "求是网理论文章，适合积累规范表述",
    icon: "📕",
    id: "qstheory",
    title: "求是网",
    webUrl: "http://www.qstheory.cn/"
  },
  {
    description: "新华社评论，语言凝练适合仿写",
    icon: "📘",
    id: "xinhua",
    title: "新华时评",
    webUrl: "http://www.news.cn/comments/"
  },
  {
    description: "河北省人民政府门户，省内政策与本地素材",
    icon: "🏛️",
    id: "hebei-gov",
    title: "河北省政府网",
    webUrl: "https://www.hebei.gov.cn/"
  },
  {
    description: "河北日报客户端，省考本地热点必读",
    icon: "📄",
    id: "hebei-daily",
    title: "河北日报",
    webUrl: "http://hbrb.hebnews.cn/"
  }
];

export type GoldenSentence = {
  category: string;
  id: string;
  source: string;
  text: string;
};

/** 申论金句：按主题分类，方便直接背 */
export const GOLDEN_SENTENCES: GoldenSentence[] = [
  { category: "高质量发展", id: "g1", source: "人民日报", text: "高质量发展是全面建设社会主义现代化国家的首要任务，发展必须是科学发展，必须坚定不移贯彻创新、协调、绿色、开放、共享的新发展理念。" },
  { category: "高质量发展", id: "g2", source: "人民日报评论", text: "把发展经济的着力点放在实体经济上，加快建设制造强国、质量强国、航天强国、交通强国、网络强国、数字中国。" },
  { category: "基层治理", id: "g3", source: "半月谈", text: "基层治理是国家治理的基石，只有把基层这个基础打牢，国家治理的大厦才能坚固稳定。" },
  { category: "基层治理", id: "g4", source: "人民日报", text: "为基层减负，减的是形式主义的负担，增的是干事创业的底气。" },
  { category: "乡村振兴", id: "g5", source: "求是", text: "全面推进乡村振兴，要坚持产业兴旺、生态宜居、乡风文明、治理有效、生活富裕的总要求。" },
  { category: "乡村振兴", id: "g6", source: "人民日报", text: "把饭碗牢牢端在自己手中，中国人的饭碗任何时候都要牢牢端在自己手上。" },
  { category: "生态文明", id: "g7", source: "人民日报", text: "绿水青山就是金山银山，保护生态环境就是保护生产力，改善生态环境就是发展生产力。" },
  { category: "生态文明", id: "g8", source: "新华时评", text: "生态兴则文明兴，生态衰则文明衰。良好生态环境是最普惠的民生福祉。" },
  { category: "科技创新", id: "g9", source: "求是", text: "科技是第一生产力、人才是第一资源、创新是第一动力。" },
  { category: "科技创新", id: "g10", source: "人民日报", text: "关键核心技术是要不来、买不来、讨不来的，必须把创新主动权、发展主动权牢牢掌握在自己手中。" },
  { category: "文化自信", id: "g11", source: "人民日报", text: "文化自信是更基础、更广泛、更深厚的自信，是一个国家、一个民族发展中最基本、最深沉、最持久的力量。" },
  { category: "文化自信", id: "g12", source: "光明日报", text: "推动中华优秀传统文化创造性转化、创新性发展，让收藏在博物馆里的文物、陈列在广阔大地上的遗产都活起来。" },
  { category: "民生保障", id: "g13", source: "人民日报", text: "江山就是人民，人民就是江山。人民对美好生活的向往，就是我们的奋斗目标。" },
  { category: "民生保障", id: "g14", source: "人民时评", text: "民生无小事，枝叶总关情。把群众的操心事、烦心事、揪心事，一件一件办好。" },
  { category: "作风建设", id: "g15", source: "人民日报", text: "空谈误国，实干兴邦。一分部署，九分落实。" },
  { category: "作风建设", id: "g16", source: "求是", text: "以钉钉子精神抓落实，一锤接着一锤敲，一茬接着一茬干。" },
  { category: "数字经济", id: "g17", source: "人民日报", text: "数字经济事关国家发展大局，要做强做优做大我国数字经济，为构建新发展格局提供有力支撑。" },
  { category: "数字经济", id: "g18", source: "新华时评", text: "让数据多跑路、群众少跑腿，是数字政府建设最朴素也最实在的目标。" }
];

export function pickDailyIndex(length: number, offset = 0): number {
  if (length <= 0) {
    return 0;
  }
  const now = new Date();
  const dayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  return (dayNumber + offset) % length;
}

/** 每日一句鼓励（每天不同） */
export const DAILY_ENCOURAGEMENTS: string[] = [
  "今天多做一道题，考场上就少一分慌。",
  "上岸不是靠一天的猛冲，是靠三百天的不断线。",
  "别怕慢，怕的是停。今天的你已经比昨天多会了一点。",
  "学不进去的时候，就先做最简单的那一件事。",
  "把每一次做错，都当成考前替你排的雷。",
  "你不是不聪明，你只是还没把套路练熟。",
  "先完成，再完美。今天先把计划走完。",
  "焦虑解决不了任何问题，翻开书就可以。",
  "现在觉得难，是因为你正在变强的路上。",
  "省考不看你今天心情如何，只看你会不会做。",
  "坚持到别人放弃的那一天，名额就是你的。",
  "每天两小时，一年就是七百三十小时。",
  "题目会重复，努力也会。",
  "你已经走了很远了，别在这里回头。",
  "把注意力放在今天这一页，不要放在结果上。",
  "状态是练出来的，不是等出来的。",
  "考不上不可怕，可怕的是没认真拼过。",
  "慢慢来，比较快。",
  "今天的枯燥，是明天体制内的从容。",
  "别人刷手机的时候，你在刷题，这就是差距。",
  "行测提速靠手感，申论提分靠积累，都要每天见。",
  "不要和别人比进度，只和昨天的自己比。",
  "情绪先放一边，先做十道题再说。",
  "所谓天赋，不过是重复的次数够多。",
  "上岸那天，你会感谢今天不肯放过自己的你。",
  "把大目标切成小任务，今天只完成一格。",
  "错了就标记，标记了就重做，重做了就记住。",
  "自律给你自由，考编给你安稳。",
  "今天不想学，那就学十分钟，十分钟后再决定。",
  "路在脚下，答案在笔下。",
  "越到后面越拼耐力，你要做那个熬住的人。"
];

export function todayEncouragement(): string {
  return DAILY_ENCOURAGEMENTS[pickDailyIndex(DAILY_ENCOURAGEMENTS.length)];
}
