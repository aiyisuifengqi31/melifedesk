import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

import type { DiaryEntry } from "./LovePanel";

type DiaryRow = {
  body: string | null;
  created_at: string | null;
  entry_date: string | null;
  id: string;
  owner_user_id: string;
  tags: string[] | null;
  visibility: DiaryEntry["visibility"];
};

type LoveClient = SupabaseClient;

const DIARY_COLUMNS = "id, owner_user_id, visibility, entry_date, body, tags, created_at";

export async function loadDiariesFromCloud(
  localDiaries: DiaryEntry[],
  writeLocal: (entries: DiaryEntry[]) => void,
  client: LoveClient | null = getSupabaseClient()
): Promise<DiaryEntry[]> {
  const session = await getLoveSession(client);
  if (!session) return localDiaries;

  const { data, error } = await session.client
    .from("diary_entries")
    .select(DIARY_COLUMNS)
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) return localDiaries;

  if (data.length === 0 && localDiaries.length > 0) {
    const activeCoupleId = await getActiveCoupleId(session.client, session.userId);
    if (activeCoupleId) {
      const migratedDiaries = localDiaries.map((entry) => ({ ...entry, visibility: "couple_read" as const }));
      await upsertOwnedDiaries(session.client, session.userId, activeCoupleId, migratedDiaries);
      writeLocal(migratedDiaries);
      return migratedDiaries;
    }
  }

  const diaries = data.map((row) => mapDiaryRow(row as DiaryRow));
  writeLocal(diaries);
  return diaries;
}

export async function saveDiariesToCloud(
  entries: DiaryEntry[],
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSession(client);
  if (!session) return;

  const activeCoupleId = await getActiveCoupleId(session.client, session.userId);
  await upsertOwnedDiaries(session.client, session.userId, activeCoupleId, entries);
}

export async function deleteDiaryFromCloud(
  diaryId: string,
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSession(client);
  if (!session) return;
  await session.client.rpc("soft_delete_diary_entry", { p_diary_id: diaryId });
}

export async function getCurrentLoveUserId(client: LoveClient | null = getSupabaseClient()): Promise<string | null> {
  const session = await getLoveSession(client);
  return session?.userId ?? null;
}

async function upsertOwnedDiaries(
  client: LoveClient,
  userId: string,
  activeCoupleId: string | null,
  entries: DiaryEntry[]
) {
  const rows = entries
    .filter((entry) => !entry.ownerUserId || entry.ownerUserId === userId)
    .map((entry) => {
      const canShare = entry.visibility !== "private" && Boolean(activeCoupleId);
      return {
        ...(isUuid(entry.id) ? { id: entry.id } : {}),
        body: entry.content,
        couple_id: canShare ? activeCoupleId : null,
        entry_date: entry.date,
        owner_user_id: userId,
        tags: entry.mood ? [`mood:${entry.mood}`] : [],
        updated_at: new Date().toISOString(),
        visibility: canShare ? entry.visibility : "private"
      };
    });

  if (rows.length === 0) return;
  await client.from("diary_entries").upsert(rows, { onConflict: "id" });
}

async function getLoveSession(client: LoveClient | null): Promise<{ client: LoveClient; userId: string } | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

async function getActiveCoupleId(client: LoveClient, userId: string): Promise<string | null> {
  const { data, error } = await client.rpc("current_active_couple_id", { p_user_id: userId });
  if (error || typeof data !== "string") return null;
  return data;
}

function mapDiaryRow(row: DiaryRow): DiaryEntry {
  return {
    content: row.body ?? "",
    createTime: row.created_at ?? new Date().toISOString(),
    date: row.entry_date ?? new Date().toISOString().slice(0, 10),
    id: row.id,
    mood: extractMood(row.tags),
    ownerUserId: row.owner_user_id,
    visibility: row.visibility
  };
}

function extractMood(tags: string[] | null) {
  const moodTag = tags?.find((tag) => tag.startsWith("mood:"));
  return moodTag ? moodTag.slice("mood:".length) : "平静";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
