import type { SupabaseClient } from "@supabase/supabase-js";

export type Visibility = "private" | "couple_read" | "couple_edit";
export type TransactionType = "expense" | "income";

export type FinanceTransactionInput = {
  amount: string;
  categoryId: string;
  coupleId?: string | null;
  giftRecordId?: string | null;
  localDate: string;
  note?: string | null;
  transactionType: TransactionType;
  visibility: Visibility;
};

export async function listFinanceTransactions(client: SupabaseClient, ownerUserId: string, fromDate: string, toDate: string) {
  return client
    .from("finance_transactions")
    .select("*, finance_categories(name, transaction_type)")
    .eq("owner_user_id", ownerUserId)
    .gte("local_date", fromDate)
    .lte("local_date", toDate)
    .is("deleted_at", null)
    .order("local_date", { ascending: false });
}

export async function createFinanceTransaction(client: SupabaseClient, ownerUserId: string, input: FinanceTransactionInput) {
  return client
    .from("finance_transactions")
    .insert({
      amount: input.amount,
      category_id: input.categoryId,
      couple_id: input.coupleId ?? null,
      gift_record_id: input.giftRecordId ?? null,
      local_date: input.localDate,
      note: input.note ?? null,
      owner_user_id: ownerUserId,
      transaction_type: input.transactionType,
      visibility: input.visibility
    })
    .select("*")
    .single();
}

export async function softDeleteFinanceTransaction(client: SupabaseClient, transactionId: string) {
  return client.rpc("soft_delete_finance_transaction", { p_transaction_id: transactionId });
}

export async function softDeleteFinanceCategory(client: SupabaseClient, categoryId: string) {
  return client.rpc("soft_delete_finance_category", { p_category_id: categoryId });
}

export async function listFinanceCategories(client: SupabaseClient, transactionType: TransactionType) {
  return client.from("finance_categories").select("*").eq("transaction_type", transactionType).is("deleted_at", null).order("is_system", { ascending: false });
}
