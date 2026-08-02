import {
  deleteDiaryFromCloud,
  loadDiariesFromCloud,
  saveDiariesToCloud
} from "@/features/love/loveDiaryCloud";
import type { DiaryEntry } from "@/features/love/LovePanel";

function createDiaryClient(options?: { coupleId?: string | null; rows?: unknown[]; userId?: string }) {
  const calls = {
    rpc: [] as Array<{ args: unknown; name: string }>,
    table: [] as string[],
    upsert: [] as unknown[],
    select: [] as string[]
  };
  const userId = options?.userId ?? "user-a";

  const client = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null }))
    },
    from: jest.fn((table: string) => {
      calls.table.push(table);
      return {
        select: jest.fn((columns: string) => {
          calls.select.push(columns);
          return {
            is: jest.fn(() => ({
              order: jest.fn(() => ({
                order: jest.fn(async () => ({ data: options?.rows ?? [], error: null }))
              }))
            }))
          };
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
          visibility: "couple_read"
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
        content: "对方写的日记",
        createTime: "2026-08-02T08:00:00.000Z",
        date: "2026-08-02",
        id: "22222222-2222-4222-8222-222222222222",
        mood: "甜蜜",
        ownerUserId: "user-b",
        visibility: "couple_read"
      }
    ]);
    expect(writeLocal).toHaveBeenCalledWith(diaries);
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
