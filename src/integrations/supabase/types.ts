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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          apartment: string | null
          city: string | null
          created_at: string
          customer_id: string
          house_number: string | null
          id: string
          last_service_date: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          postal_code: string | null
          street: string | null
        }
        Insert: {
          apartment?: string | null
          city?: string | null
          created_at?: string
          customer_id: string
          house_number?: string | null
          id?: string
          last_service_date?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          postal_code?: string | null
          street?: string | null
        }
        Update: {
          apartment?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string
          house_number?: string | null
          id?: string
          last_service_date?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          postal_code?: string | null
          street?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          address_id: string | null
          assigned_to: string | null
          created_at: string
          customer_id: string
          duration_minutes: number
          id: string
          notes: string | null
          scheduled_at: string
          service_id: string | null
          start_location_label: string | null
          status: string
          todos: Json | null
          travel_time_minutes: number | null
        }
        Insert: {
          address_id?: string | null
          assigned_to?: string | null
          created_at?: string
          customer_id: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          scheduled_at: string
          service_id?: string | null
          start_location_label?: string | null
          status?: string
          todos?: Json | null
          travel_time_minutes?: number | null
        }
        Update: {
          address_id?: string | null
          assigned_to?: string | null
          created_at?: string
          customer_id?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          scheduled_at?: string
          service_id?: string | null
          start_location_label?: string | null
          status?: string
          todos?: Json | null
          travel_time_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_message_settings: {
        Row: {
          channel: string
          created_at: string
          custom_text: string | null
          delay_hours: number
          enabled: boolean
          id: string
          message_type: string
          template_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          custom_text?: string | null
          delay_hours?: number
          enabled?: boolean
          id?: string
          message_type: string
          template_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          custom_text?: string | null
          delay_hours?: number
          enabled?: boolean
          id?: string
          message_type?: string
          template_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_send_log: {
        Row: {
          automation_id: string
          customer_id: string
          id: string
          result: Json | null
          sent_at: string
          trigger_type: string
        }
        Insert: {
          automation_id: string
          customer_id: string
          id?: string
          result?: Json | null
          sent_at?: string
          trigger_type: string
        }
        Update: {
          automation_id?: string
          customer_id?: string
          id?: string
          result?: Json | null
          sent_at?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_send_log_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_send_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          is_automated: boolean
          message_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_name: string | null
          work_order_id: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          is_automated?: boolean
          message_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
          work_order_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          is_automated?: boolean
          message_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          default_service_id: string | null
          eboekhouden_relation_id: number | null
          email: string | null
          id: string
          interval_months: number
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          type: string
          updated_at: string
          whatsapp_optin: boolean
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          default_service_id?: string | null
          eboekhouden_relation_id?: number | null
          email?: string | null
          id?: string
          interval_months?: number
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          type?: string
          updated_at?: string
          whatsapp_optin?: boolean
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          default_service_id?: string | null
          eboekhouden_relation_id?: number | null
          email?: string | null
          id?: string
          interval_months?: number
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          type?: string
          updated_at?: string
          whatsapp_optin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customers_default_service_id_fkey"
            columns: ["default_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          due_at: string | null
          eboekhouden_id: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          items: Json
          notes: string | null
          optional_items: Json
          paid_at: string | null
          status: string
          subtotal: number
          total: number
          vat_amount: number
          vat_percentage: number
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          due_at?: string | null
          eboekhouden_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          items?: Json
          notes?: string | null
          optional_items?: Json
          paid_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_percentage?: number
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          due_at?: string | null
          eboekhouden_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          items?: Json
          notes?: string | null
          optional_items?: Json
          paid_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_percentage?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link_page: string | null
          link_params: Json | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link_page?: string | null
          link_params?: Json | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link_page?: string | null
          link_params?: Json | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          btw_number: string | null
          company_address: string | null
          company_city: string | null
          company_name: string | null
          company_phone: string | null
          company_postal_code: string | null
          created_at: string
          eboekhouden_api_token: string | null
          eboekhouden_debtor_ledger_id: number | null
          eboekhouden_ledger_id: number | null
          eboekhouden_template_id: number | null
          full_name: string | null
          iban: string | null
          id: string
          kvk_number: string | null
          location: string | null
          logo_url: string | null
          onboarding_completed: boolean
          phone: string | null
          smtp_email: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
        }
        Insert: {
          btw_number?: string | null
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_postal_code?: string | null
          created_at?: string
          eboekhouden_api_token?: string | null
          eboekhouden_debtor_ledger_id?: number | null
          eboekhouden_ledger_id?: number | null
          eboekhouden_template_id?: number | null
          full_name?: string | null
          iban?: string | null
          id: string
          kvk_number?: string | null
          location?: string | null
          logo_url?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
        }
        Update: {
          btw_number?: string | null
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_postal_code?: string | null
          created_at?: string
          eboekhouden_api_token?: string | null
          eboekhouden_debtor_ledger_id?: number | null
          eboekhouden_ledger_id?: number | null
          eboekhouden_template_id?: number | null
          full_name?: string | null
          iban?: string | null
          id?: string
          kvk_number?: string | null
          location?: string | null
          logo_url?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
        }
        Relationships: []
      }
      quote_templates: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          optional_items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          optional_items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          optional_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          issued_at: string | null
          items: Json
          notes: string | null
          optional_items: Json
          quote_number: string | null
          status: string
          subtotal: number
          total: number
          user_id: string
          valid_until: string | null
          vat_amount: number
          vat_percentage: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          issued_at?: string | null
          items?: Json
          notes?: string | null
          optional_items?: Json
          quote_number?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id: string
          valid_until?: string | null
          vat_amount?: number
          vat_percentage?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          issued_at?: string | null
          items?: Json
          notes?: string | null
          optional_items?: Json
          quote_number?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id?: string
          valid_until?: string | null
          vat_amount?: number
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          checklist_template: Json | null
          color: string | null
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price: number
        }
        Insert: {
          category?: string | null
          checklist_template?: Json | null
          color?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          name: string
          price: number
        }
        Update: {
          category?: string | null
          checklist_template?: Json | null
          color?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      todos: {
        Row: {
          completed: boolean
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      whatsapp_automations: {
        Row: {
          conditions: Json
          cooldown_hours: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          template_language: string
          template_name: string
          trigger_type: string
          updated_at: string
          user_id: string
          variable_mapping: Json
        }
        Insert: {
          conditions?: Json
          cooldown_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          template_language?: string
          template_name: string
          trigger_type: string
          updated_at?: string
          user_id: string
          variable_mapping?: Json
        }
        Update: {
          conditions?: Json
          cooldown_hours?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          template_language?: string
          template_name?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
          variable_mapping?: Json
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          access_token: string
          display_phone: string | null
          id: string
          phone_number_id: string
          tenant_id: string | null
          updated_at: string | null
          waba_id: string | null
        }
        Insert: {
          access_token: string
          display_phone?: string | null
          id?: string
          phone_number_id: string
          tenant_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
        }
        Update: {
          access_token?: string
          display_phone?: string | null
          id?: string
          phone_number_id?: string
          tenant_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          created_at: string | null
          customer_id: string | null
          direction: string
          from_number: string | null
          id: string
          metadata: Json | null
          sent_by: string | null
          status: string | null
          to_number: string | null
          type: string | null
          wamid: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          customer_id?: string | null
          direction: string
          from_number?: string | null
          id?: string
          metadata?: Json | null
          sent_by?: string | null
          status?: string | null
          to_number?: string | null
          type?: string | null
          wamid?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          customer_id?: string | null
          direction?: string
          from_number?: string | null
          id?: string
          metadata?: Json | null
          sent_by?: string | null
          status?: string | null
          to_number?: string | null
          type?: string | null
          wamid?: string | null
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          address_id: string | null
          appointment_id: string | null
          checklist: Json | null
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          notes: Json | null
          photos_after: string[] | null
          photos_before: string[] | null
          remarks: string | null
          service_id: string | null
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
          total_amount: number | null
          travel_cost: number
          work_order_number: string | null
        }
        Insert: {
          address_id?: string | null
          appointment_id?: string | null
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          notes?: Json | null
          photos_after?: string[] | null
          photos_before?: string[] | null
          remarks?: string | null
          service_id?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          total_amount?: number | null
          travel_cost?: number
          work_order_number?: string | null
        }
        Update: {
          address_id?: string | null
          appointment_id?: string | null
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          notes?: Json | null
          photos_after?: string[] | null
          photos_before?: string[] | null
          remarks?: string | null
          service_id?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          total_amount?: number | null
          travel_cost?: number
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "monteur"
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
      app_role: ["admin", "monteur"],
    },
  },
} as const
