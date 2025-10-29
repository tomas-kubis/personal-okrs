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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          email: string | null
          preferences: Json
          timezone: string
          updated_at: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          email?: string | null
          preferences: Json
          timezone: string
          updated_at?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          email?: string | null
          preferences?: Json
          timezone?: string
          updated_at?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      check_in_progress_updates: {
        Row: {
          check_in_id: string
          id: string
          key_result_id: string
          notes: string | null
          user_id: string
          value: number
        }
        Insert: {
          check_in_id: string
          id?: string
          key_result_id: string
          notes?: string | null
          user_id: string
          value: number
        }
        Update: {
          check_in_id?: string
          id?: string
          key_result_id?: string
          notes?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "check_in_progress_updates_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "weekly_check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_progress_updates_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_progress_updates_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results_with_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          completed_at: string | null
          id: string
          messages: Json
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          messages?: Json
          started_at: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          messages?: Json
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      key_results: {
        Row: {
          created_at: string
          description: string
          id: string
          objective_id: string
          status: Database["public"]["Enums"]["key_result_status"]
          status_override:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason: string | null
          target_mode: Database["public"]["Enums"]["target_mode"]
          target_value: number
          unit: string
          updated_at: string | null
          user_id: string
          weekly_targets: number[] | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          objective_id: string
          status: Database["public"]["Enums"]["key_result_status"]
          status_override?:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason?: string | null
          target_mode?: Database["public"]["Enums"]["target_mode"]
          target_value: number
          unit: string
          updated_at?: string | null
          user_id: string
          weekly_targets?: number[] | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          objective_id?: string
          status?: Database["public"]["Enums"]["key_result_status"]
          status_override?:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason?: string | null
          target_mode?: Database["public"]["Enums"]["target_mode"]
          target_value?: number
          unit?: string
          updated_at?: string | null
          user_id?: string
          weekly_targets?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      kr_weekly_progress: {
        Row: {
          id: string
          key_result_id: string
          recorded_at: string
          status: Database["public"]["Enums"]["key_result_status"] | null
          user_id: string
          value: number
          week_start_date: string
        }
        Insert: {
          id?: string
          key_result_id: string
          recorded_at?: string
          status?: Database["public"]["Enums"]["key_result_status"] | null
          user_id: string
          value: number
          week_start_date: string
        }
        Update: {
          id?: string
          key_result_id?: string
          recorded_at?: string
          status?: Database["public"]["Enums"]["key_result_status"] | null
          user_id?: string
          value?: number
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "kr_weekly_progress_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kr_weekly_progress_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results_with_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          period: string
          period_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          period: string
          period_id: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          period?: string
          period_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      weekly_check_ins: {
        Row: {
          coaching_session_id: string | null
          completed_at: string
          created_at: string
          id: string
          period_id: string
          reflection: Json
          user_id: string
          week_start_date: string
        }
        Insert: {
          coaching_session_id?: string | null
          completed_at: string
          created_at?: string
          id?: string
          period_id: string
          reflection: Json
          user_id: string
          week_start_date: string
        }
        Update: {
          coaching_session_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          period_id?: string
          reflection?: Json
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_checkin_coaching_session"
            columns: ["coaching_session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_check_ins_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      key_results_with_progress: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          objective_id: string | null
          status: Database["public"]["Enums"]["key_result_status"] | null
          status_override:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason: string | null
          target_mode: Database["public"]["Enums"]["target_mode"] | null
          target_value: number | null
          unit: string | null
          updated_at: string | null
          user_id: string | null
          weekly_progress: Json | null
          weekly_targets: number[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          objective_id?: string | null
          status?: Database["public"]["Enums"]["key_result_status"] | null
          status_override?:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason?: string | null
          target_mode?: Database["public"]["Enums"]["target_mode"] | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_progress?: never
          weekly_targets?: number[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          objective_id?: string | null
          status?: Database["public"]["Enums"]["key_result_status"] | null
          status_override?:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason?: string | null
          target_mode?: Database["public"]["Enums"]["target_mode"] | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
          weekly_progress?: never
          weekly_targets?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      upsert_key_result_secure: {
        Args: {
          p_description: string
          p_id: string
          p_objective_id: string
          p_status: Database["public"]["Enums"]["key_result_status"]
          p_status_override: Database["public"]["Enums"]["key_result_status"]
          p_status_override_reason: string
          p_target_mode: Database["public"]["Enums"]["target_mode"]
          p_target_value: number
          p_unit: string
          p_weekly_targets: number[]
        }
        Returns: {
          created_at: string
          description: string
          id: string
          objective_id: string
          status: Database["public"]["Enums"]["key_result_status"]
          status_override:
            | Database["public"]["Enums"]["key_result_status"]
            | null
          status_override_reason: string | null
          target_mode: Database["public"]["Enums"]["target_mode"]
          target_value: number
          unit: string
          updated_at: string | null
          user_id: string
          weekly_targets: number[] | null
        }
        SetofOptions: {
          from: "*"
          to: "key_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_objective_secure: {
        Args: {
          p_description: string
          p_id: string
          p_period: string
          p_period_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          period: string
          period_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "objectives"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      coaching_role: "user" | "assistant"
      coaching_style: "supportive" | "challenging" | "balanced"
      dark_mode: "light" | "dark" | "system"
      key_result_status: "on-track" | "needs-attention" | "behind"
      target_mode: "linear" | "manual"
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
  public: {
    Enums: {
      coaching_role: ["user", "assistant"],
      coaching_style: ["supportive", "challenging", "balanced"],
      dark_mode: ["light", "dark", "system"],
      key_result_status: ["on-track", "needs-attention", "behind"],
      target_mode: ["linear", "manual"],
    },
  },
} as const
