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
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value?: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
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
          shares_total: number
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
          shares_total?: number
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
          shares_total?: number
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
          application_fee_cents: number
          cart_id: string | null
          commission_cents: number
          created_at: string
          fee_cents: number
          gift_id: string
          guest_cpf: string | null
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          installments: number
          message: string | null
          mp_payment_id: number | null
          paid_at: string | null
          payment_method: string
          pix_payload: string | null
          pix_qr_base64: string | null
          provider: string
          seller_mp_user_id: number | null
          shares: number
          status: string
          total_cents: number
          updated_at: string
          user_id: string | null
          wedding_id: string
        }
        Insert: {
          amount_cents: number
          application_fee_cents?: number
          cart_id?: string | null
          commission_cents?: number
          created_at?: string
          fee_cents?: number
          gift_id: string
          guest_cpf?: string | null
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          installments?: number
          message?: string | null
          mp_payment_id?: number | null
          paid_at?: string | null
          payment_method: string
          pix_payload?: string | null
          pix_qr_base64?: string | null
          provider?: string
          seller_mp_user_id?: number | null
          shares?: number
          status?: string
          total_cents: number
          updated_at?: string
          user_id?: string | null
          wedding_id: string
        }
        Update: {
          amount_cents?: number
          application_fee_cents?: number
          cart_id?: string | null
          commission_cents?: number
          created_at?: string
          fee_cents?: number
          gift_id?: string
          guest_cpf?: string | null
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          installments?: number
          message?: string | null
          mp_payment_id?: number | null
          paid_at?: string | null
          payment_method?: string
          pix_payload?: string | null
          pix_qr_base64?: string | null
          provider?: string
          seller_mp_user_id?: number | null
          shares?: number
          status?: string
          total_cents?: number
          updated_at?: string
          user_id?: string | null
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
          attending_ceremony: boolean
          attending_party: boolean
          companions: number
          created_at: string
          dietary_notes: string | null
          guest_name: string
          id: string
          message: string | null
          updated_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          attending: boolean
          attending_ceremony?: boolean
          attending_party?: boolean
          companions?: number
          created_at?: string
          dietary_notes?: string | null
          guest_name?: string
          id?: string
          message?: string | null
          updated_at?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          attending?: boolean
          attending_ceremony?: boolean
          attending_party?: boolean
          companions?: number
          created_at?: string
          dietary_notes?: string | null
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
          installments: number
          installments_paid: number
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
          installments?: number
          installments_paid?: number
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
          installments?: number
          installments_paid?: number
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
      wedding_fee_tiers: {
        Row: {
          created_at: string
          id: string
          percent: number
          up_to_cents: number | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          percent?: number
          up_to_cents?: number | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          id?: string
          percent?: number
          up_to_cents?: number | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_fee_tiers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_guests: {
        Row: {
          attending: boolean | null
          attending_ceremony: boolean | null
          attending_party: boolean | null
          companions: number
          created_at: string
          dietary_notes: string | null
          email: string | null
          group_label: string | null
          id: string
          max_companions: number
          message: string | null
          name: string
          name_norm: string | null
          phone: string | null
          reminder_sent_at: string | null
          responded_at: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          attending?: boolean | null
          attending_ceremony?: boolean | null
          attending_party?: boolean | null
          companions?: number
          created_at?: string
          dietary_notes?: string | null
          email?: string | null
          group_label?: string | null
          id?: string
          max_companions?: number
          message?: string | null
          name: string
          name_norm?: string | null
          phone?: string | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          attending?: boolean | null
          attending_ceremony?: boolean | null
          attending_party?: boolean | null
          companions?: number
          created_at?: string
          dietary_notes?: string | null
          email?: string | null
          group_label?: string | null
          id?: string
          max_companions?: number
          message?: string | null
          name?: string
          name_norm?: string | null
          phone?: string | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_guests_wedding_id_fkey"
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
          user_id: string | null
          wedding_id: string
        }
        Insert: {
          approved?: boolean
          author_name?: string
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          wedding_id: string
        }
        Update: {
          approved?: boolean
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
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
      wedding_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          wedding_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          wedding_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_notifications_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_owners: {
        Row: {
          created_at: string
          id: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_owners_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_payment_accounts: {
        Row: {
          access_token: string
          connected_by: string | null
          created_at: string
          expires_at: string | null
          live_mode: boolean
          mp_user_id: number | null
          provider: string
          public_key: string | null
          refresh_token: string | null
          updated_at: string
          wedding_id: string
        }
        Insert: {
          access_token: string
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          live_mode?: boolean
          mp_user_id?: number | null
          provider?: string
          public_key?: string | null
          refresh_token?: string | null
          updated_at?: string
          wedding_id: string
        }
        Update: {
          access_token?: string
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          live_mode?: boolean
          mp_user_id?: number | null
          provider?: string
          public_key?: string | null
          refresh_token?: string | null
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_payment_accounts_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_payouts_wedding_id_fkey"
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
          show_in_cover: boolean
          sort_order: number
          updated_at: string
          url: string
          wedding_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          show_in_cover?: boolean
          sort_order?: number
          updated_at?: string
          url: string
          wedding_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          show_in_cover?: boolean
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
      wedding_reminders: {
        Row: {
          audience: string
          body: string
          created_at: string
          id: string
          kind: string
          recipients_count: number
          send_on: string | null
          sent_at: string | null
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          id?: string
          kind?: string
          recipients_count?: number
          send_on?: string | null
          sent_at?: string | null
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          recipients_count?: number
          send_on?: string | null
          sent_at?: string | null
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_reminders_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          bride_name: string
          bride_photo_url: string | null
          ceremony_address: string | null
          ceremony_map_url: string | null
          ceremony_time: string | null
          ceremony_venue: string | null
          commission_paid_by: string
          commission_percent: number
          couple_intro: string | null
          cover_image_url: string | null
          created_at: string
          dress_code: string | null
          groom_name: string
          groom_photo_url: string | null
          hashtag: string | null
          hero_fit: string
          hero_height: string
          hero_opacity: number
          hero_pos_x: number
          hero_pos_y: number
          hero_rotate_seconds: number
          hero_text_color: string | null
          id: string
          messages_auto_approve: boolean
          monogram: string | null
          music_autoplay: boolean
          music_enabled: boolean
          music_title: string | null
          music_url: string | null
          notify_whatsapp: string | null
          owner_id: string | null
          party_address: string | null
          party_image_url: string | null
          party_map_url: string | null
          party_time: string | null
          party_venue: string | null
          pix_holder: string | null
          pix_key: string | null
          plan: string
          plan_billing: string
          plan_fee_cents: number
          plan_notes: string | null
          plan_paid: boolean
          plan_started_on: string | null
          published: boolean
          require_login: boolean
          rsvp_deadline: string | null
          rsvp_reminder_days: number
          rsvp_reminder_enabled: boolean
          rsvp_reminder_template: string | null
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
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          bride_name: string
          bride_photo_url?: string | null
          ceremony_address?: string | null
          ceremony_map_url?: string | null
          ceremony_time?: string | null
          ceremony_venue?: string | null
          commission_paid_by?: string
          commission_percent?: number
          couple_intro?: string | null
          cover_image_url?: string | null
          created_at?: string
          dress_code?: string | null
          groom_name: string
          groom_photo_url?: string | null
          hashtag?: string | null
          hero_fit?: string
          hero_height?: string
          hero_opacity?: number
          hero_pos_x?: number
          hero_pos_y?: number
          hero_rotate_seconds?: number
          hero_text_color?: string | null
          id?: string
          messages_auto_approve?: boolean
          monogram?: string | null
          music_autoplay?: boolean
          music_enabled?: boolean
          music_title?: string | null
          music_url?: string | null
          notify_whatsapp?: string | null
          owner_id?: string | null
          party_address?: string | null
          party_image_url?: string | null
          party_map_url?: string | null
          party_time?: string | null
          party_venue?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          plan?: string
          plan_billing?: string
          plan_fee_cents?: number
          plan_notes?: string | null
          plan_paid?: boolean
          plan_started_on?: string | null
          published?: boolean
          require_login?: boolean
          rsvp_deadline?: string | null
          rsvp_reminder_days?: number
          rsvp_reminder_enabled?: boolean
          rsvp_reminder_template?: string | null
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
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          bride_name?: string
          bride_photo_url?: string | null
          ceremony_address?: string | null
          ceremony_map_url?: string | null
          ceremony_time?: string | null
          ceremony_venue?: string | null
          commission_paid_by?: string
          commission_percent?: number
          couple_intro?: string | null
          cover_image_url?: string | null
          created_at?: string
          dress_code?: string | null
          groom_name?: string
          groom_photo_url?: string | null
          hashtag?: string | null
          hero_fit?: string
          hero_height?: string
          hero_opacity?: number
          hero_pos_x?: number
          hero_pos_y?: number
          hero_rotate_seconds?: number
          hero_text_color?: string | null
          id?: string
          messages_auto_approve?: boolean
          monogram?: string | null
          music_autoplay?: boolean
          music_enabled?: boolean
          music_title?: string | null
          music_url?: string | null
          notify_whatsapp?: string | null
          owner_id?: string | null
          party_address?: string | null
          party_image_url?: string | null
          party_map_url?: string | null
          party_time?: string | null
          party_venue?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          plan?: string
          plan_billing?: string
          plan_fee_cents?: number
          plan_notes?: string | null
          plan_paid?: boolean
          plan_started_on?: string | null
          published?: boolean
          require_login?: boolean
          rsvp_deadline?: string | null
          rsvp_reminder_days?: number
          rsvp_reminder_enabled?: boolean
          rsvp_reminder_template?: string | null
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
      commission_percent_for: {
        Args: { _amount_cents: number; _wedding_id: string }
        Returns: number
      }
      compute_charge: {
        Args: {
          p_amount_cents: number
          p_installments: number
          p_method: string
        }
        Returns: {
          fee_cents: number
          installment_cents: number
          total_cents: number
        }[]
      }
      confirm_order_payment: {
        Args: {
          p_mp_payment_id: number
          p_order_id: string
          p_secret: string
          p_status: string
        }
        Returns: undefined
      }
      create_cart_order: {
        Args: {
          p_guest_cpf?: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_installments: number
          p_items: Json
          p_message: string
          p_method: string
        }
        Returns: {
          cart_id: string
          installments: number
          order_id: string
          total_cents: number
        }[]
      }
      create_coowner_invite: {
        Args: { _email?: string; _note?: string; _wedding_id: string }
        Returns: string
      }
      create_gift_order: {
        Args: {
          p_gift_id: string
          p_installments: number
          p_message: string
          p_method: string
          p_shares?: number
        }
        Returns: {
          installments: number
          order_id: string
          total_cents: number
        }[]
      }
      create_own_wedding: {
        Args: {
          p_bride: string
          p_date?: string
          p_groom: string
          p_slug: string
        }
        Returns: {
          slug: string
          wedding_id: string
        }[]
      }
      create_public_gift_order: {
        Args: {
          p_gift_id: string
          p_guest_cpf?: string
          p_guest_email: string
          p_guest_name: string
          p_guest_phone?: string
          p_installments: number
          p_message: string
          p_method: string
          p_shares: number
        }
        Returns: {
          installments: number
          order_id: string
          total_cents: number
        }[]
      }
      disconnect_wedding_mp: {
        Args: { _wedding_id: string }
        Returns: undefined
      }
      get_wedding_mp_credentials: {
        Args: { p_secret: string; p_wedding_id: string }
        Returns: {
          access_token: string
          expires_at: string
          live_mode: boolean
          mp_user_id: number
          refresh_token: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_wedding_coowner: {
        Args: { _user_id: string; _wedding_id: string }
        Returns: boolean
      }
      norm_txt: { Args: { t: string }; Returns: string }
      order_confirm_secret_is_set: { Args: never; Returns: boolean }
      owns_wedding: { Args: { _wedding_id: string }; Returns: boolean }
      post_public_message: {
        Args: { p_body: string; p_name: string; p_wedding_id: string }
        Returns: undefined
      }
      public_order_status: {
        Args: { p_order_id: string }
        Returns: {
          cart_commission_cents: number
          cart_id: string
          cart_items: number
          cart_total_cents: number
          commission_cents: number
          gift_id: string
          gift_name: string
          id: string
          installments: number
          payment_method: string
          pix_payload: string
          pix_qr_base64: string
          status: string
          total_cents: number
          user_id: string
          wedding_id: string
        }[]
      }
      record_order_split: {
        Args: {
          p_application_fee_cents: number
          p_order_id: string
          p_secret: string
          p_seller_mp_user_id: number
        }
        Returns: undefined
      }
      record_pix_payment: {
        Args: {
          p_mp_payment_id: number
          p_order_id: string
          p_payload: string
          p_qr_base64: string
        }
        Returns: undefined
      }
      record_public_pix_payment: {
        Args: {
          p_mp_payment_id: number
          p_order_id: string
          p_payload: string
          p_qr_base64: string
        }
        Returns: undefined
      }
      redeem_invite: {
        Args: { _token: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      remove_wedding_coowner: {
        Args: { _user_id: string; _wedding_id: string }
        Returns: undefined
      }
      respond_wedding_guest: {
        Args: {
          p_attending: boolean
          p_ceremony?: boolean
          p_companions?: number
          p_dietary?: string
          p_guest_id: string
          p_message?: string
          p_party?: boolean
        }
        Returns: undefined
      }
      rsvp_open: { Args: { _wedding_id: string }; Returns: boolean }
      save_wedding_mp_account: {
        Args: {
          p_access_token: string
          p_connected_by: string
          p_expires_at: string
          p_live_mode: boolean
          p_mp_user_id: number
          p_public_key: string
          p_refresh_token: string
          p_secret: string
          p_wedding_id: string
        }
        Returns: undefined
      }
      search_wedding_guests: {
        Args: { p_query: string; p_wedding_id: string }
        Returns: {
          attending: boolean
          attending_ceremony: boolean
          attending_party: boolean
          companions: number
          dietary_notes: string
          group_label: string
          id: string
          max_companions: number
          name: string
        }[]
      }
      set_order_confirm_secret: {
        Args: { p_secret: string }
        Returns: undefined
      }
      set_wedding_approval: {
        Args: { _note?: string; _status: string; _wedding_id: string }
        Returns: undefined
      }
      set_wedding_plan:
        | {
            Args: {
              _billing: string
              _commission_percent?: number
              _fee_cents: number
              _notes?: string
              _paid: boolean
              _plan: string
              _started_on?: string
              _wedding_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _billing: string
              _commission_paid_by?: string
              _commission_percent?: number
              _fee_cents: number
              _notes?: string
              _paid: boolean
              _plan: string
              _started_on?: string
              _wedding_id: string
            }
            Returns: undefined
          }
      wedding_coowners: {
        Args: { _wedding_id: string }
        Returns: {
          added_at: string
          email: string
          full_name: string
          is_primary: boolean
          user_id: string
        }[]
      }
      wedding_donors: {
        Args: { _wedding_id: string }
        Returns: {
          amount_cents: number
          created_at: string
          gift_name: string
          guest_email: string
          guest_name: string
          guest_phone: string
          installments: number
          message: string
          order_id: string
          paid_at: string
          payment_method: string
          status: string
          total_cents: number
        }[]
      }
      wedding_payment_public_key: {
        Args: { _wedding_id: string }
        Returns: string
      }
      wedding_payment_status: {
        Args: { _wedding_id: string }
        Returns: {
          connected: boolean
          connected_at: string
          live_mode: boolean
          mp_user_id: number
        }[]
      }
      wedding_payout_summary: {
        Args: { _wedding_id: string }
        Returns: {
          commission_cents: number
          gross_cents: number
          net_cents: number
          paid_out_cents: number
          pending_cents: number
        }[]
      }
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
