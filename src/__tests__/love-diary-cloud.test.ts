import {
  deleteDiaryFromCloud,
  loadDiariesFromCloud,
  saveDiariesToCloud
} from "@/features/love/loveDiaryCloud";
import type { DiaryEntry } from "@/features/love/LovePanel";

function createDiaryClient(options?: { coupleId?: string | null; rows?: unknown[]; userId?: string }) {
  type QueryMock = {
    eq: jest.Mock<QueryMock, [string, unknown]>;
    is: jest.Mock<QueryMock, unknown[]>;
    order: jest.Mock<QueryMock | Promise<{ data: unknown[]; error: null }>, unknown[]>;
  };
  const calls = {
    rpc: [] as Array<{ args: unknown; name: string }>,
    table: [] as string[],
    upsert: [] as unknown[],
    select: [] as string[],
    eq: [] as Array<{ column: string; value: unknown }>
  };
  const userId = options?.userId ?? "user-a";

  const client = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null }))
    },
    from: jest.fn((table: string) => {
      calls.table.push(table);
      let orderCount = 0;
      const query: QueryMock = {
        eq: jest.fn((column, value) => {
          calls.eq.push({ column, value });
          return query;
        }),
        is: jest.fn(() => query),
        order: jest.fn(() => {
          orderCount += 1;
          return orderCount >= 2 ? Promise.resolve({ data: options?.rows ?? [], error: null }) : query;
        })
      };
      return {
        select: jest.fn((columns: string) => {
          calls.select.push(columns);
          return query;
        }),
        upsert: jest.fn(async (rows: unknown, opts: unknown) => {
          calls.upsert.push({ opts, rows });
          return { data: null, error: null };
        })
      };
    }),
    rpc: jest.fn(async (name: string, args: unknown) => {
      calls.rpc.push({ args, name });
      if (name === "current_active_couple_id") {
        return { data: options?.coupleId ?? null, error: null };
      }
      return { data: "deleted-id", error: null };
    })
  };

  return { calls, client };
}

describe("love diary cloud sharing", () => {
  it("saves couple-readable diaries with the active couple id", async () => {
    const { calls, client } = createDiaryClient({ coupleId: "couple-1" });
    const diary: DiaryEntry = {
      content: "今天一起散步",
      createTime: "2026-08-02T08:00:00.000Z",
      date: "2026-08-02",
      id: "11111111-1111-4111-8111-111111111111",
      mood: "开心",
      visibility: "couple_read"
    };

    await saveDiariesToCloud([diary], client as never);

    expect(calls.rpc).toContainEqual({
      args: { p_user_id: "user-a" },
      name: "current_active_couple_id"
    });
    expect(calls.table).toContain("diary_entries");
    expect(calls.upsert[0]).toEqual({
      opts: { onConflict: "id" },
      rows: [
        expect.objectContaining({
          body: "今天一起散步",
          couple_id: "couple-1",
          entry_date: "2026-08-02",
          id: "11111111-1111-4111-8111-111111111111",
          owner_user_id: "user-a",
          visibility: "couple_edit"
        })
      ]
    });
  });

  it("loads diaries from the current couple shared space instead of an owner-only feed", async () => {
    const { calls, client } = createDiaryClient({
      coupleId: "couple-1",
      rows: [
        {
          body: "共同空间里的日记",
          created_at: "2026-08-04T08:00:00.000Z",
          entry_date: "2026-08-04",
          id: "44444444-4444-4444-8444-444444444444",
          owner_user_id: "user-b",
          tags: ["mood:甜蜜"],
          visibility: "couple_edit"
        }
      ],
      userId: "user-a"
    });

    await loadDiariesFromCloud([], jest.fn(), client as never);

    expect(calls.rpc).toContainEqual({
      args: { p_user_id: "user-a" },
      name: "current_active_couple_id"
    });
    // Access is now decided by RLS (owner + current active partner of owner),
    // not by a stored couple_id filter, so the cloud query no longer filters by
    // couple_id. The shared diaries returned by RLS (including the partner's)
    // are what we map and surface.
    expect(calls.eq).not.toContainEqual({ column: "couple_id", value: "couple-1" });
  });

  it("saves partner edits into the shared couple row without changing the original author", async () => {
    const { calls, client } = createDiaryClient({ coupleId: "couple-1", userId: "user-a" });
    const partnerDiary: DiaryEntry = {
      content: "我补充了一句",
      createTime: "2026-08-02T08:00:00.000Z",
      date: "2026-08-02",
      id: "55555555-5555-4555-8555-555555555555",
      mood: "甜蜜",
      ownerUserId: "user-b",
      title: "一起散步",
      visibility: "couple_edit"
    };

    await saveDiariesToCloud([partnerDiary], client as never);

    expect(calls.upsert[0]).toEqual({
      opts: { onConflict: "id" },
      rows: [
        expect.objectContaining({
          couple_id: "couple-1",
          id: "55555555-5555-4555-8555-555555555555",
          owner_user_id: "user-b",
          updated_by: "user-a",
          visibility: "couple_edit"
        })
      ]
    });
  });

  it("loads visible partner diaries returned by Supabase RLS", async () => {
    const { client } = createDiaryClient({
      coupleId: "couple-1",
      rows: [
        {
          body: "对方写的日记",
          created_at: "2026-08-02T08:00:00.000Z",
          entry_date: "2026-08-02",
          id: "22222222-2222-4222-8222-222222222222",
          owner_user_id: "user-b",
          tags: ["mood:甜蜜"],
          visibility: "couple_read"
        }
      ],
      userId: "user-a"
    });
    const writeLocal = jest.fn();

    const diaries = await loadDiariesFromCloud([], writeLocal, client as never);

    expect(diaries).toEqual([
      {
        category: "日常记录",
        content: "对方写的日记",
        createTime: "2026-08-02T08:00:00.000Z",
        date: "2026-08-02",
        id: "22222222-2222-4222-8222-222222222222",
        mood: "甜蜜",
        ownerUserId: "user-b",
        title: "对方写的日记",
        updatedAt: "2026-08-02T08:00:00.000Z",
        updatedBy: "user-b",
        visibility: "couple_read"
      }
    ]);
    expect(writeLocal).toHaveBeenCalledWith(diaries);
  });

  it("migrates legacy local diaries into the shared table when cloud is empty", async () => {
    const { calls, client } = createDiaryClient({ coupleId: "couple-1", rows: [] });
    const localDiary: DiaryEntry = {
      content: "旧版本本地日记",
      createTime: "2026-08-02T08:00:00.000Z",
      date: "2026-08-02",
      id: "33333333-3333-4333-8333-333333333333",
      mood: "开心",
      visibility: "private"
    };

    const diaries = await loadDiariesFromCloud([localDiary], jest.fn(), client as never);

    expect(diaries).toEqual([{ ...localDiary, visibility: "couple_edit" }]);
    expect(calls.upsert[0]).toEqual({
      opts: { onConflict: "id" },
      rows: [
        expect.objectContaining({
          body: "旧版本本地日记",
          couple_id: "couple-1",
          id: "33333333-3333-4333-8333-333333333333",
          visibility: "couple_edit"
        })
      ]
    });
  });

  it("soft deletes through the diary permission RPC", async () => {
    const { calls, client } = createDiaryClient();

    await deleteDiaryFromCloud("22222222-2222-4222-8222-222222222222", client as never);

    expect(calls.rpc).toContainEqual({
      args: { p_diary_id: "22222222-2222-4222-8222-222222222222" },
      name: "soft_delete_diary_entry"
    });
  });
});
