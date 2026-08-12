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
  GIFT_KEY,
  LOVE_FOLDER_KEY,
  buildPhotoGroups,
  hydrateLoveFromCloud,
  saveAnniversaries,
  saveDiaries,
  saveGifts,
  type AnniversaryEntry,
  type DiaryEntry,
  type GiftEntry
} from "@/features/love/LovePanel";
import { hydrateLoveSharedValue, saveLoveSharedValue } from "@/features/love/loveSharedCloud";
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

jest.mock("@/features/love/loveSharedCloud", () => ({
  hydrateLoveSharedValue: jest.fn(async (_key: string, localValue: unknown) => localValue),
  saveLoveSharedValue: jest.fn(async () => undefined)
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
      categoryName: "food",
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
      parts: ["back"],
      sessionDate: "2026-08-02",
      status: "trained",
      title: "back training"
    };

    saveLocalWorkouts([log], storage);
    await hydrateWorkoutsFromCloud(storage);

    expect(saveCloudValue).toHaveBeenCalledWith(WORKOUT_STORAGE_KEY, [log]);
    expect(hydrateFromCloud).toHaveBeenCalledWith(WORKOUT_STORAGE_KEY, [log], expect.any(Function));
  });

  it("syncs all love tabs through the couple shared store instead of user key-value rows", async () => {
    const storage = makeStorage();
    const diary: DiaryEntry = {
      content: "walk together",
      createTime: "2026-08-02T08:00:00.000Z",
      date: "2026-08-02",
      id: "diary-cloud",
      mood: "happy",
      visibility: "couple_edit"
    };
    const anniversary: AnniversaryEntry = {
      date: "2026-08-02",
      id: "anniversary-cloud",
      repeatYearly: true,
      title: "first trip"
    };
    const gift: GiftEntry = {
      createTime: "2026-08-02T08:00:00.000Z",
      date: "2026-08-02",
      description: "",
      id: "gift-cloud",
      image: null,
      name: "flowers",
      tag: "daily"
    };

    saveDiaries([diary], storage);
    saveAnniversaries([anniversary], storage);
    saveGifts([gift], storage);
    await hydrateLoveFromCloud(storage);

    expect(saveCloudValue).not.toHaveBeenCalledWith(DIARY_KEY, [diary]);
    expect(saveCloudValue).not.toHaveBeenCalledWith(ANNIVERSARY_KEY, [anniversary]);
    expect(saveCloudValue).not.toHaveBeenCalledWith(GIFT_KEY, [gift]);
    expect(saveLoveSharedValue).toHaveBeenCalledWith(DIARY_KEY, [diary]);
    expect(saveLoveSharedValue).toHaveBeenCalledWith(ANNIVERSARY_KEY, [anniversary]);
    expect(saveLoveSharedValue).toHaveBeenCalledWith(GIFT_KEY, [gift]);
    expect(hydrateFromCloud).not.toHaveBeenCalledWith(DIARY_KEY, [diary], expect.any(Function));
    expect(hydrateFromCloud).not.toHaveBeenCalledWith(ANNIVERSARY_KEY, [anniversary], expect.any(Function));
    expect(hydrateFromCloud).not.toHaveBeenCalledWith(GIFT_KEY, [gift], expect.any(Function));
    expect(hydrateLoveSharedValue).toHaveBeenCalledWith(DIARY_KEY, [diary], expect.any(Function));
    expect(hydrateLoveSharedValue).toHaveBeenCalledWith(ANNIVERSARY_KEY, [anniversary], expect.any(Function));
    expect(hydrateLoveSharedValue).toHaveBeenCalledWith(GIFT_KEY, [gift], expect.any(Function));
    expect(hydrateLoveSharedValue).toHaveBeenCalledWith(LOVE_FOLDER_KEY, [], expect.any(Function));
  });

  it("groups photo wall images by the source folder and falls diary photos back to the diary album", () => {
    const diaryFolder = { createTime: "2026-08-01T08:00:00.000Z", id: "folder-trip", name: "旅行" };
    const grouped = buildPhotoGroups(
      [
        {
          content: "with folder",
          createTime: "2026-08-02T08:00:00.000Z",
          date: "2026-08-02",
          folderId: diaryFolder.id,
          id: "diary-trip",
          images: ["trip-photo"],
          mood: "happy",
          visibility: "couple_edit"
        },
        {
          content: "without folder",
          createTime: "2026-08-03T08:00:00.000Z",
          date: "2026-08-03",
          id: "diary-default",
          images: ["diary-photo"],
          mood: "happy",
          visibility: "couple_edit"
        }
      ],
      [],
      [],
      [diaryFolder]
    );

    expect(grouped.map((group) => group.title)).toEqual(["日记本", "旅行"]);
    expect(grouped.find((group) => group.key === "folder-trip")?.photos[0].image).toBe("trip-photo");
    expect(grouped.find((group) => group.key === "album-diary")?.photos[0].image).toBe("diary-photo");
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
