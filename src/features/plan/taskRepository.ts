import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskVisibility = "private" | "couple_read" | "couple_edit";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type TaskInput = {
  coupleId?: string | null;
  notes?: string | null;
  remindAt?: string | null;
  taskDate: string;
  title: string;
  visibility: TaskVisibility;
};

export type TaskUpdate = Partial<{
  completedAt: string | null;
  notes: string | null;
  remindAt: string | null;
  status: TaskStatus;
  taskDate: string;
  title: string;
  visibility: TaskVisibility;
}>;

function mapTaskInput(ownerUserId: string, input: TaskInput) {
  return {
    couple_id: input.coupleId ?? null,
    notes: input.notes ?? null,
    owner_user_id: ownerUserId,
    remind_at: input.remindAt ?? null,
    task_date: input.taskDate,
    title: input.title,
    visibility: input.visibility
  };
}

function mapTaskUpdate(update: TaskUpdate) {
  return {
    completed_at: update.completedAt,
    notes: update.notes,
    remind_at: update.remindAt,
    status: update.status,
    task_date: update.taskDate,
    title: update.title,
    visibility: update.visibility
  };
}

export async function listTasks(client: SupabaseClient, ownerUserId: string, taskDate: string) {
  return client.from("tasks").select("*").eq("owner_user_id", ownerUserId).eq("task_date", taskDate).is("deleted_at", null).order("created_at");
}

export async function createTask(client: SupabaseClient, ownerUserId: string, input: TaskInput) {
  return client.from("tasks").insert(mapTaskInput(ownerUserId, input)).select("*").single();
}

export async function updateTask(client: SupabaseClient, taskId: string, update: TaskUpdate) {
  return client.from("tasks").update(mapTaskUpdate(update)).eq("id", taskId).is("deleted_at", null).select("*").single();
}

export async function softDeleteTask(client: SupabaseClient, taskId: string) {
  return client.rpc("soft_delete_task", { p_task_id: taskId });
}

export async function listTaskSubitems(client: SupabaseClient, taskId: string) {
  return client.from("task_subitems").select("*").eq("task_id", taskId).is("deleted_at", null).order("position");
}

export async function listTaskRecurrence(client: SupabaseClient, taskId: string) {
  return client.from("task_recurrences").select("*").eq("task_id", taskId).is("deleted_at", null).maybeSingle();
}
