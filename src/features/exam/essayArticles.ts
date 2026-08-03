export type EssayReadStatus = "unread" | "reading" | "read";

export type EssayArticle = {
  fetchedAt: string;
  id: string;
  keyPoints: string[];
  officialUrl: string;
  publishedAt: string;
  quotes: string[];
  recommendationReason: string;
  source: string;
  structure: string[];
  summary: string;
  title: string;
  topics: string[];
};

export const ESSAY_TOPICS = ["全部", "高质量发展", "基层治理", "乡村振兴", "民生保障", "科技创新", "生态文明", "青年担当"];
export const ESSAY_SOURCES = ["全部", "人民日报", "新华社", "人民网", "求是", "半月谈", "其他官方来源"];
export const ESSAY_TIME_FILTERS = ["最近7天", "最近30天", "历史收藏"] as const;

export const REAL_ESSAY_ARTICLES: EssayArticle[] = [
  {
    fetchedAt: "2026-08-03T00:00:00+08:00",
    id: "people-livelihood-20260725",
    keyPoints: [
      "把经济发展成果转化为更可感的民生福祉，是高质量发展的价值落点。",
      "基本公共服务要坚持普惠性、基础性、兜底性，回应群众急难愁盼。",
      "城市更新、就业支持、社会保障等民生事项，需要在财政投入和基层执行之间形成闭环。"
    ],
    officialUrl: "https://cpc.people.com.cn/n1/2026/0725/c64387-40767687.html",
    publishedAt: "2026-07-25",
    quotes: ["一枝一叶总关情，民生改善见初心。", "把群众的生活小事，当成治理的大事。"],
    recommendationReason: "近 30 天内人民日报来源文章，主题贴合民生保障和高质量发展，适合用于民生类申论材料积累。",
    source: "人民日报",
    structure: ["用群众生活变化切入", "展开政策部署和民生举措", "回到高质量发展中的民生目标"],
    summary:
      "文章围绕年中经济观察中的民生保障展开，从老旧小区改造、公共服务供给、就业和社会保障等角度说明发展成果如何落到群众生活中。适合作为“发展为了人民”“高质量发展与民生改善同向发力”的素材，能用于论证政策温度、基层执行和长期制度建设之间的关系。",
    title: "民生保障扎实有力（年中经济观察）",
    topics: ["民生保障", "高质量发展"]
  },
  {
    fetchedAt: "2026-08-03T00:00:00+08:00",
    id: "people-partybuilding-20260716",
    keyPoints: [
      "基层党组织是基层治理和服务群众的重要支点。",
      "党建引领不能停留在口号，要落实到社区治理、村庄发展和公共服务中。",
      "基层治理水平提升，需要组织力、服务力和群众参与共同发力。"
    ],
    officialUrl: "https://politics.people.com.cn/n1/2026/0716/c461001-40761868.html",
    publishedAt: "2026-07-16",
    quotes: ["组织强，则基层稳；服务实，则民心聚。", "把堡垒建在群众需要的地方。"],
    recommendationReason: "人民日报客户端近 30 天内容，聚焦基层党建与社区治理，适合申论基层治理主题。",
    source: "人民日报客户端",
    structure: ["从总书记基层调研切入", "梳理基层党建一贯关切", "落到社区治理和乡村组织建设"],
    summary:
      "文章从基层党建这一治理基础切入，梳理总书记对基层工作的持续关切，强调把基层党组织建设成为坚强战斗堡垒。用于申论写作时，可提炼为党建引领基层治理、组织体系下沉、服务群众前移等角度，尤其适合社区治理、乡村治理、基层干部队伍建设类题目。",
    title: "一见·再看基层党建，读懂总书记的关切",
    topics: ["基层治理"]
  },
  {
    fetchedAt: "2026-08-03T00:00:00+08:00",
    id: "xinhua-rural-civilization-20260716",
    keyPoints: [
      "乡村振兴既要塑形，也要铸魂，文明乡风是内生动力。",
      "新时代文明实践站、农家书屋等平台能把公共文化服务送到村民身边。",
      "治理新风、产业发展和文化传承可以共同构成乡村振兴的长效机制。"
    ],
    officialUrl: "https://www.news.cn/politics/20260716/ad0ec782774044db96dc51ee32c6f12c/c.html",
    publishedAt: "2026-07-16",
    quotes: ["乡村要振兴，乡风必文明。", "文明新风，是乡村全面振兴的精神底色。"],
    recommendationReason: "新华社近 30 天报道，兼具乡村振兴和文化文明主题，素材可迁移性强。",
    source: "新华社",
    structure: ["用大会和报告引入", "以数据呈现文明乡风建设", "从理论传播、文化服务、治理新风展开"],
    summary:
      "文章围绕文明乡风建设，呈现新时代文明实践、农业文化遗产、高素质农民培育等内容，说明乡村振兴不仅是产业和环境提升，也包括精神文明建设。适合积累“乡村振兴要内外兼修”“以文化人、以风化俗”等表达，并用于乡村治理和公共文化服务主题。",
    title: "新华鲜报丨乡村要振兴 乡风必文明",
    topics: ["乡村振兴", "生态文明"]
  },
  {
    fetchedAt: "2026-08-03T00:00:00+08:00",
    id: "xinhua-rural-path-20260709",
    keyPoints: [
      "乡村振兴要因地制宜，立足资源禀赋探索多元路径。",
      "产业、就业、文化服务和生态资源转化可以相互支撑。",
      "基层实践案例适合用于说明政策落地需要精准施策。"
    ],
    officialUrl: "https://www.news.cn/politics/20260709/85fcdfe347644fc9bf69f6d1e85ed9cc/c.html",
    publishedAt: "2026-07-09",
    quotes: ["一村一策，才能走出振兴新路。", "把资源优势转化为发展胜势。"],
    recommendationReason: "新华社近 30 天乡村振兴案例报道，包含多地实践，便于提炼案例论据。",
    source: "新华社",
    structure: ["总述多维度探索", "列举产业和就业案例", "呈现公共文化和生态资源转化"],
    summary:
      "文章汇集多地乡村振兴实践，从智能养殖、特色农产品、农家书屋、稻蟹共生等角度展示不同地区的探索。申论写作中可用于论证因地制宜、产业带动就业、公共文化赋能乡村、生态资源价值转化等观点，是案例型论据的好素材。",
    title: "新华视点丨多维度发力 探索乡村振兴新路径",
    topics: ["乡村振兴", "高质量发展"]
  },
  {
    fetchedAt: "2026-08-03T00:00:00+08:00",
    id: "people-disaster-governance-20260706",
    keyPoints: [
      "基层是防灾减灾救灾第一线，能力建设必须向基层倾斜。",
      "预警联动、前瞻行动和科技赋能可以提升基层应急治理韧性。",
      "安全治理要从事后处置转向事前预防和全链条协同。"
    ],
    officialUrl: "https://theory.people.com.cn/n1/2026/0706/c40531-40754007.html",
    publishedAt: "2026-07-06",
    quotes: ["基层强则安全根基稳，基础实则治理韧性足。", "治理向前一步，风险就少一分。"],
    recommendationReason: "人民日报理论文章，近 30 天内发布，适合基层治理、应急管理和公共安全主题。",
    source: "人民日报",
    structure: ["指出基层基础地位", "分析预警联动与科技赋能", "落到治理体系和能力现代化"],
    summary:
      "文章围绕防灾减灾救灾中的基层基础建设展开，强调资源向基层倾斜、力量向一线下沉，并提出预警联动、科技赋能、生态减灾等治理方向。适合用于公共安全、基层治理现代化和风险防控主题，能帮助写出从理念到机制再到技术支撑的论证层次。",
    title: "以抓基层夯实防灾减灾救灾的基础（有的放矢）",
    topics: ["基层治理", "民生保障"]
  }
];

export function isWithinDays(publishedAt: string, now: Date, days: number) {
  const published = new Date(`${publishedAt}T00:00:00+08:00`).getTime();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return current - published <= days * 86400000 && current >= published;
}
