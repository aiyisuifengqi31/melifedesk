import { createFinanceId, getDefaultFinanceStorage, loadFinanceTransactions, saveFinanceTransactions, sortTransactions, type FinanceTransaction } from "@/features/finance/financeStorage";
import { createNoteId, getDefaultNotesStorage, loadNotes, saveNotes, type NoteItem } from "@/features/home/notesStorage";
import { createPackageId, getDefaultPackageStorage, loadPackages, savePackages, type PackageItem } from "@/features/plan/packageStorage";
import { createTodoId, getDefaultTodoStorage, loadLocalTodos, saveLocalTodos, sortTodos, type TodoPriority, type TodoTask } from "@/features/plan/todoStorage";
import type { TransactionType } from "@/features/finance/financeService";

export type QuickCaptureKind = "todo" | "note" | "expense" | "package";

export type QuickCaptureDraft = {
  amount: string;
  categoryName: string;
  confidence: "high" | "medium" | "low";
  date: string;
  kind: QuickCaptureKind;
  note: string;
  originalText: string;
  packageCompany: string;
  pickupCode: string;
  pickupLocation: string;
  priority: TodoPriority;
  time: string;
  title: string;
  transactionType: TransactionType;
};

export const QUICK_CAPTURE_DATA_EVENT = "lifedesk:quick-capture-saved";

const expenseKeywords = ["花", "买", "午饭", "早餐", "晚饭", "打车", "地铁", "消费", "支付", "支出", "块", "元"];
const incomeKeywords = ["工资", "到账", "收入", "收款", "退款", "红包"];
const packageKeywords = ["快递", "取件", "取货", "提货", "驿站", "快递柜", "菜鸟", "丰巢", "包裹"];
const todoKeywords = ["提醒", "待办", "明天", "后天", "今天", "下午", "上午", "晚上", "早上", "点", "要做", "记得"];

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function parseQuickCaptureText(text: string, now = new Date()): QuickCaptureDraft {
  const originalText = text.trim();
  const amount = parseAmount(originalText);
  const transactionType = incomeKeywords.some((keyword) => originalText.includes(keyword)) ? "income" : "expense";
  const date = parseRelativeDate(originalText, now);
  const time = parseTime(originalText);
  const packageLike = packageKeywords.some((keyword) => originalText.includes(keyword));
  const expenseLike = Boolean(amount) && (expenseKeywords.some((keyword) => originalText.includes(keyword)) || incomeKeywords.some((keyword) => originalText.includes(keyword)));
  const todoLike = todoKeywords.some((keyword) => originalText.includes(keyword));

  let kind: QuickCaptureKind = "note";
  if (packageLike) kind = "package";
  else if (expenseLike) kind = "expense";
  else if (todoLike) kind = "todo";

  const pickupCode = parsePickupCode(originalText);
  const title = cleanTitle(originalText, amount, time);

  return {
    amount,
    categoryName: guessCategory(originalText, transactionType),
    confidence: originalText ? (amount || pickupCode || todoLike ? "medium" : "low") : "low",
    date,
    kind,
    note: kind === "expense" ? title : originalText,
    originalText,
    packageCompany: guessPackageCompany(originalText),
    pickupCode,
    pickupLocation: guessPickupLocation(originalText),
    priority: originalText.includes("紧急") || originalText.includes("重要") ? "high" : "normal",
    time,
    title: title || originalText,
    transactionType
  };
}

export function saveQuickCaptureDraft(draft: QuickCaptureDraft) {
  const now = new Date().toISOString();

  if (draft.kind === "todo") {
    const storage = getDefaultTodoStorage();
    const task: TodoTask = {
      completed: false,
      createTime: now,
      deadline: draft.date || todayIso(),
      id: createTodoId(),
      priority: draft.priority,
      remindAt: draft.time ? `${draft.date || todayIso()}T${draft.time}` : null,
      title: draft.title.trim() || draft.originalText.trim()
    };
    saveLocalTodos(sortTodos([task, ...loadLocalTodos(storage)]), storage);
  }

  if (draft.kind === "note") {
    const storage = getDefaultNotesStorage();
    const note: NoteItem = {
      category: "未分类",
      content: draft.note.trim() || draft.originalText.trim(),
      createTime: now,
      id: createNoteId(),
      title: (draft.title.trim() || draft.originalText.trim()).slice(0, 24)
    };
    saveNotes([note, ...loadNotes(storage)], storage);
  }

  if (draft.kind === "expense") {
    const storage = getDefaultFinanceStorage();
    const transaction: FinanceTransaction = {
      amount: normalizeMoney(draft.amount),
      categoryName: draft.categoryName || (draft.transactionType === "income" ? "其他" : "更多"),
      createTime: now,
      id: createFinanceId("quick"),
      localDate: draft.date || todayIso(),
      note: draft.note.trim(),
      transactionType: draft.transactionType
    };
    if (!transaction.amount) throw new Error("请补充金额后再保存。");
    saveFinanceTransactions(sortTransactions([transaction, ...loadFinanceTransactions(storage)]), storage);
  }

  if (draft.kind === "package") {
    const storage = getDefaultPackageStorage();
    const item: PackageItem = {
      arrivalDate: draft.date || todayIso(),
      company: draft.packageCompany.trim(),
      createTime: now,
      id: createPackageId(),
      image: null,
      orderNumber: "",
      pickedUp: false,
      pickupCode: draft.pickupCode.trim(),
      pickupLocation: draft.pickupLocation.trim()
    };
    if (!item.company && !item.pickupCode && !item.pickupLocation && !draft.originalText.trim()) {
      throw new Error("请补充快递信息后再保存。");
    }
    savePackages([item, ...loadPackages(storage)], storage);
  }

  emitQuickCaptureSaved();
}

export function emitQuickCaptureSaved() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_DATA_EVENT));
  }
}

function parseAmount(text: string) {
  const match = text.match(/(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)?/);
  return match ? normalizeMoney(match[1]) : "";
}

function normalizeMoney(value: string) {
  const clean = value.replace(/[^\d.]/g, "");
  const parsed = Number(clean);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toFixed(2);
}

function parseRelativeDate(text: string, now: Date) {
  const date = new Date(now);
  if (text.includes("后天")) date.setDate(date.getDate() + 2);
  else if (text.includes("明天")) date.setDate(date.getDate() + 1);
  else if (text.includes("昨天")) date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function parseTime(text: string) {
  const match = text.match(/(?:上午|早上|下午|晚上)?\s*([一二三四五六七八九十\d]{1,3})(?:点|:|：)([一二三四五六七八九十\d]{1,3})?/);
  if (!match) return "";
  let hour = parseChineseNumber(match[1]);
  const minute = parseChineseNumber(match[2] ?? "0");
  if ((text.includes("下午") || text.includes("晚上")) && hour < 12) hour += 12;
  if (text.includes("早上") && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseChineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (digits[value.slice(1)] ?? 0);
  if (value.includes("十")) {
    const [left, right] = value.split("十");
    return (digits[left] ?? 1) * 10 + (digits[right] ?? 0);
  }
  return digits[value] ?? 0;
}

function parsePickupCode(text: string) {
  const match = text.match(/(?:取件码|取货码|提货码|开柜码|码)[：:\s]*([A-Za-z0-9]+(?:[-\s号柜门A-Za-z0-9]*[A-Za-z0-9])?)/);
  return match ? match[1].replace(/\s+/g, "-") : "";
}

function guessPackageCompany(text: string) {
  const companies = ["顺丰", "中通", "圆通", "申通", "韵达", "极兔", "京东物流", "邮政", "EMS", "菜鸟"];
  const found = companies.find((company) => text.includes(company));
  if (!found) return "";
  if (found === "邮政" || found === "EMS") return "邮政 EMS";
  return found.includes("物流") || found.includes("菜鸟") ? found : `${found}快递`;
}

function guessPickupLocation(text: string) {
  const match = text.match(/((?:[\u4e00-\u9fa5A-Za-z0-9]{2,18})(?:驿站|快递柜|快递超市|代收点|服务点|丰巢|菜鸟)[\u4e00-\u9fa5A-Za-z0-9-]{0,16})/);
  return match ? match[1] : "";
}

function guessCategory(text: string, type: TransactionType) {
  if (type === "income") {
    if (text.includes("工资")) return "工资";
    if (text.includes("退款")) return "退款";
    if (text.includes("红包")) return "红包";
    return "其他";
  }
  if (["饭", "餐", "奶茶", "咖啡", "外卖"].some((keyword) => text.includes(keyword))) return "餐饮";
  if (["菜", "超市", "水果"].some((keyword) => text.includes(keyword))) return "买菜";
  if (["地铁", "公交", "打车", "油"].some((keyword) => text.includes(keyword))) return "出行";
  if (["衣服", "淘宝", "京东", "购物"].some((keyword) => text.includes(keyword))) return "购物";
  return "更多";
}

function cleanTitle(text: string, amount: string, time: string) {
  return text
    .replace(amount, "")
    .replace(time, "")
    .replace(/提醒我|记一下|记得|花了|花|支付|支出|收入|到账|元|块钱|块/g, "")
    .trim();
}
