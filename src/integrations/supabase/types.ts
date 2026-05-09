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
      brokers: {
        Row: {
          active: boolean
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          commission_pct: number | null
          cpf: string | null
          created_at: string
          creci: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          commission_pct?: number | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          commission_pct?: number | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          interest_type: Database["public"]["Enums"]["interest_type"] | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          interest_type?: Database["public"]["Enums"]["interest_type"] | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          interest_type?: Database["public"]["Enums"]["interest_type"] | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          body_rendered: string
          broker_id: string | null
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          notes: string | null
          partner_id: string | null
          payload_snapshot: Json
          property_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          template_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body_rendered?: string
          broker_id?: string | null
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          notes?: string | null
          partner_id?: string | null
          payload_snapshot?: Json
          property_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body_rendered?: string
          broker_id?: string | null
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          notes?: string | null
          partner_id?: string | null
          payload_snapshot?: Json
          property_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          creci: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          accepts_trade: boolean | null
          address: string | null
          area_m2: number | null
          bathrooms: number | null
          bedrooms: number | null
          broker_id: string | null
          city: string | null
          client_id: string | null
          code: string
          commission_pct: number | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          exclusive: boolean | null
          financed: boolean | null
          furnished: boolean | null
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          parking_spaces: number | null
          planned_furniture: boolean | null
          price: number | null
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string | null
          tour_url: string | null
          trade_notes: string | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          video_url: string | null
          wp_post_id: number | null
          wp_synced_at: string | null
        }
        Insert: {
          accepts_trade?: boolean | null
          address?: string | null
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          city?: string | null
          client_id?: string | null
          code?: string
          commission_pct?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          exclusive?: boolean | null
          financed?: boolean | null
          furnished?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          parking_spaces?: number | null
          planned_furniture?: boolean | null
          price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          tour_url?: string | null
          trade_notes?: string | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          video_url?: string | null
          wp_post_id?: number | null
          wp_synced_at?: string | null
        }
        Update: {
          accepts_trade?: boolean | null
          address?: string | null
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          city?: string | null
          client_id?: string | null
          code?: string
          commission_pct?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          exclusive?: boolean | null
          financed?: boolean | null
          furnished?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          parking_spaces?: number | null
          planned_furniture?: boolean | null
          price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          tour_url?: string | null
          trade_notes?: string | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          video_url?: string | null
          wp_post_id?: number | null
          wp_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_cover: boolean
          property_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_cover?: boolean
          property_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_cover?: boolean
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_contracts: {
        Row: {
          broker_id: string | null
          code: string
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          due_day: number
          end_date: string | null
          id: string
          kind: Database["public"]["Enums"]["rental_kind"]
          landlord_client_id: string | null
          monthly_rent: number
          notes: string | null
          property_id: string
          readjustment_index: string | null
          readjustment_month: number | null
          start_date: string
          status: Database["public"]["Enums"]["rental_status"]
          tenant_client_id: string | null
          updated_at: string
        }
        Insert: {
          broker_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          due_day?: number
          end_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["rental_kind"]
          landlord_client_id?: string | null
          monthly_rent: number
          notes?: string | null
          property_id: string
          readjustment_index?: string | null
          readjustment_month?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"]
          tenant_client_id?: string | null
          updated_at?: string
        }
        Update: {
          broker_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          due_day?: number
          end_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["rental_kind"]
          landlord_client_id?: string | null
          monthly_rent?: number
          notes?: string | null
          property_id?: string
          readjustment_index?: string | null
          readjustment_month?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          tenant_client_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_contracts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_landlord_client_id_fkey"
            columns: ["landlord_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_tenant_client_id_fkey"
            columns: ["tenant_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_payments: {
        Row: {
          amount_due: number
          amount_paid: number | null
          contract_id: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          reference_month: string
          status: Database["public"]["Enums"]["rental_payment_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["rental_payment_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["rental_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
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
          role: Database["public"]["Enums"]["app_role"]
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
      wp_sync_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          property_id: string | null
          status_code: number | null
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          property_id?: string | null
          status_code?: number | null
          success: boolean
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          property_id?: string | null
          status_code?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wp_sync_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_rental_payments: {
        Args: { _contract_id: string; _months?: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_late_rental_payments: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "manager" | "broker"
      document_kind:
        | "visit_form"
        | "sale_contract"
        | "sale_authorization"
        | "sale_authorization_exclusive"
        | "brokerage_authorization"
        | "rental_residential"
        | "rental_commercial"
        | "custom"
      document_status: "draft" | "signed" | "cancelled"
      interest_type: "buy" | "sell" | "rent" | "buy_rent"
      property_status:
        | "available"
        | "sold"
        | "reserved"
        | "negotiation"
        | "rented"
      property_type: "house" | "apartment" | "land" | "lot" | "commercial"
      rental_kind: "residential" | "commercial"
      rental_payment_status: "pending" | "paid" | "late" | "partial" | "waived"
      rental_status: "active" | "ended" | "cancelled" | "suspended"
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
      app_role: ["admin", "manager", "broker"],
      document_kind: [
        "visit_form",
        "sale_contract",
        "sale_authorization",
        "sale_authorization_exclusive",
        "brokerage_authorization",
        "rental_residential",
        "rental_commercial",
        "custom",
      ],
      document_status: ["draft", "signed", "cancelled"],
      interest_type: ["buy", "sell", "rent", "buy_rent"],
      property_status: [
        "available",
        "sold",
        "reserved",
        "negotiation",
        "rented",
      ],
      property_type: ["house", "apartment", "land", "lot", "commercial"],
      rental_kind: ["residential", "commercial"],
      rental_payment_status: ["pending", "paid", "late", "partial", "waived"],
      rental_status: ["active", "ended", "cancelled", "suspended"],
    },
  },
} as const
