import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";
import {
  FINANCE_TRANSACTIONS_KEY,
  hydrateFinanceTransactionsFromCloud,
  saveFinanceTransactions,
  type FinanceTransaction
} from "@/features/finance/financeStorage";
import {
  hydrateWorkoutsFromCloud,
  saveLocalWorkouts,
  WORKOUT_STORAGE_KEY,
  type WorkoutLog
} from "@/features/workout/workoutStorage";
import {
  ANNIVERSARY_KEY,
  DIARY_KEY,
  hydrateLoveFromCloud,
  saveAnniversaries,
  saveDiaries,
  type AnniversaryEntry,
  type DiaryEntry
} from "@/features/love/LovePanel";
import {
  hydrateIdiomCheckinFromCloud,
  IDIOM_CHECKIN_KEY,
  saveIdiomCheckin
} from "@/features/exam/idiomData";
import {
  BACKGROUND_STORAGE_KEY,
  hydrateBackgroundFromCloud,
  saveBackground,
  type BackgroundSource
} from "@/theme/background";

jest.mock("@/features/sync/cloudSync", () => ({
  hydrateFromCloud: jest.fn(async (_key: string, localValue: unknown) => localValue),
  saveCloudValue: jest.fn(async () => undefined)
}));

function makeStorage() {
  const data = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    removeItem: jest.fn((key: string) => data.delete(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
}

describe("cloud backed storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: makeStorage()
    });
    jest.clearAllMocks();
  });

  it("syncs finance transactions through the cloud key-value store", async () => {
    const storage = makeStorage();
    const transaction: FinanceTransaction = {
      amount: "88.00",
      categoryName: "餐饮",
      createTime: "2026-08-02T08:00:00.000Z",
      id: "finance-cloud",
      localDate: "2026-08-02",
      note: "",
      transactionType: "expense"
    };

    saveFinanceTransactions([transaction], storage);
    await hydrateFinanceTransactionsFromCloud(storage);

    expect(saveCloudValue).toHaveBeenCalledWith(FINANCE_TRANSACTIONS_KEY, [transaction]);
    expect(hydrateFromCloud).toHaveBeenCalledWith(FINANCE_TRANSACTIONS_KEY, [transaction], expect.any(Function));
  });

  it("syncs workout logs through the cloud key-value store", async () => {
    const storage = makeStorage();
    const log: WorkoutLog = {
      createTime: "2026-08-02T08:00:00.000Z",
      durationMinutes: 30,
      id: "workout-cloud",
      intensity: "moderate",
      kcal: 200,
      kcalSource: "manual",
      parts: ["背"],
      sessionDate: "2026-08-02",
      status: "trained",
      title: "背部训练"
    };

    saveLocalWorkouts([log], storage);
    await hydrateWorkoutsFromCloud(storage);

    expect(saveCloudValue).toHaveBeenCalledWith(WORKOUT_STORAGE_KEY, [log]);
    expect(hydrateFromCloud).toHaveBeenCalledWith(WORKOUT_STORAGE_KEY, [log], expect.any(Function));
  });

  it("keeps love anniversaries in the key-value store while diaries use the shared diary table", async () => {
    const storage = makeStorage();
    const diary: DiaryEntry = {
      content: "今天一起散步",
      createTime: "2026-08-02T08:00:00.000Z",
      date: "2026-08-02",
      id: "diary-cloud",
      mood: "开心",
      visibility: "couple_read"
    };
    const anniversary: AnniversaryEntry = {
      date: "2026-08-02",
      id: "anniversary-cloud",
      repeatYearly: true,
      title: "第一次旅行"
    };

    saveDiaries([diary], storage);
    saveAnniversaries([anniversary], storage);
    await hydrateLoveFromCloud(storage);

    expect(saveCloudValue).toHaveBeenCalledWith(ANNIVERSARY_KEY, [anniversary]);
    expect(saveCloudValue).not.toHaveBeenCalledWith(DIARY_KEY, [diary]);
    expect(hydrateFromCloud).not.toHaveBeenCalledWith(DIARY_KEY, [diary], expect.any(Function));
    expect(hydrateFromCloud).toHaveBeenCalledWith(ANNIVERSARY_KEY, [anniversary], expect.any(Function));
  });

  it("syncs idiom check-ins through the cloud key-value store", async () => {
    const state = { dates: ["2026-08-02"], learnedIds: ["idiom-1"] };

    saveIdiomCheckin(state);
    await hydrateIdiomCheckinFromCloud();

    expect(saveCloudValue).toHaveBeenCalledWith(IDIOM_CHECKIN_KEY, state);
    expect(hydrateFromCloud).toHaveBeenCalledWith(IDIOM_CHECKIN_KEY, state, expect.any(Function));
  });

  it("syncs background selection through the cloud key-value store", async () => {
    const source: BackgroundSource = { kind: "preset", uri: "/melifedesk/backgrounds/theme-dogs.jpg" };

    saveBackground(source);
    await hydrateBackgroundFromCloud();

    expect(saveCloudValue).toHaveBeenCalledWith(BACKGROUND_STORAGE_KEY, source);
    expect(hydrateFromCloud).toHaveBeenCalledWith(BACKGROUND_STORAGE_KEY, source, expect.any(Function));
  });
});
