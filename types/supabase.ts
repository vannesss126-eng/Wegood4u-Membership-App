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
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      badges: {
        Row: {
          category: Database["public"]["Enums"]["badge_category"]
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          receipt_url: string | null
          required_count: number
          selfie_url: string
        }
        Insert: {
          category: Database["public"]["Enums"]["badge_category"]
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          receipt_url?: string | null
          required_count: number
          selfie_url: string
        }
        Update: {
          category?: Database["public"]["Enums"]["badge_category"]
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          receipt_url?: string | null
          required_count?: number
          selfie_url?: string
        }
        Relationships: []
      }
      credits_ledger: {
        Row: {
          category: Database["public"]["Enums"]["store_category"]
          created_at: string
          cycle_id: string
          delta_numerator: number
          id: number
          reason: string
          source_referral_id: string | null
          source_submission_id: number | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["store_category"]
          created_at?: string
          cycle_id: string
          delta_numerator?: number
          id?: number
          reason: string
          source_referral_id?: string | null
          source_submission_id?: number | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["store_category"]
          created_at?: string
          cycle_id?: string
          delta_numerator?: number
          id?: number
          reason?: string
          source_referral_id?: string | null
          source_submission_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_ledger_source_referral_id_fkey"
            columns: ["source_referral_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_source_referral_id_fkey"
            columns: ["source_referral_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "pending_submissions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_codes: {
        Row: {
          code: string
          created_at: string | null
          is_active: boolean | null
          updated_at: string | null
          usage_count: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          usage_count?: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          data: Json | null
          id: number
          is_read: boolean | null
          object_id: string | null
          object_type: string
          recipient_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: never
          is_read?: boolean | null
          object_id?: string | null
          object_type: string
          recipient_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: never
          is_read?: boolean | null
          object_id?: string | null
          object_type?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_actor_profiles"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_notifications_actor_profiles"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_notifications_recipient_profiles"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_notifications_recipient_profiles"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: number
          image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: never
          image_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: never
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accommodation_preference: string | null
          affiliate_request_status: string | null
          avatar_url: string | null
          communication_contact_details: string | null
          country_of_residence: string | null
          created_at: string | null
          dob: string | null
          first_approved_submission_at: string | null
          full_name: string | null
          gender: string | null
          id: string
          inviter_id: string | null
          preferred_communication_channel:
            | Database["public"]["Enums"]["communication_channel"]
            | null
          role: Database["public"]["Enums"]["user_role"]
          travel_budget: string | null
          travel_destination_category: string | null
          travel_destination_detail: string | null
          travel_preference: string | null
          updated_at: string | null
          username: string | null
          verification_completed: boolean | null
        }
        Insert: {
          accommodation_preference?: string | null
          affiliate_request_status?: string | null
          avatar_url?: string | null
          communication_contact_details?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          dob?: string | null
          first_approved_submission_at?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          inviter_id?: string | null
          preferred_communication_channel?:
            | Database["public"]["Enums"]["communication_channel"]
            | null
          role?: Database["public"]["Enums"]["user_role"]
          travel_budget?: string | null
          travel_destination_category?: string | null
          travel_destination_detail?: string | null
          travel_preference?: string | null
          updated_at?: string | null
          username?: string | null
          verification_completed?: boolean | null
        }
        Update: {
          accommodation_preference?: string | null
          affiliate_request_status?: string | null
          avatar_url?: string | null
          communication_contact_details?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          dob?: string | null
          first_approved_submission_at?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          inviter_id?: string | null
          preferred_communication_channel?:
            | Database["public"]["Enums"]["communication_channel"]
            | null
          role?: Database["public"]["Enums"]["user_role"]
          travel_budget?: string | null
          travel_destination_category?: string | null
          travel_destination_detail?: string | null
          travel_preference?: string | null
          updated_at?: string | null
          username?: string | null
          verification_completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          expo_push_token: string
          id: number
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          expo_push_token: string
          id?: never
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          expo_push_token?: string
          id?: never
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_push_tokens_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_push_tokens_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_half_credit_accumulator: {
        Row: {
          count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_half_credit_accumulator_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_half_credit_accumulator_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          currency: string | null
          id: number
          merchant_name: string | null
          partner_store_category: Database["public"]["Enums"]["store_category"]
          partner_store_name: string
          receipt_date: string | null
          receipt_hash: string | null
          receipt_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string
          status: Database["public"]["Enums"]["submission_status"]
          total_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          currency?: string | null
          id?: number
          merchant_name?: string | null
          partner_store_category: Database["public"]["Enums"]["store_category"]
          partner_store_name: string
          receipt_date?: string | null
          receipt_hash?: string | null
          receipt_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url: string
          status?: Database["public"]["Enums"]["submission_status"]
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          currency?: string | null
          id?: number
          merchant_name?: string | null
          partner_store_category?: Database["public"]["Enums"]["store_category"]
          partner_store_name?: string
          receipt_date?: string | null
          receipt_hash?: string | null
          receipt_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string
          status?: Database["public"]["Enums"]["submission_status"]
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: number
          earned_at: string | null
          user_id: string
        }
        Insert: {
          badge_id: number
          earned_at?: string | null
          user_id: string
        }
        Update: {
          badge_id?: number
          earned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          created_at: string
          earned_from_cycle_id: string
          id: string
          redeemed_at: string | null
          reward_kind: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          earned_from_cycle_id: string
          id?: string
          redeemed_at?: string | null
          reward_kind: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          earned_from_cycle_id?: string
          id?: string
          redeemed_at?: string | null
          reward_kind?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pending_submissions_view: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          currency: string | null
          id: number | null
          merchant_name: string | null
          partner_store_category:
            | Database["public"]["Enums"]["store_category"]
            | null
          partner_store_name: string | null
          receipt_date: string | null
          receipt_url: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          currency?: string | null
          id?: number | null
          merchant_name?: string | null
          partner_store_category?:
            | Database["public"]["Enums"]["store_category"]
            | null
          partner_store_name?: string | null
          receipt_date?: string | null
          receipt_url?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          currency?: string | null
          id?: number | null
          merchant_name?: string | null
          partner_store_category?:
            | Database["public"]["Enums"]["store_category"]
            | null
          partner_store_name?: string | null
          receipt_date?: string | null
          receipt_url?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_tree: {
        Row: {
          affiliate_id: string | null
          created_at: string | null
          first_approved_submission_at: string | null
          full_name: string | null
          inviter_id: string | null
          level: number | null
          referral_state: string | null
          user_id: string | null
          username: string | null
          verification_completed: boolean | null
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          approved_submissions: number | null
          badge_count: number | null
          created_at: string | null
          direct_referrals: number | null
          full_name: string | null
          id: string | null
          pending_submissions: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          total_submissions: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _credits_active_cycle_id: {
        Args: {
          p_category: Database["public"]["Enums"]["store_category"]
          p_user_id: string
        }
        Returns: string
      }
      _credits_apply_delta: {
        Args: {
          p_category: Database["public"]["Enums"]["store_category"]
          p_reason: string
          p_referral_id: string
          p_submission_id: number
          p_user_id: string
        }
        Returns: boolean
      }
      _credits_award_tier_badge: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      _credits_completed_task_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      _credits_pick_referral_target: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["store_category"]
      }
      _credits_reward_kind_for_tier: {
        Args: { p_tier: string }
        Returns: string
      }
      _credits_tier_for_task_count: {
        Args: { p_tasks: number }
        Returns: string
      }
      _to_base62: { Args: { input: string }; Returns: string }
      delete_user_data: { Args: { p_user_id: string }; Returns: undefined }
      get_user_activity: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          event_at: string
          event_type: string
          metadata: Json
          target: string
          total_count: number
        }[]
      }
      is_admin: { Args: { p_uid: string }; Returns: boolean }
      update_submission_review: {
        Args: {
          p_admin_notes?: string
          p_reviewed_by?: string
          p_status: string
          p_submission_id: number
        }
        Returns: undefined
      }
      user_daily_submission_count: { Args: { uid: string }; Returns: number }
    }
    Enums: {
      badge_category: "activity" | "cafe" | "restaurant" | "bar" | "hotel"
      communication_channel: "WhatsApp" | "Telegram" | "Line" | "WeChat"
      store_category: "cafe" | "restaurant" | "others" | "bar" | "hotel"
      submission_status: "pending" | "approved" | "rejected"
      user_role: "subscriber" | "member" | "affiliate" | "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      badge_category: ["activity", "cafe", "restaurant", "bar", "hotel"],
      communication_channel: ["WhatsApp", "Telegram", "Line", "WeChat"],
      store_category: ["cafe", "restaurant", "others", "bar", "hotel"],
      submission_status: ["pending", "approved", "rejected"],
      user_role: ["subscriber", "member", "affiliate", "admin"],
    },
  },
} as const
