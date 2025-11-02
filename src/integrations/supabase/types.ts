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
      ai_analysis: {
        Row: {
          analyzed_at: string | null
          attack_vectors: string[] | null
          campaign_indicators: Json | null
          coordination_indicators: string[] | null
          counter_narrative_points: string[] | null
          created_at: string | null
          evidence_type: string[] | null
          id: string
          is_psyop: string | null
          narrative_theme: string | null
          post_id: string
          primary_target: string | null
          psyop_type: string | null
          recommended_response: string | null
          response_channels: string[] | null
          secondary_targets: string[] | null
          source_credibility: string | null
          suggested_spokespeople: string[] | null
          target_category: string | null
          targeted_persons: string[] | null
          urgency_level: string | null
          virality_potential: number | null
        }
        Insert: {
          analyzed_at?: string | null
          attack_vectors?: string[] | null
          campaign_indicators?: Json | null
          coordination_indicators?: string[] | null
          counter_narrative_points?: string[] | null
          created_at?: string | null
          evidence_type?: string[] | null
          id?: string
          is_psyop?: string | null
          narrative_theme?: string | null
          post_id: string
          primary_target?: string | null
          psyop_type?: string | null
          recommended_response?: string | null
          response_channels?: string[] | null
          secondary_targets?: string[] | null
          source_credibility?: string | null
          suggested_spokespeople?: string[] | null
          target_category?: string | null
          targeted_persons?: string[] | null
          urgency_level?: string | null
          virality_potential?: number | null
        }
        Update: {
          analyzed_at?: string | null
          attack_vectors?: string[] | null
          campaign_indicators?: Json | null
          coordination_indicators?: string[] | null
          counter_narrative_points?: string[] | null
          created_at?: string | null
          evidence_type?: string[] | null
          id?: string
          is_psyop?: string | null
          narrative_theme?: string | null
          post_id?: string
          primary_target?: string | null
          psyop_type?: string | null
          recommended_response?: string | null
          response_channels?: string[] | null
          secondary_targets?: string[] | null
          source_credibility?: string | null
          suggested_spokespeople?: string[] | null
          target_category?: string | null
          targeted_persons?: string[] | null
          urgency_level?: string | null
          virality_potential?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          created_at: string
          id: string
          notes: string | null
          post_id: string
          resolved_at: string | null
          severity: string
          status: string
          triggered_reason: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          post_id: string
          resolved_at?: string | null
          severity: string
          status?: string
          triggered_reason: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          post_id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          triggered_reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          cost_usd: number
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number
          model_used: string
          output_tokens: number
          post_id: string | null
          response_time_ms: number
          status: string
          total_tokens: number
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number
          model_used?: string
          output_tokens?: number
          post_id?: string | null
          response_time_ms?: number
          status?: string
          total_tokens?: number
        }
        Update: {
          cost_usd?: number
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number
          model_used?: string
          output_tokens?: number
          post_id?: string | null
          response_time_ms?: number
          status?: string
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_posts: {
        Row: {
          added_at: string | null
          campaign_id: string
          post_id: string
        }
        Insert: {
          added_at?: string | null
          campaign_id: string
          post_id: string
        }
        Update: {
          added_at?: string | null
          campaign_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "psyop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          id: string
          metadata: Json | null
          model: string | null
          role: string
          timestamp: string | null
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          id?: string
          metadata?: Json | null
          model?: string | null
          role: string
          timestamp?: string | null
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          role?: string
          timestamp?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          analysis_model: string | null
          analysis_stage: string | null
          analysis_summary: string | null
          analyzed_at: string | null
          article_url: string | null
          attack_vectors: string[] | null
          author: string | null
          confidence: number | null
          contents: string | null
          counter_narrative_ready: boolean | null
          created_at: string
          id: string
          is_psyop: boolean | null
          key_points: string[] | null
          keywords: string[] | null
          language: string
          main_topic: string | null
          narrative_theme: string | null
          processing_time: number | null
          psyop_confidence: number | null
          psyop_technique: string[] | null
          psyop_type: string | null
          published_at: string
          recommended_action: string | null
          sentiment: string | null
          sentiment_score: number | null
          source: string
          source_country: string | null
          source_type: string | null
          source_url: string | null
          status: string
          target_entity: string[] | null
          target_persons: string[] | null
          threat_level: string | null
          title: string
          updated_at: string
        }
        Insert: {
          analysis_model?: string | null
          analysis_stage?: string | null
          analysis_summary?: string | null
          analyzed_at?: string | null
          article_url?: string | null
          attack_vectors?: string[] | null
          author?: string | null
          confidence?: number | null
          contents?: string | null
          counter_narrative_ready?: boolean | null
          created_at?: string
          id?: string
          is_psyop?: boolean | null
          key_points?: string[] | null
          keywords?: string[] | null
          language?: string
          main_topic?: string | null
          narrative_theme?: string | null
          processing_time?: number | null
          psyop_confidence?: number | null
          psyop_technique?: string[] | null
          psyop_type?: string | null
          published_at?: string
          recommended_action?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          source: string
          source_country?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          target_entity?: string[] | null
          target_persons?: string[] | null
          threat_level?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          analysis_model?: string | null
          analysis_stage?: string | null
          analysis_summary?: string | null
          analyzed_at?: string | null
          article_url?: string | null
          attack_vectors?: string[] | null
          author?: string | null
          confidence?: number | null
          contents?: string | null
          counter_narrative_ready?: boolean | null
          created_at?: string
          id?: string
          is_psyop?: boolean | null
          key_points?: string[] | null
          keywords?: string[] | null
          language?: string
          main_topic?: string | null
          narrative_theme?: string | null
          processing_time?: number | null
          psyop_confidence?: number | null
          psyop_technique?: string[] | null
          psyop_type?: string | null
          published_at?: string
          recommended_action?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          source?: string
          source_country?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          target_entity?: string[] | null
          target_persons?: string[] | null
          threat_level?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      psyop_campaigns: {
        Row: {
          campaign_name: string
          campaign_type: string | null
          counter_campaign_status: string | null
          created_at: string | null
          end_date: string | null
          id: string
          impact_assessment: number | null
          main_target: string | null
          notes: string | null
          orchestrator: string | null
          start_date: string | null
          status: string | null
          target_persons: string[] | null
        }
        Insert: {
          campaign_name: string
          campaign_type?: string | null
          counter_campaign_status?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          impact_assessment?: number | null
          main_target?: string | null
          notes?: string | null
          orchestrator?: string | null
          start_date?: string | null
          status?: string | null
          target_persons?: string[] | null
        }
        Update: {
          campaign_name?: string
          campaign_type?: string | null
          counter_campaign_status?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          impact_assessment?: number | null
          main_target?: string | null
          notes?: string | null
          orchestrator?: string | null
          start_date?: string | null
          status?: string | null
          target_persons?: string[] | null
        }
        Relationships: []
      }
      resistance_entities: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          entity_type: string
          id: string
          location: string | null
          name_arabic: string | null
          name_english: string | null
          name_persian: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          entity_type: string
          id?: string
          location?: string | null
          name_arabic?: string | null
          name_english?: string | null
          name_persian: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          location?: string | null
          name_arabic?: string | null
          name_english?: string | null
          name_persian?: string
        }
        Relationships: []
      }
      resistance_persons: {
        Row: {
          active: boolean | null
          created_at: string | null
          entity_id: string | null
          id: string
          name_arabic: string | null
          name_english: string | null
          name_persian: string
          role: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          name_arabic?: string | null
          name_english?: string | null
          name_persian: string
          role?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          name_arabic?: string | null
          name_english?: string | null
          name_persian?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resistance_persons_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "resistance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
