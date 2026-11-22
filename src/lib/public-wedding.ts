import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

// Explicit projection for deployments whose generated schema predates the view.
// Never model private wedding settings as public fields.
type WeddingRow = Database["public"]["Tables"]["weddings"]["Row"];
type PublicField = "id" | "slug" | "bride_name" | "groom_name" | "approval_status" | "published" | "require_login" | "bride_photo_url" | "groom_photo_url" | "ceremony_address" | "ceremony_map_url" | "ceremony_time" | "ceremony_venue" | "couple_intro" | "cover_image_url" | "created_at" | "dress_code" | "hashtag" | "hero_fit" | "hero_height" | "hero_opacity" | "hero_pos_x" | "hero_pos_y" | "hero_rotate_seconds" | "hero_text_color" | "hero_title" | "monogram" | "music_autoplay" | "music_enabled" | "music_title" | "music_url" | "party_address" | "party_image_url" | "party_map_url" | "party_time" | "party_venue" | "rsvp_deadline" | "story_how_we_met" | "story_proposal" | "story_text" | "tagline" | "theme_accent" | "theme_background" | "theme_font_body" | "theme_font_display" | "theme_primary" | "theme_template" | "tips" | "updated_at" | "venue" | "wedding_date" | "welcome_message";
export type PublicWeddingRow = { [K in PublicField]: WeddingRow[K] | null };
export type PublicWeddingDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Views"> & {
    Views: Database["public"]["Views"] & {
      wedding_public: { Row: PublicWeddingRow; Relationships: [] };
    };
  };
};
// Reuse the existing session and RLS; this adds only the missing view type.
export const publicWeddingClient = supabase as unknown as SupabaseClient<PublicWeddingDatabase>;
export function validPublicWedding(row: PublicWeddingRow | null) {
  if (!row?.id || !row.slug || !row.bride_name || !row.groom_name) return null;
  return { ...row, id: row.id, slug: row.slug, bride_name: row.bride_name, groom_name: row.groom_name };
}
