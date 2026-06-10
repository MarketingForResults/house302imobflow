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
          company_address: string | null
          company_city: string | null
          company_cnpj: string | null
          company_complement: string | null
          company_creci: string | null
          company_email: string | null
          company_legal_name: string | null
          company_neighborhood: string | null
          company_number: string | null
          company_person_type: string
          company_phone: string | null
          company_state: string | null
          company_street: string | null
          company_trade_name: string | null
          company_zip_code: string | null
          contract_default_commission_pct: number | null
          id: boolean
          rental_contract_notes: string | null
          rental_daily_interest_pct: number
          rental_default_contract_type: string
          rental_default_due_day: number
          rental_default_readjustment_index: string | null
          rental_default_readjustment_month: number | null
          rental_default_term_months: number
          rental_grace_days: number
          rental_late_fee_pct: number
          sale_contract_notes: string | null
          sale_deed_type: string
          sale_default_commission_pct: number
          sale_default_down_payment_pct: number
          sale_default_payment_method: string
          sale_itbi_pct: number
          savings_monthly_rate_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_address?: string | null
          company_city?: string | null
          company_cnpj?: string | null
          company_complement?: string | null
          company_creci?: string | null
          company_email?: string | null
          company_legal_name?: string | null
          company_neighborhood?: string | null
          company_number?: string | null
          company_person_type?: string
          company_phone?: string | null
          company_state?: string | null
          company_street?: string | null
          company_trade_name?: string | null
          company_zip_code?: string | null
          contract_default_commission_pct?: number | null
          id?: boolean
          rental_contract_notes?: string | null
          rental_daily_interest_pct?: number
          rental_default_contract_type?: string
          rental_default_due_day?: number
          rental_default_readjustment_index?: string | null
          rental_default_readjustment_month?: number | null
          rental_default_term_months?: number
          rental_grace_days?: number
          rental_late_fee_pct?: number
          sale_contract_notes?: string | null
          sale_deed_type?: string
          sale_default_commission_pct?: number
          sale_default_down_payment_pct?: number
          sale_default_payment_method?: string
          sale_itbi_pct?: number
          savings_monthly_rate_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_address?: string | null
          company_city?: string | null
          company_cnpj?: string | null
          company_complement?: string | null
          company_creci?: string | null
          company_email?: string | null
          company_legal_name?: string | null
          company_neighborhood?: string | null
          company_number?: string | null
          company_person_type?: string
          company_phone?: string | null
          company_state?: string | null
          company_street?: string | null
          company_trade_name?: string | null
          company_zip_code?: string | null
          contract_default_commission_pct?: number | null
          id?: boolean
          rental_contract_notes?: string | null
          rental_daily_interest_pct?: number
          rental_default_contract_type?: string
          rental_default_due_day?: number
          rental_default_readjustment_index?: string | null
          rental_default_readjustment_month?: number | null
          rental_default_term_months?: number
          rental_grace_days?: number
          rental_late_fee_pct?: number
          sale_contract_notes?: string | null
          sale_deed_type?: string
          sale_default_commission_pct?: number
          sale_default_down_payment_pct?: number
          sale_default_payment_method?: string
          sale_itbi_pct?: number
          savings_monthly_rate_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      brokers: {
        Row: {
          active: boolean
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          birth_date: string | null
          city: string | null
          cnh: string | null
          commission_pct: number | null
          complement: string | null
          cpf: string | null
          created_at: string
          creci: string | null
          email: string | null
          father_name: string | null
          full_name: string
          id: string
          marital_status: string | null
          mother_name: string | null
          nationality: string | null
          neighborhood: string | null
          number: string | null
          phone: string | null
          pix_key: string | null
          profession: string | null
          registration_status: string
          rg: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          city?: string | null
          cnh?: string | null
          commission_pct?: number | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          father_name?: string | null
          full_name: string
          id?: string
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          registration_status?: string
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          city?: string | null
          cnh?: string | null
          commission_pct?: number | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          father_name?: string | null
          full_name?: string
          id?: string
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          registration_status?: string
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      capture_partners: {
        Row: {
          active: boolean
          address: string | null
          birth_date: string | null
          city: string | null
          cnh: string | null
          complement: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          marital_status: string | null
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          payment_details: string | null
          payment_preference: string | null
          phone: string | null
          pix_key: string | null
          profession: string | null
          property_address: string | null
          property_city: string | null
          property_complement: string | null
          property_neighborhood: string | null
          property_notes: string | null
          property_number: string | null
          property_owner_email: string | null
          property_owner_name: string | null
          property_owner_phone: string | null
          property_state: string | null
          property_street: string | null
          property_zip_code: string | null
          registration_status: string
          rg: string | null
          state: string | null
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          city?: string | null
          cnh?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          marital_status?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_details?: string | null
          payment_preference?: string | null
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          property_address?: string | null
          property_city?: string | null
          property_complement?: string | null
          property_neighborhood?: string | null
          property_notes?: string | null
          property_number?: string | null
          property_owner_email?: string | null
          property_owner_name?: string | null
          property_owner_phone?: string | null
          property_state?: string | null
          property_street?: string | null
          property_zip_code?: string | null
          registration_status?: string
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          city?: string | null
          cnh?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          marital_status?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_details?: string | null
          payment_preference?: string | null
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          property_address?: string | null
          property_city?: string | null
          property_complement?: string | null
          property_neighborhood?: string | null
          property_notes?: string | null
          property_number?: string | null
          property_owner_email?: string | null
          property_owner_name?: string | null
          property_owner_phone?: string | null
          property_state?: string | null
          property_street?: string | null
          property_zip_code?: string | null
          registration_status?: string
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          birth_date: string | null
          city: string | null
          client_roles: string[] | null
          cnh: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          email: string | null
          father_name: string | null
          full_name: string
          id: string
          interest_type: Database["public"]["Enums"]["interest_type"] | null
          interest_types: string[]
          marital_status: string | null
          mother_name: string | null
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          phone: string | null
          pix_key: string | null
          profession: string | null
          rg: string | null
          state: string | null
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          city?: string | null
          client_roles?: string[] | null
          cnh?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          father_name?: string | null
          full_name: string
          id?: string
          interest_type?: Database["public"]["Enums"]["interest_type"] | null
          interest_types?: string[]
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          city?: string | null
          client_roles?: string[] | null
          cnh?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          father_name?: string | null
          full_name?: string
          id?: string
          interest_type?: Database["public"]["Enums"]["interest_type"] | null
          interest_types?: string[]
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      document_kinds: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          sort_order: number
          system_kind: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          label: string
          sort_order?: number
          system_kind?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          system_kind?: boolean
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
          kind: string
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
          kind: string
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
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          archived_at: string | null
          body_rendered: string
          broker_id: string | null
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          notes: string | null
          partner_id: string | null
          payload_snapshot: Json
          property_id: string | null
          rental_contract_id: string | null
          signed_at: string | null
          signed_file_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          template_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          body_rendered?: string
          broker_id?: string | null
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          notes?: string | null
          partner_id?: string | null
          payload_snapshot?: Json
          property_id?: string | null
          rental_contract_id?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          body_rendered?: string
          broker_id?: string | null
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          notes?: string | null
          partner_id?: string | null
          payload_snapshot?: Json
          property_id?: string | null
          rental_contract_id?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
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
            foreignKeyName: "documents_rental_contract_id_fkey"
            columns: ["rental_contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
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
      economic_indexes: {
        Row: {
          accumulated_12m: number | null
          code: string
          fetched_at: string
          monthly_value: number
          name: string
          reference_month: string
          source_url: string | null
        }
        Insert: {
          accumulated_12m?: number | null
          code: string
          fetched_at?: string
          monthly_value: number
          name: string
          reference_month: string
          source_url?: string | null
        }
        Update: {
          accumulated_12m?: number | null
          code?: string
          fetched_at?: string
          monthly_value?: number
          name?: string
          reference_month?: string
          source_url?: string | null
        }
        Relationships: []
      }
      entity_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_kind: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          id: string
          label: string | null
          mime_type: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_kind?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          id?: string
          label?: string | null
          mime_type?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_kind?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          label?: string | null
          mime_type?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      financial_bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          active: boolean
          agency: string | null
          bank_name: string
          created_at: string
          created_by: string | null
          current_balance: number
          deleted_at: string | null
          deleted_by: string | null
          holder_document: string | null
          holder_name: string | null
          id: string
          initial_balance: number
          integration_payload: Json
          integration_provider: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          bank_name: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          deleted_at?: string | null
          deleted_by?: string | null
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          initial_balance?: number
          integration_payload?: Json
          integration_provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          bank_name?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          deleted_at?: string | null
          deleted_by?: string | null
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          initial_balance?: number
          integration_payload?: Json
          integration_provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      financial_bank_reconciliations: {
        Row: {
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          external_id: string | null
          id: string
          match_status: string
          metadata: Json
          record_id: string | null
          statement_amount: number
          statement_date: string
          statement_description: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_id?: string | null
          id?: string
          match_status?: string
          metadata?: Json
          record_id?: string | null
          statement_amount?: number
          statement_date: string
          statement_description: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          external_id?: string | null
          id?: string
          match_status?: string
          metadata?: Json
          record_id?: string | null
          statement_amount?: number
          statement_date?: string
          statement_description?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_reconciliations_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "financial_records"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          kind: string
          metadata: Json
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          metadata?: Json
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          metadata?: Json
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      financial_cost_centers: {
        Row: {
          active: boolean
          budget_monthly: number
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          metadata: Json
          name: string
          notes: string | null
          responsible: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          budget_monthly?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metadata?: Json
          name: string
          notes?: string | null
          responsible?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          budget_monthly?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          notes?: string | null
          responsible?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      financial_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          file_name: string | null
          file_type: string | null
          id: string
          imported_rows: number
          metadata: Json
          module_key: string
          status: string
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          imported_rows?: number
          metadata?: Json
          module_key: string
          status?: string
          total_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          imported_rows?: number
          metadata?: Json
          module_key?: string
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          bank_account_id: string | null
          broker_id: string | null
          category_id: string | null
          client_id: string | null
          commission_rate: number | null
          competence_month: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          direction: string
          document_number: string | null
          due_date: string | null
          id: string
          integration_payload: Json
          metadata: Json
          module_key: string
          owner_document: string | null
          owner_name: string | null
          payment_date: string | null
          payment_method: string | null
          person_document: string | null
          person_name: string | null
          property_id: string | null
          recurrence_rule: string | null
          rental_contract_id: string | null
          rental_payment_id: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          broker_id?: string | null
          category_id?: string | null
          client_id?: string | null
          commission_rate?: number | null
          competence_month?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          direction?: string
          document_number?: string | null
          due_date?: string | null
          id?: string
          integration_payload?: Json
          metadata?: Json
          module_key: string
          owner_document?: string | null
          owner_name?: string | null
          payment_date?: string | null
          payment_method?: string | null
          person_document?: string | null
          person_name?: string | null
          property_id?: string | null
          recurrence_rule?: string | null
          rental_contract_id?: string | null
          rental_payment_id?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          broker_id?: string | null
          category_id?: string | null
          client_id?: string | null
          commission_rate?: number | null
          competence_month?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          direction?: string
          document_number?: string | null
          due_date?: string | null
          id?: string
          integration_payload?: Json
          metadata?: Json
          module_key?: string
          owner_document?: string | null
          owner_name?: string | null
          payment_date?: string | null
          payment_method?: string | null
          person_document?: string | null
          person_name?: string | null
          property_id?: string | null
          recurrence_rule?: string | null
          rental_contract_id?: string | null
          rental_payment_id?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_rental_contract_id_fkey"
            columns: ["rental_contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_rental_payment_id_fkey"
            columns: ["rental_payment_id"]
            isOneToOne: false
            referencedRelation: "rental_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          boleto_enabled: boolean
          commission_payment_day: number
          config: Json
          created_at: string
          created_by: string | null
          default_daily_interest_percent: number
          default_late_fee_percent: number
          deleted_at: string | null
          deleted_by: string | null
          gateway_enabled: boolean
          gateway_provider: string | null
          id: string
          name: string
          open_finance_enabled: boolean
          owner_transfer_day: number
          pix_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boleto_enabled?: boolean
          commission_payment_day?: number
          config?: Json
          created_at?: string
          created_by?: string | null
          default_daily_interest_percent?: number
          default_late_fee_percent?: number
          deleted_at?: string | null
          deleted_by?: string | null
          gateway_enabled?: boolean
          gateway_provider?: string | null
          id?: string
          name?: string
          open_finance_enabled?: boolean
          owner_transfer_day?: number
          pix_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boleto_enabled?: boolean
          commission_payment_day?: number
          config?: Json
          created_at?: string
          created_by?: string | null
          default_daily_interest_percent?: number
          default_late_fee_percent?: number
          deleted_at?: string | null
          deleted_by?: string | null
          gateway_enabled?: boolean
          gateway_provider?: string | null
          id?: string
          name?: string
          open_finance_enabled?: boolean
          owner_transfer_day?: number
          pix_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inspection_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          inspection_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          inspection_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          inspection_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspection_images_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          area_m2: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          neighborhood: string | null
          notes: string | null
          owner_address: string | null
          owner_cpf: string | null
          owner_email: string | null
          owner_name: string
          owner_phone: string | null
          parking_spaces: number | null
          property_address: string
          property_description: string | null
          property_title: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          rental_max_price: number | null
          rental_min_price: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sale_max_price: number | null
          sale_min_price: number | null
          state: string | null
          status: string
          suites: number | null
          updated_at: string
        }
        Insert: {
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          owner_address?: string | null
          owner_cpf?: string | null
          owner_email?: string | null
          owner_name: string
          owner_phone?: string | null
          parking_spaces?: number | null
          property_address: string
          property_description?: string | null
          property_title?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rental_max_price?: number | null
          rental_min_price?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_max_price?: number | null
          sale_min_price?: number | null
          state?: string | null
          status?: string
          suites?: number | null
          updated_at?: string
        }
        Update: {
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          owner_address?: string | null
          owner_cpf?: string | null
          owner_email?: string | null
          owner_name?: string
          owner_phone?: string | null
          parking_spaces?: number | null
          property_address?: string
          property_description?: string | null
          property_title?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rental_max_price?: number | null
          rental_min_price?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_max_price?: number | null
          sale_min_price?: number | null
          state?: string | null
          status?: string
          suites?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_access_links: {
        Row: {
          broker_id: string | null
          client_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          broker_id?: string | null
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          broker_id?: string | null
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_links_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
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
          email?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean
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
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          accepts_trade: boolean | null
          address: string | null
          admin_review_notes: string | null
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          area_m2: number | null
          bathrooms: number | null
          bedrooms: number | null
          broker_id: string | null
          capture_notes: string | null
          capture_partner_id: string | null
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
          listing_purpose: string
          longitude: number | null
          neighborhood: string | null
          owner_address: string | null
          owner_cpf: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          parking_spaces: number | null
          planned_furniture: boolean | null
          price: number | null
          rental_max_price: number | null
          rental_min_price: number | null
          sale_max_price: number | null
          sale_min_price: number | null
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          suites: number | null
          title: string | null
          tour_url: string | null
          trade_notes: string | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          video_url: string | null
          workflow_status: string
          wp_post_id: number | null
          wp_synced_at: string | null
        }
        Insert: {
          accepts_trade?: boolean | null
          address?: string | null
          admin_review_notes?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          capture_notes?: string | null
          capture_partner_id?: string | null
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
          listing_purpose?: string
          longitude?: number | null
          neighborhood?: string | null
          owner_address?: string | null
          owner_cpf?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          parking_spaces?: number | null
          planned_furniture?: boolean | null
          price?: number | null
          rental_max_price?: number | null
          rental_min_price?: number | null
          sale_max_price?: number | null
          sale_min_price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          tour_url?: string | null
          trade_notes?: string | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          video_url?: string | null
          workflow_status?: string
          wp_post_id?: number | null
          wp_synced_at?: string | null
        }
        Update: {
          accepts_trade?: boolean | null
          address?: string | null
          admin_review_notes?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          capture_notes?: string | null
          capture_partner_id?: string | null
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
          listing_purpose?: string
          longitude?: number | null
          neighborhood?: string | null
          owner_address?: string | null
          owner_cpf?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          parking_spaces?: number | null
          planned_furniture?: boolean | null
          price?: number | null
          rental_max_price?: number | null
          rental_min_price?: number | null
          sale_max_price?: number | null
          sale_min_price?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number | null
          title?: string | null
          tour_url?: string | null
          trade_notes?: string | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          video_url?: string | null
          workflow_status?: string
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
            foreignKeyName: "properties_capture_partner_id_fkey"
            columns: ["capture_partner_id"]
            isOneToOne: false
            referencedRelation: "capture_partners"
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
      property_inspections: {
        Row: {
          assigned_broker_id: string | null
          contact_notes: string | null
          created_at: string
          id: string
          property_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_at: string | null
          status: string
          technical_notes: string | null
          updated_at: string
        }
        Insert: {
          assigned_broker_id?: string | null
          contact_notes?: string | null
          created_at?: string
          id?: string
          property_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          status?: string
          technical_notes?: string | null
          updated_at?: string
        }
        Update: {
          assigned_broker_id?: string | null
          contact_notes?: string | null
          created_at?: string
          id?: string
          property_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          status?: string
          technical_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_inspections_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_contracts: {
        Row: {
          archived_at: string | null
          broker_id: string | null
          code: string
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          deposit_paid_at: string | null
          due_day: number
          end_date: string | null
          homologation_status: string
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
          archived_at?: string | null
          broker_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          due_day?: number
          end_date?: string | null
          homologation_status?: string
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
          archived_at?: string | null
          broker_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          due_day?: number
          end_date?: string | null
          homologation_status?: string
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
          deposit_refund_amount: number | null
          deposit_refund_due_date: string | null
          deposit_refund_notes: string | null
          deposit_refund_receipt_file_name: string | null
          deposit_refund_receipt_file_path: string | null
          deposit_refund_uploaded_at: string | null
          deposit_refunded_at: string | null
          due_date: string
          id: string
          interest_amount: number
          late_fee_amount: number
          notes: string | null
          paid_at: string | null
          payment_kind: string
          receipt_file_name: string | null
          receipt_file_path: string | null
          receipt_uploaded_at: string | null
          reference_month: string
          status: Database["public"]["Enums"]["rental_payment_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          contract_id: string
          created_at?: string
          deposit_refund_amount?: number | null
          deposit_refund_due_date?: string | null
          deposit_refund_notes?: string | null
          deposit_refund_receipt_file_name?: string | null
          deposit_refund_receipt_file_path?: string | null
          deposit_refund_uploaded_at?: string | null
          deposit_refunded_at?: string | null
          due_date: string
          id?: string
          interest_amount?: number
          late_fee_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_kind?: string
          receipt_file_name?: string | null
          receipt_file_path?: string | null
          receipt_uploaded_at?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["rental_payment_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          contract_id?: string
          created_at?: string
          deposit_refund_amount?: number | null
          deposit_refund_due_date?: string | null
          deposit_refund_notes?: string | null
          deposit_refund_receipt_file_name?: string | null
          deposit_refund_receipt_file_path?: string | null
          deposit_refund_uploaded_at?: string | null
          deposit_refunded_at?: string | null
          due_date?: string
          id?: string
          interest_amount?: number
          late_fee_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_kind?: string
          receipt_file_name?: string | null
          receipt_file_path?: string | null
          receipt_uploaded_at?: string | null
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
      is_finance_user: { Args: { _user_id: string }; Returns: boolean }
      is_operational_user: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_late_rental_payments: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "broker"
        | "financial"
        | "owner"
        | "tenant"
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
      app_role: ["admin", "manager", "broker", "financial", "owner", "tenant"],
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
