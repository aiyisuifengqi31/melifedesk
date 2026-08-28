import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

type LoveClient = SupabaseClient;

export type DiaryComment = {
  content: string;
  createTime: string;
  diaryId: string;
  id: string;
  updatedAt?: string;
  userId: string;
};

type DiaryCommentRow = {
  content: string | null;
  created_at: string | null;
  diary_id: string;
  id: string;
  updated_at: string | null;
  user_id: string;
};

export async function loadDiaryCommentsFromCloud(
  diaryId: string,
  client: LoveClient | null = getSupabaseClient()
): Promise<DiaryComment[]> {
  if (!client) return [];
  const { data, error } = await client
    .from("diary_comments")
    .select("id, diary_id, user_id, content, created_at, updated_at")
    .eq("diary_id", diaryId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapCommentRow(row as DiaryCommentRow));
}

export async function saveDiaryCommentToCloud(
  input: { content: string; diaryId: string; id: string },
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSession(client);
  if (!session) return;
  const content = input.content.trim();
  if (!content) return;
  const now = new Date().toISOString();
  const { error } = await session.client.from("diary_comments").upsert([
    {
      content,
      diary_id: input.diaryId,
      id: input.id,
      updated_at: now,
      user_id: session.userId
    }
  ], { onConflict: "id" });
  if (error) throw error;
}

export async function deleteDiaryCommentFromCloud(
  commentId: string,
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSession(client);
  if (!session) return;
  const { error } = await session.client
    .from("diary_comments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: session.userId })
    .eq("id", commentId);
  if (error) throw error;
}

async function getLoveSession(client: LoveClient | null): Promise<{ client: LoveClient; userId: string } | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

function mapCommentRow(row: DiaryCommentRow): DiaryComment {
  return {
    content: row.content ?? "",
    createTime: row.created_at ?? new Date().toISOString(),
    diaryId: row.diary_id,
    id: row.id,
    updatedAt: row.updated_at ?? row.created_at ?? undefined,
    userId: row.user_id
  };
}
