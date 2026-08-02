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
});
