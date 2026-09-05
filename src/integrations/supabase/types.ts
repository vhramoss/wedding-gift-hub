export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      gifts: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_cents: number
          purchased_count: number
          quantity: number
          updated_at: string
          wedding_id: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_cents: number
          purchased_count?: number
          quantity?: number
          updated_at?: string
          wedding_id: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          purchased_count?: number
          quantity?: number
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gifts_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          created_at: string
          fee_cents: number
          gift_id: string
          guest_cpf: string | null
          guest_name: string
          id: string
          installments: number
          message: string | null
          paid_at: string | null
          payment_method: string
          status: string
          total_cents: number
          updated_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          fee_cents?: number
          gift_id: string
          guest_cpf?: string | null
          guest_name?: string
          id?: string
          installments?: number
          message?: string | null
          paid_at?: string | null
          payment_method: string
          status?: string
          total_cents: number
          updated_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          fee_cents?: number
          gift_id?: string
          guest_cpf?: string | null
          guest_name?: string
          id?: string
          installments?: number
          message?: string | null
          paid_at?: string | null
          payment_method?: string
          status?: string
          total_cents?: number
          updated_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          attending: boolean
          companions: number
          created_at: string
          guest_name: string
          id: string
          message: string | null
          updated_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          attending: boolean
          companions?: number
          created_at?: string
          guest_name?: string
          id?: string
          message?: string | null
          updated_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          attending?: boolean
          companions?: number
          created_at?: string
          guest_name?: string
          id?: string
          message?: string | null
          updated_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          active: boolean
          category: string
          city: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          category?: string
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      wedding_announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_announcements_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_expenses: {
        Row: {
          amount_cents: number
          category: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          paid_cents: number
          pay_from_gifts: boolean
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          wedding_id: string
        }
        Insert: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_cents?: number
          pay_from_gifts?: boolean
          status?: string
          title: string
          updated_at?: string
          vendor_id?: string | null
          wedding_id: string
        }
        Update: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_cents?: number
          pay_from_gifts?: boolean
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_expenses_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_invites: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
          used_at: string | null
          used_by: string | null
          wedding_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          wedding_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_invites_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_messages: {
        Row: {
          approved: boolean
          author_name: string
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          approved?: boolean
          author_name?: string
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          approved?: boolean
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_messages_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_people: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
          photo_url: string | null
          role: string | null
          sort_order: number
          updated_at: string
          website_url: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name: string
          photo_url?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_people_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          updated_at: string
          url: string
          wedding_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
          url: string
          wedding_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
          url?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_photos_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          bride_name: string
          ceremony_address: string | null
          ceremony_map_url: string | null
          ceremony_time: string | null
          ceremony_venue: string | null
          commission_percent: number
          cover_image_url: string | null
          created_at: string
          dress_code: string | null
          groom_name: string
          hashtag: string | null
          id: string
          owner_id: string | null
          party_address: string | null
          party_image_url: string | null
          party_map_url: string | null
          party_time: string | null
          party_venue: string | null
          pix_holder: string | null
          pix_key: string | null
          published: boolean
          rsvp_deadline: string | null
          slug: string
          story_how_we_met: string | null
          story_proposal: string | null
          story_text: string | null
          tagline: string | null
          theme_accent: string | null
          theme_background: string | null
          theme_font_body: string | null
          theme_font_display: string | null
          theme_primary: string | null
          theme_template: string
          tips: string | null
          updated_at: string
          venue: string | null
          wedding_date: string | null
          welcome_message: string | null
        }
        Insert: {
          bride_name: string
          ceremony_address?: string | null
          ceremony_map_url?: string | null
          ceremony_time?: string | null
          ceremony_venue?: string | null
          commission_percent?: number
          cover_image_url?: string | null
          created_at?: string
          dress_code?: string | null
          groom_name: string
          hashtag?: string | null
          id?: string
          owner_id?: string | null
          party_address?: string | null
          party_image_url?: string | null
          party_map_url?: string | null
          party_time?: string | null
          party_venue?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          published?: boolean
          rsvp_deadline?: string | null
          slug: string
          story_how_we_met?: string | null
          story_proposal?: string | null
          story_text?: string | null
          tagline?: string | null
          theme_accent?: string | null
          theme_background?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_primary?: string | null
          theme_template?: string
          tips?: string | null
          updated_at?: string
          venue?: string | null
          wedding_date?: string | null
          welcome_message?: string | null
        }
        Update: {
          bride_name?: string
          ceremony_address?: string | null
          ceremony_map_url?: string | null
          ceremony_time?: string | null
          ceremony_venue?: string | null
          commission_percent?: number
          cover_image_url?: string | null
          created_at?: string
          dress_code?: string | null
          groom_name?: string
          hashtag?: string | null
          id?: string
          owner_id?: string | null
          party_address?: string | null
          party_image_url?: string | null
          party_map_url?: string | null
          party_time?: string | null
          party_venue?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          published?: boolean
          rsvp_deadline?: string | null
          slug?: string
          story_how_we_met?: string | null
          story_proposal?: string | null
          story_text?: string | null
          tagline?: string | null
          theme_accent?: string | null
          theme_background?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_primary?: string | null
          theme_template?: string
          tips?: string | null
          updated_at?: string
          venue?: string | null
          wedding_date?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_wedding: { Args: { _wedding_id: string }; Returns: boolean }
      redeem_invite: {
        Args: { _token: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      rsvp_open: { Args: { _wedding_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "guest" | "owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "guest", "owner"],
    },
  },
} as const
