import type { Database } from "@/integrations/supabase/types";

type PublicWeddingRow = Database["public"]["Views"]["wedding_public"]["Row"];

/** Views have nullable generated types; reject incomplete records at the read boundary. */
export function validPublicWedding(row: PublicWeddingRow | null) {
  if (!row?.id || !row.slug || !row.bride_name || !row.groom_name) return null;
  return { ...row, id: row.id, slug: row.slug, bride_name: row.bride_name, groom_name: row.groom_name };
}