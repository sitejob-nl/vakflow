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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_config: {
        Row: {
          business_hours: Json | null
          company_id: string
          created_at: string | null
          enabled: boolean | null
          escalation_action: string | null
          escalation_users: string[] | null
          greeting_text: string | null
          id: string
          intake_questions: Json | null
          language: string | null
          max_turns: number | null
          routing_rules: Json | null
          system_prompt: string | null
          updated_at: string | null
          voice_id: string | null
        }
        Insert: {
          business_hours?: Json | null
          company_id: string
          created_at?: string | null
          enabled?: boolean | null
          escalation_action?: string | null
          escalation_users?: string[] | null
          greeting_text?: string | null
          id?: string
          intake_questions?: Json | null
          language?: string | null
          max_turns?: number | null
          routing_rules?: Json | null
          system_prompt?: string | null
          updated_at?: string | null
          voice_id?: string | null
        }
        Update: {
          business_hours?: Json | null
          company_id?: string
          created_at?: string | null
          enabled?: boolean | null
          escalation_action?: string | null
          escalation_users?: string[] | null
          greeting_text?: string | null
          id?: string
          intake_questions?: Json | null
          language?: string | null
          max_turns?: number | null
          routing_rules?: Json | null
          system_prompt?: string | null
          updated_at?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      apk_reminder_logs: {
        Row: {
          apk_expiry_date: string
          channel: string
          company_id: string
          customer_id: string
          id: string
          reminder_type: string
          sent_at: string
          vehicle_id: string
        }
        Insert: {
          apk_expiry_date: string
          channel?: string
          company_id: string
          customer_id: string
          id?: string
          reminder_type: string
          sent_at?: string
          vehicle_id: string
        }
        Update: {
          apk_expiry_date?: string
          channel?: string
          company_id?: string
          customer_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apk_reminder_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apk_reminder_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apk_reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apk_reminder_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      apk_reminder_settings: {
        Row: {
          channel: string
          company_id: string
          created_at: string
          days_before: number[]
          email_body: string | null
          email_subject: string | null
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          company_id: string
          created_at?: string
          days_before?: number[]
          email_body?: string | null
          email_subject?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string
          days_before?: number[]
          email_body?: string | null
          email_subject?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apk_reminder_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apk_reminder_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          address_id: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          customer_id: string
          delivery_type: string | null
          duration_minutes: number
          id: string
          notes: string | null
          outlook_event_id: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          project_id: string | null
          scheduled_at: string
          service_id: string | null
          start_location_label: string | null
          status: string
          todos: Json | null
          travel_time_minutes: number | null
          vehicle_id: string | null
        }
        Insert: {
          address_id?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          delivery_type?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          outlook_event_id?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          project_id?: string | null
          scheduled_at: string
          service_id?: string | null
          start_location_label?: string | null
          status?: string
          todos?: Json | null
          travel_time_minutes?: number | null
          vehicle_id?: string | null
        }
        Update: {
          address_id?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          delivery_type?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          outlook_event_id?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          project_id?: string | null
          scheduled_at?: string
          service_id?: string | null
          start_location_label?: string | null
          status?: string
          todos?: Json | null
          travel_time_minutes?: number | null
          vehicle_id?: string | null
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
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "appointments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_logs: {
        Row: {
          asset_id: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          maintenance_date: string
          performed_by: string | null
          work_order_id: string | null
        }
        Insert: {
          asset_id: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_date?: string
          performed_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          asset_id?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_date?: string
          performed_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          access_instructions: string | null
          address_id: string | null
          asset_type: string | null
          avg_quality_score: number | null
          brand: string | null
          company_id: string
          created_at: string
          custom_fields: Json | null
          customer_id: string | null
          facilities: string[] | null
          frequency: string | null
          frequency_days: number[] | null
          id: string
          install_date: string | null
          last_maintenance_date: string | null
          model: string | null
          name: string
          next_service_due: string | null
          notes: string | null
          object_type: string
          serial_number: string | null
          status: string
          surface_area: number | null
          updated_at: string
          vehicle_count: number | null
        }
        Insert: {
          access_instructions?: string | null
          address_id?: string | null
          asset_type?: string | null
          avg_quality_score?: number | null
          brand?: string | null
          company_id: string
          created_at?: string
          custom_fields?: Json | null
          customer_id?: string | null
          facilities?: string[] | null
          frequency?: string | null
          frequency_days?: number[] | null
          id?: string
          install_date?: string | null
          last_maintenance_date?: string | null
          model?: string | null
          name: string
          next_service_due?: string | null
          notes?: string | null
          object_type?: string
          serial_number?: string | null
          status?: string
          surface_area?: number | null
          updated_at?: string
          vehicle_count?: number | null
        }
        Update: {
          access_instructions?: string | null
          address_id?: string | null
          asset_type?: string | null
          avg_quality_score?: number | null
          brand?: string | null
          company_id?: string
          created_at?: string
          custom_fields?: Json | null
          customer_id?: string | null
          facilities?: string[] | null
          frequency?: string | null
          frequency_days?: number[] | null
          id?: string
          install_date?: string | null
          last_maintenance_date?: string | null
          model?: string | null
          name?: string
          next_service_due?: string | null
          notes?: string | null
          object_type?: string
          serial_number?: string | null
          status?: string
          surface_area?: number | null
          updated_at?: string
          vehicle_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_room_scores: {
        Row: {
          audit_id: string
          company_id: string
          created_at: string
          criteria: Json
          id: string
          notes: string | null
          room_id: string | null
          room_name: string
          score: number | null
        }
        Insert: {
          audit_id: string
          company_id: string
          created_at?: string
          criteria?: Json
          id?: string
          notes?: string | null
          room_id?: string | null
          room_name: string
          score?: number | null
        }
        Update: {
          audit_id?: string
          company_id?: string
          created_at?: string
          criteria?: Json
          id?: string
          notes?: string | null
          room_id?: string | null
          room_name?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_room_scores_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_room_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_room_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_room_scores_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "object_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_message_settings: {
        Row: {
          channel: string
          company_id: string | null
          created_at: string
          custom_text: string | null
          delay_hours: number
          email_template_id: string | null
          enabled: boolean
          id: string
          message_type: string
          template_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          company_id?: string | null
          created_at?: string
          custom_text?: string | null
          delay_hours?: number
          email_template_id?: string | null
          enabled?: boolean
          id?: string
          message_type: string
          template_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          company_id?: string | null
          created_at?: string
          custom_text?: string | null
          delay_hours?: number
          email_template_id?: string | null
          enabled?: boolean
          id?: string
          message_type?: string
          template_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_message_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_message_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_message_settings_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_send_log: {
        Row: {
          automation_id: string
          company_id: string | null
          customer_id: string
          id: string
          result: Json | null
          sent_at: string
          trigger_type: string
        }
        Insert: {
          automation_id: string
          company_id?: string | null
          customer_id: string
          id?: string
          result?: Json | null
          sent_at?: string
          trigger_type: string
        }
        Update: {
          automation_id?: string
          company_id?: string | null
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
            foreignKeyName: "automation_send_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_send_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
      call_records: {
        Row: {
          ai_action_items: Json | null
          ai_summary: string | null
          answered_at: string | null
          answered_by_account_number: number | null
          answered_by_name: string | null
          caller_name: string | null
          company_id: string
          created_at: string | null
          customer_id: string | null
          destination_number: string | null
          direction: string
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          from_number: string | null
          handled_by: string | null
          id: string
          merged_call_id: string | null
          metadata: Json | null
          recording_url: string | null
          started_at: string | null
          status: string | null
          to_number: string | null
          transcription: string | null
          transferred_to: string | null
          voys_call_id: string | null
          voys_summary: string | null
          was_transferred: boolean | null
        }
        Insert: {
          ai_action_items?: Json | null
          ai_summary?: string | null
          answered_at?: string | null
          answered_by_account_number?: number | null
          answered_by_name?: string | null
          caller_name?: string | null
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          destination_number?: string | null
          direction?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          from_number?: string | null
          handled_by?: string | null
          id?: string
          merged_call_id?: string | null
          metadata?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          to_number?: string | null
          transcription?: string | null
          transferred_to?: string | null
          voys_call_id?: string | null
          voys_summary?: string | null
          was_transferred?: boolean | null
        }
        Update: {
          ai_action_items?: Json | null
          ai_summary?: string | null
          answered_at?: string | null
          answered_by_account_number?: number | null
          answered_by_name?: string | null
          caller_name?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          destination_number?: string | null
          direction?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          from_number?: string | null
          handled_by?: string | null
          id?: string
          merged_call_id?: string | null
          metadata?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          to_number?: string | null
          transcription?: string | null
          transferred_to?: string | null
          voys_call_id?: string | null
          voys_summary?: string | null
          was_transferred?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_customer_id_fkey"
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
          call_record_id: string | null
          channel: string
          company_id: string
          created_at: string
          customer_id: string | null
          direction: string
          folder_name: string | null
          html_body: string | null
          id: string
          is_automated: boolean
          message_id: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_name: string | null
          work_order_id: string | null
        }
        Insert: {
          body?: string | null
          call_record_id?: string | null
          channel: string
          company_id: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          folder_name?: string | null
          html_body?: string | null
          id?: string
          is_automated?: boolean
          message_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
          work_order_id?: string | null
        }
        Update: {
          body?: string | null
          call_record_id?: string | null
          channel?: string
          company_id?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          folder_name?: string | null
          html_body?: string | null
          id?: string
          is_automated?: boolean
          message_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_call_record_id_fkey"
            columns: ["call_record_id"]
            isOneToOne: false
            referencedRelation: "call_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
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
      companies: {
        Row: {
          accounting_provider: string | null
          address: string | null
          admin_notes: string | null
          anthropic_api_key: string | null
          asset_field_config: Json | null
          billing_email: string | null
          brand_color: string | null
          btw_number: string | null
          city: string | null
          created_at: string
          custom_domain: string | null
          eboekhouden_api_token: string | null
          eboekhouden_debtor_ledger_id: number | null
          eboekhouden_ledger_id: number | null
          eboekhouden_template_id: number | null
          email_provider: string | null
          enabled_features: string[]
          iban: string | null
          id: string
          imap_host: string | null
          imap_port: number | null
          industry: string
          kvk_number: string | null
          last_active_at: string | null
          logo_url: string | null
          max_users: number
          moneybird_administration_id: string | null
          moneybird_api_token: string | null
          moneybird_webhook_secret: string | null
          monthly_price: number | null
          name: string
          outlook_client_id: string | null
          outlook_email: string | null
          outlook_refresh_token: string | null
          outlook_tenant_id: string | null
          phone: string | null
          postal_code: string | null
          pwa_icon_url: string | null
          pwa_name: string | null
          rompslomp_api_token: string | null
          rompslomp_company_id: string | null
          rompslomp_company_name: string | null
          rompslomp_tenant_id: string | null
          rompslomp_webhook_secret: string | null
          slug: string
          smtp_email: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subcategory: string
          subscription_plan: string
          subscription_status: string
          sync_invoices_to_accounting: boolean
          sync_quotes_to_accounting: boolean
          trial_ends_at: string | null
          wefact_api_key: string | null
        }
        Insert: {
          accounting_provider?: string | null
          address?: string | null
          admin_notes?: string | null
          anthropic_api_key?: string | null
          asset_field_config?: Json | null
          billing_email?: string | null
          brand_color?: string | null
          btw_number?: string | null
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          eboekhouden_api_token?: string | null
          eboekhouden_debtor_ledger_id?: number | null
          eboekhouden_ledger_id?: number | null
          eboekhouden_template_id?: number | null
          email_provider?: string | null
          enabled_features?: string[]
          iban?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          industry?: string
          kvk_number?: string | null
          last_active_at?: string | null
          logo_url?: string | null
          max_users?: number
          moneybird_administration_id?: string | null
          moneybird_api_token?: string | null
          moneybird_webhook_secret?: string | null
          monthly_price?: number | null
          name: string
          outlook_client_id?: string | null
          outlook_email?: string | null
          outlook_refresh_token?: string | null
          outlook_tenant_id?: string | null
          phone?: string | null
          postal_code?: string | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          rompslomp_api_token?: string | null
          rompslomp_company_id?: string | null
          rompslomp_company_name?: string | null
          rompslomp_tenant_id?: string | null
          rompslomp_webhook_secret?: string | null
          slug: string
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subcategory?: string
          subscription_plan?: string
          subscription_status?: string
          sync_invoices_to_accounting?: boolean
          sync_quotes_to_accounting?: boolean
          trial_ends_at?: string | null
          wefact_api_key?: string | null
        }
        Update: {
          accounting_provider?: string | null
          address?: string | null
          admin_notes?: string | null
          anthropic_api_key?: string | null
          asset_field_config?: Json | null
          billing_email?: string | null
          brand_color?: string | null
          btw_number?: string | null
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          eboekhouden_api_token?: string | null
          eboekhouden_debtor_ledger_id?: number | null
          eboekhouden_ledger_id?: number | null
          eboekhouden_template_id?: number | null
          email_provider?: string | null
          enabled_features?: string[]
          iban?: string | null
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          industry?: string
          kvk_number?: string | null
          last_active_at?: string | null
          logo_url?: string | null
          max_users?: number
          moneybird_administration_id?: string | null
          moneybird_api_token?: string | null
          moneybird_webhook_secret?: string | null
          monthly_price?: number | null
          name?: string
          outlook_client_id?: string | null
          outlook_email?: string | null
          outlook_refresh_token?: string | null
          outlook_tenant_id?: string | null
          phone?: string | null
          postal_code?: string | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          rompslomp_api_token?: string | null
          rompslomp_company_id?: string | null
          rompslomp_company_name?: string | null
          rompslomp_tenant_id?: string | null
          rompslomp_webhook_secret?: string | null
          slug?: string
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subcategory?: string
          subscription_plan?: string
          subscription_status?: string
          sync_invoices_to_accounting?: boolean
          sync_quotes_to_accounting?: boolean
          trial_ends_at?: string | null
          wefact_api_key?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          address_id: string | null
          asset_id: string | null
          assigned_to: string | null
          auto_invoice: boolean | null
          company_id: string
          created_at: string
          customer_id: string
          description: string | null
          end_date: string | null
          frequency: string | null
          id: string
          interval_months: number
          last_generated_at: string | null
          moneybird_subscription_id: string | null
          name: string
          next_due_date: string
          notes: string | null
          price: number
          seasonal_months: number[] | null
          service_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          auto_invoice?: boolean | null
          company_id: string
          created_at?: string
          customer_id: string
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          interval_months?: number
          last_generated_at?: string | null
          moneybird_subscription_id?: string | null
          name: string
          next_due_date?: string
          notes?: string | null
          price?: number
          seasonal_months?: number[] | null
          service_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          auto_invoice?: boolean | null
          company_id?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          interval_months?: number
          last_generated_at?: string | null
          moneybird_subscription_id?: string | null
          name?: string
          next_due_date?: string
          notes?: string | null
          price?: number
          seasonal_months?: number[] | null
          service_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          btw_number: string | null
          city: string | null
          company_id: string
          contact_person: string | null
          created_at: string
          default_service_id: string | null
          eboekhouden_relation_id: number | null
          email: string | null
          exact_account_id: string | null
          id: string
          interval_months: number
          kvk_number: string | null
          lat: number | null
          lng: number | null
          moneybird_contact_id: string | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          rompslomp_contact_id: string | null
          type: string
          updated_at: string
          wefact_debtor_code: string | null
          whatsapp_optin: boolean
        }
        Insert: {
          address?: string | null
          btw_number?: string | null
          city?: string | null
          company_id: string
          contact_person?: string | null
          created_at?: string
          default_service_id?: string | null
          eboekhouden_relation_id?: number | null
          email?: string | null
          exact_account_id?: string | null
          id?: string
          interval_months?: number
          kvk_number?: string | null
          lat?: number | null
          lng?: number | null
          moneybird_contact_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rompslomp_contact_id?: string | null
          type?: string
          updated_at?: string
          wefact_debtor_code?: string | null
          whatsapp_optin?: boolean
        }
        Update: {
          address?: string | null
          btw_number?: string | null
          city?: string | null
          company_id?: string
          contact_person?: string | null
          created_at?: string
          default_service_id?: string | null
          eboekhouden_relation_id?: number | null
          email?: string | null
          exact_account_id?: string | null
          id?: string
          interval_months?: number
          kvk_number?: string | null
          lat?: number | null
          lng?: number | null
          moneybird_contact_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rompslomp_contact_id?: string | null
          type?: string
          updated_at?: string
          wefact_debtor_code?: string | null
          whatsapp_optin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_default_service_id_fkey"
            columns: ["default_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_errors: {
        Row: {
          company_id: string | null
          created_at: string
          error_details: Json
          error_message: string
          function_name: string
          id: string
          resolved: boolean
          severity: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_details?: Json
          error_message: string
          function_name: string
          id?: string
          resolved?: boolean
          severity?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_details?: Json
          error_message?: string
          function_name?: string
          id?: string
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edge_function_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          company_id: string
          created_at: string
          html_body: string
          id: string
          name: string
          subject: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          html_body?: string
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          html_body?: string
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      exact_config: {
        Row: {
          auto_finalize: boolean | null
          company_id: string
          company_name_exact: string | null
          created_at: string
          default_item_id: string | null
          division: number | null
          gl_revenue_id: string | null
          id: string
          invoice_type: number | null
          journal_code: string | null
          payment_condition: string | null
          region: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          vat_code_high: string | null
          vat_code_low: string | null
          vat_code_zero: string | null
          webhook_secret: string | null
        }
        Insert: {
          auto_finalize?: boolean | null
          company_id: string
          company_name_exact?: string | null
          created_at?: string
          default_item_id?: string | null
          division?: number | null
          gl_revenue_id?: string | null
          id?: string
          invoice_type?: number | null
          journal_code?: string | null
          payment_condition?: string | null
          region?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          vat_code_high?: string | null
          vat_code_low?: string | null
          vat_code_zero?: string | null
          webhook_secret?: string | null
        }
        Update: {
          auto_finalize?: boolean | null
          company_id?: string
          company_name_exact?: string | null
          created_at?: string
          default_item_id?: string | null
          division?: number | null
          gl_revenue_id?: string | null
          id?: string
          invoice_type?: number | null
          journal_code?: string | null
          payment_condition?: string | null
          region?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          vat_code_high?: string | null
          vat_code_low?: string | null
          vat_code_zero?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exact_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exact_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      exact_online_connections: {
        Row: {
          company_id: string
          company_name: string | null
          connected_at: string | null
          created_at: string | null
          division_id: string
          exact_division: number | null
          id: string
          is_active: boolean | null
          region: string | null
          tenant_id: string | null
          updated_at: string | null
          webhook_secret: string | null
          webhooks_enabled: boolean | null
        }
        Insert: {
          company_id: string
          company_name?: string | null
          connected_at?: string | null
          created_at?: string | null
          division_id: string
          exact_division?: number | null
          id?: string
          is_active?: boolean | null
          region?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhooks_enabled?: boolean | null
        }
        Update: {
          company_id?: string
          company_name?: string | null
          connected_at?: string | null
          created_at?: string | null
          division_id?: string
          exact_division?: number | null
          id?: string
          is_active?: boolean | null
          region?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhooks_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exact_online_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exact_online_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicle_types: {
        Row: {
          asset_id: string
          company_id: string
          count: number
          created_at: string | null
          id: string
          price_per_unit: number | null
          updated_at: string | null
          vehicle_type: string
        }
        Insert: {
          asset_id: string
          company_id: string
          count?: number
          created_at?: string | null
          id?: string
          price_per_unit?: number | null
          updated_at?: string | null
          vehicle_type: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          count?: number
          created_at?: string | null
          id?: string
          price_per_unit?: number | null
          updated_at?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicle_types_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicle_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      hexon_config: {
        Row: {
          api_key: string | null
          api_url: string
          auto_publish: boolean | null
          company_id: string
          created_at: string | null
          default_site_codes: string[] | null
          id: string
          last_sync_at: string | null
          photo_overlay_code: string | null
          publication: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string
          auto_publish?: boolean | null
          company_id: string
          created_at?: string | null
          default_site_codes?: string[] | null
          id?: string
          last_sync_at?: string | null
          photo_overlay_code?: string | null
          publication?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string
          auto_publish?: boolean | null
          company_id?: string
          created_at?: string | null
          default_site_codes?: string[] | null
          id?: string
          last_sync_at?: string | null
          photo_overlay_code?: string | null
          publication?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hexon_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hexon_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      hexon_listings: {
        Row: {
          company_id: string
          created_at: string | null
          deeplink_url: string | null
          errors: Json | null
          id: string
          last_synced_at: string | null
          site_code: string
          status: string | null
          status_message: string | null
          stocknumber: string
          trade_vehicle_id: string
          updated_at: string | null
          warnings: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deeplink_url?: string | null
          errors?: Json | null
          id?: string
          last_synced_at?: string | null
          site_code: string
          status?: string | null
          status_message?: string | null
          stocknumber: string
          trade_vehicle_id: string
          updated_at?: string | null
          warnings?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deeplink_url?: string | null
          errors?: Json | null
          id?: string
          last_synced_at?: string | null
          site_code?: string
          status?: string | null
          status_message?: string | null
          stocknumber?: string
          trade_vehicle_id?: string
          updated_at?: string | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hexon_listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hexon_listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hexon_listings_trade_vehicle_id_fkey"
            columns: ["trade_vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          due_at: string | null
          eboekhouden_id: string | null
          exact_id: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          items: Json
          moneybird_id: string | null
          notes: string | null
          optional_items: Json
          paid_at: string | null
          project_id: string | null
          quote_id: string | null
          rompslomp_id: string | null
          status: string
          subtotal: number
          total: number
          vat_amount: number
          vat_percentage: number
          wefact_id: string | null
          work_order_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          due_at?: string | null
          eboekhouden_id?: string | null
          exact_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          items?: Json
          moneybird_id?: string | null
          notes?: string | null
          optional_items?: Json
          paid_at?: string | null
          project_id?: string | null
          quote_id?: string | null
          rompslomp_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_percentage?: number
          wefact_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          due_at?: string | null
          eboekhouden_id?: string | null
          exact_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          items?: Json
          moneybird_id?: string | null
          notes?: string | null
          optional_items?: Json
          paid_at?: string | null
          project_id?: string | null
          quote_id?: string | null
          rompslomp_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_amount?: number
          vat_percentage?: number
          wefact_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      lead_form_fields: {
        Row: {
          company_id: string
          created_at: string
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          options: Json | null
          sort_order: number
        }
        Insert: {
          company_id: string
          created_at?: string
          field_label: string
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          sort_order?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_form_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company_id: string
          company_name: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          source: string | null
          status_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          company_id: string
          company_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          source?: string | null
          status_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          company_id?: string
          company_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          source?: string | null
          status_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          article_number: string | null
          category: string | null
          company_id: string
          cost_price: number
          created_at: string
          id: string
          markup_percentage: number
          min_stock_level: number
          moneybird_product_id: string | null
          name: string
          stock_quantity: number
          unit: string
          unit_price: number
          wefact_product_id: string | null
        }
        Insert: {
          article_number?: string | null
          category?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          id?: string
          markup_percentage?: number
          min_stock_level?: number
          moneybird_product_id?: string | null
          name: string
          stock_quantity?: number
          unit?: string
          unit_price?: number
          wefact_product_id?: string | null
        }
        Update: {
          article_number?: string | null
          category?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          markup_percentage?: number
          min_stock_level?: number
          moneybird_product_id?: string | null
          name?: string
          stock_quantity?: number
          unit?: string
          unit_price?: number
          wefact_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_config: {
        Row: {
          app_id: string | null
          app_secret: string | null
          company_id: string
          created_at: string
          id: string
          instagram_account_id: string | null
          page_access_token: string | null
          page_id: string | null
          page_name: string | null
          updated_at: string
          user_access_token: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          app_id?: string | null
          app_secret?: string | null
          company_id: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          updated_at?: string
          user_access_token?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          app_id?: string | null
          app_secret?: string | null
          company_id?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          updated_at?: string
          user_access_token?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_conversations: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          message_id: string | null
          metadata: Json | null
          platform: string
          sender_id: string | null
          sender_name: string | null
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          platform?: string
          sender_id?: string | null
          sender_name?: string | null
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          platform?: string
          sender_id?: string | null
          sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_leads: {
        Row: {
          company_id: string
          created_at: string
          customer_data: Json | null
          customer_id: string | null
          form_id: string | null
          form_name: string | null
          id: string
          lead_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_data?: Json | null
          customer_id?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          lead_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_data?: Json | null
          customer_id?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          lead_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_page_posts: {
        Row: {
          comments: number | null
          company_id: string
          created_time: string | null
          id: string
          likes: number | null
          message: string | null
          metadata: Json | null
          post_id: string
          shares: number | null
          synced_at: string
        }
        Insert: {
          comments?: number | null
          company_id: string
          created_time?: string | null
          id?: string
          likes?: number | null
          message?: string | null
          metadata?: Json | null
          post_id: string
          shares?: number | null
          synced_at?: string
        }
        Update: {
          comments?: number | null
          company_id?: string
          created_time?: string | null
          id?: string
          likes?: number | null
          message?: string | null
          metadata?: Json | null
          post_id?: string
          shares?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_page_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_page_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
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
          company_id: string
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
          company_id?: string
          created_at?: string
          id?: string
          link_page?: string | null
          link_params?: Json | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      object_rooms: {
        Row: {
          asset_id: string
          checklist: Json | null
          company_id: string
          created_at: string | null
          id: string
          name: string
          room_type: string | null
          sort_order: number | null
        }
        Insert: {
          asset_id: string
          checklist?: Json | null
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          room_type?: string | null
          sort_order?: number | null
        }
        Update: {
          asset_id?: string
          checklist?: Json | null
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          room_type?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "object_rooms_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      outlook_event_overrides: {
        Row: {
          company_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          location_override: string | null
          outlook_event_id: string
          pinned: boolean
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_override?: string | null
          outlook_event_id: string
          pinned?: boolean
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_override?: string | null
          outlook_event_id?: string
          pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlook_event_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outlook_event_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_users: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          btw_number: string | null
          company_address: string | null
          company_city: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          budget_amount: number | null
          company_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          start_date: string | null
          status: string
        }
        Insert: {
          budget_amount?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
        }
        Update: {
          budget_amount?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address_id: string | null
          asset_id: string | null
          assigned_to: string | null
          budget_amount: number
          company_id: string
          created_at: string
          customer_id: string
          deadline: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          project_number: string | null
          quote_id: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          budget_amount?: number
          company_id: string
          created_at?: string
          customer_id: string
          deadline?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          project_number?: string | null
          quote_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          budget_amount?: number
          company_id?: string
          created_at?: string
          customer_id?: string
          deadline?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_number?: string | null
          quote_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audits: {
        Row: {
          asset_id: string
          audit_date: string
          audit_type: string
          auditor_id: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          overall_score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          audit_date?: string
          audit_type?: string
          auditor_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          overall_score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          audit_date?: string
          audit_type?: string
          auditor_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          overall_score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_audits_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_responses: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          quote_id: string
          responded_at: string
          responded_by: string | null
          signature_data: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          quote_id: string
          responded_at?: string
          responded_by?: string | null
          signature_data?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          quote_id?: string
          responded_at?: string
          responded_by?: string | null
          signature_data?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_responses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_responses_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          blocks: Json | null
          company_id: string | null
          created_at: string
          id: string
          items: Json
          name: string
          optional_items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          name: string
          optional_items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json | null
          company_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          name?: string
          optional_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          asset_id: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          customer_id: string
          exact_id: string | null
          id: string
          issued_at: string | null
          items: Json
          moneybird_id: string | null
          notes: string | null
          optional_items: Json
          quote_number: string | null
          rompslomp_id: string | null
          status: string
          subtotal: number
          total: number
          user_id: string
          valid_until: string | null
          vat_amount: number
          vat_percentage: number
          wefact_id: string | null
        }
        Insert: {
          asset_id?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          customer_id: string
          exact_id?: string | null
          id?: string
          issued_at?: string | null
          items?: Json
          moneybird_id?: string | null
          notes?: string | null
          optional_items?: Json
          quote_number?: string | null
          rompslomp_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id: string
          valid_until?: string | null
          vat_amount?: number
          vat_percentage?: number
          wefact_id?: string | null
        }
        Update: {
          asset_id?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          customer_id?: string
          exact_id?: string | null
          id?: string
          issued_at?: string | null
          items?: Json
          moneybird_id?: string | null
          notes?: string | null
          optional_items?: Json
          quote_number?: string | null
          rompslomp_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id?: string
          valid_until?: string | null
          vat_amount?: number
          vat_percentage?: number
          wefact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      rdw_defect_descriptions: {
        Row: {
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          description: string
          id: string
          updated_at?: string
        }
        Update: {
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          admin_notes: string | null
          company_id: string
          created_at: string
          customer_id: string
          description: string
          id: string
          media: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          description: string
          id?: string
          media?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          media?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_customer_id_fkey"
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
          company_id: string
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
          company_id: string
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
          company_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_artikelen: {
        Row: {
          artikel_omzetgroep_id: string | null
          artikelcode: string | null
          connection_id: string
          eenheid: string | null
          id: string
          inkoopprijs: number | null
          is_hoofdartikel: boolean | null
          is_non_actief: boolean | null
          modified_on: string | null
          omschrijving: string | null
          raw_data: Json | null
          synced_at: string | null
          technische_voorraad: number | null
          verkoopprijs: number | null
          voorraad_controle: boolean | null
          vrije_voorraad: number | null
        }
        Insert: {
          artikel_omzetgroep_id?: string | null
          artikelcode?: string | null
          connection_id: string
          eenheid?: string | null
          id: string
          inkoopprijs?: number | null
          is_hoofdartikel?: boolean | null
          is_non_actief?: boolean | null
          modified_on?: string | null
          omschrijving?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          technische_voorraad?: number | null
          verkoopprijs?: number | null
          voorraad_controle?: boolean | null
          vrije_voorraad?: number | null
        }
        Update: {
          artikel_omzetgroep_id?: string | null
          artikelcode?: string | null
          connection_id?: string
          eenheid?: string | null
          id?: string
          inkoopprijs?: number | null
          is_hoofdartikel?: boolean | null
          is_non_actief?: boolean | null
          modified_on?: string | null
          omschrijving?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          technische_voorraad?: number | null
          verkoopprijs?: number | null
          voorraad_controle?: boolean | null
          vrije_voorraad?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_artikelen_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "snelstart_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_connections: {
        Row: {
          access_token: string | null
          client_key: string
          company_id: string
          created_at: string
          id: string
          subscription_key: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          client_key: string
          company_id: string
          created_at?: string
          id?: string
          subscription_key: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          client_key?: string
          company_id?: string
          created_at?: string
          id?: string
          subscription_key?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snelstart_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_offertes: {
        Row: {
          connection_id: string
          datum: string | null
          id: string
          modified_on: string | null
          nummer: number | null
          omschrijving: string | null
          proces_status: string | null
          raw_data: Json | null
          relatie_id: string | null
          synced_at: string | null
          totaal_exclusief_btw: number | null
          totaal_inclusief_btw: number | null
        }
        Insert: {
          connection_id: string
          datum?: string | null
          id: string
          modified_on?: string | null
          nummer?: number | null
          omschrijving?: string | null
          proces_status?: string | null
          raw_data?: Json | null
          relatie_id?: string | null
          synced_at?: string | null
          totaal_exclusief_btw?: number | null
          totaal_inclusief_btw?: number | null
        }
        Update: {
          connection_id?: string
          datum?: string | null
          id?: string
          modified_on?: string | null
          nummer?: number | null
          omschrijving?: string | null
          proces_status?: string | null
          raw_data?: Json | null
          relatie_id?: string | null
          synced_at?: string | null
          totaal_exclusief_btw?: number | null
          totaal_inclusief_btw?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_offertes_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "snelstart_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_relaties: {
        Row: {
          btw_nummer: string | null
          connection_id: string
          correspondentie_adres: Json | null
          email: string | null
          factuurkorting: number | null
          iban: string | null
          id: string
          krediettermijn: number | null
          kvk_nummer: string | null
          mobiele_telefoon: string | null
          modified_on: string | null
          naam: string | null
          non_actief: boolean | null
          raw_data: Json | null
          relatiecode: number | null
          relatiesoort: string[] | null
          synced_at: string | null
          telefoon: string | null
          vestigings_adres: Json | null
          website_url: string | null
        }
        Insert: {
          btw_nummer?: string | null
          connection_id: string
          correspondentie_adres?: Json | null
          email?: string | null
          factuurkorting?: number | null
          iban?: string | null
          id: string
          krediettermijn?: number | null
          kvk_nummer?: string | null
          mobiele_telefoon?: string | null
          modified_on?: string | null
          naam?: string | null
          non_actief?: boolean | null
          raw_data?: Json | null
          relatiecode?: number | null
          relatiesoort?: string[] | null
          synced_at?: string | null
          telefoon?: string | null
          vestigings_adres?: Json | null
          website_url?: string | null
        }
        Update: {
          btw_nummer?: string | null
          connection_id?: string
          correspondentie_adres?: Json | null
          email?: string | null
          factuurkorting?: number | null
          iban?: string | null
          id?: string
          krediettermijn?: number | null
          kvk_nummer?: string | null
          mobiele_telefoon?: string | null
          modified_on?: string | null
          naam?: string | null
          non_actief?: boolean | null
          raw_data?: Json | null
          relatiecode?: number | null
          relatiesoort?: string[] | null
          synced_at?: string | null
          telefoon?: string | null
          vestigings_adres?: Json | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_relaties_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "snelstart_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_sync_status: {
        Row: {
          connection_id: string
          created_at: string
          error_message: string | null
          id: string
          last_modified_filter: string | null
          last_sync_at: string | null
          resource_type: string
          status: string | null
          total_synced: number | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_modified_filter?: string | null
          last_sync_at?: string | null
          resource_type: string
          status?: string | null
          total_synced?: number | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_modified_filter?: string | null
          last_sync_at?: string | null
          resource_type?: string
          status?: string | null
          total_synced?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_sync_status_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "snelstart_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_verkoopfacturen: {
        Row: {
          connection_id: string
          factuur_bedrag: number | null
          factuur_datum: string | null
          factuurnummer: string | null
          id: string
          modified_on: string | null
          openstaand_saldo: number | null
          raw_data: Json | null
          relatie_id: string | null
          synced_at: string | null
          verkoop_boeking_id: string | null
          verval_datum: string | null
        }
        Insert: {
          connection_id: string
          factuur_bedrag?: number | null
          factuur_datum?: string | null
          factuurnummer?: string | null
          id: string
          modified_on?: string | null
          openstaand_saldo?: number | null
          raw_data?: Json | null
          relatie_id?: string | null
          synced_at?: string | null
          verkoop_boeking_id?: string | null
          verval_datum?: string | null
        }
        Update: {
          connection_id?: string
          factuur_bedrag?: number | null
          factuur_datum?: string | null
          factuurnummer?: string | null
          id?: string
          modified_on?: string | null
          openstaand_saldo?: number | null
          raw_data?: Json | null
          relatie_id?: string | null
          synced_at?: string | null
          verkoop_boeking_id?: string | null
          verval_datum?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_verkoopfacturen_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "snelstart_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      snelstart_verkooporders: {
        Row: {
          connection_id: string
          datum: string | null
          id: string
          modified_on: string | null
          nummer: number | null
          omschrijving: string | null
          proces_status: string | null
          raw_data: Json | null
          relatie_id: string | null
          synced_at: string | null
          totaal_exclusief_btw: number | null
          totaal_inclusief_btw: number | null
          verkoop_order_status: string | null
        }
        Insert: {
          connection_id: string
          datum?: string | null
          id: string
          modified_on?: string | null
          nummer?: number | null
          omschrijving?: string | null
          proces_status?: string | null
          raw_data?: Json | null
          relatie_id?: string | null
          synced_at?: string | null
          totaal_exclusief_btw?: number | null
          totaal_inclusief_btw?: number | null
          verkoop_order_status?: string | null
        }
        Update: {
          connection_id?: string
          datum?: string | null
          id?: string
          modified_on?: string | null
          nummer?: number | null
          omschrijving?: string | null
          proces_status?: string | null
          raw_data?: Json | null
          relatie_id?: string | null
          synced_at?: string | null
          totaal_exclusief_btw?: number | null
          totaal_inclusief_btw?: number | null
          verkoop_order_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snelstart_verkooporders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "snelstart_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_travel: boolean
          project_id: string | null
          started_at: string
          stopped_at: string | null
          user_id: string
          work_order_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_travel?: boolean
          project_id?: string | null
          started_at?: string
          stopped_at?: string | null
          user_id: string
          work_order_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_travel?: boolean
          project_id?: string | null
          started_at?: string
          stopped_at?: string | null
          user_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_storage: {
        Row: {
          brand: string | null
          company_id: string
          created_at: string
          dot_code: string | null
          id: string
          location_code: string | null
          notes: string | null
          season: string
          size: string | null
          status: string
          stored_at: string
          tread_depth_fl: number | null
          tread_depth_fr: number | null
          tread_depth_rl: number | null
          tread_depth_rr: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          brand?: string | null
          company_id: string
          created_at?: string
          dot_code?: string | null
          id?: string
          location_code?: string | null
          notes?: string | null
          season?: string
          size?: string | null
          status?: string
          stored_at?: string
          tread_depth_fl?: number | null
          tread_depth_fr?: number | null
          tread_depth_rl?: number | null
          tread_depth_rr?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          brand?: string | null
          company_id?: string
          created_at?: string
          dot_code?: string | null
          id?: string
          location_code?: string | null
          notes?: string | null
          season?: string
          size?: string | null
          status?: string
          stored_at?: string
          tread_depth_fl?: number | null
          tread_depth_fr?: number | null
          tread_depth_rl?: number | null
          tread_depth_rr?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tire_storage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_storage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_storage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          company_id: string | null
          completed: boolean
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          completed?: boolean
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "todos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_vehicles: {
        Row: {
          accessories: Json | null
          actual_sell_price: number | null
          appraisal_date: string | null
          appraised_by: string | null
          bpm_amount: number | null
          brand: string | null
          color: string | null
          company_id: string
          condition_score: number | null
          created_at: string
          damage_checklist: Json
          delivery_date: string | null
          delivery_package_id: string | null
          description_highlights: string[] | null
          description_nl: string | null
          estimated_repair_cost: number
          fuel_type: string | null
          general_notes: string | null
          hexon_stocknumber: string | null
          id: string
          license_plate: string | null
          mileage: number | null
          model: string | null
          nap_weblabel_status: string | null
          photo_count: number | null
          price_export: number | null
          price_trade: number | null
          purchase_price: number
          purchased_from_customer_id: string | null
          rdw_data: Json | null
          sold_at: string | null
          sold_to_customer_id: string | null
          source: string | null
          status: string
          supplier_name: string | null
          target_sell_price: number
          transmission: string | null
          transport_date: string | null
          updated_at: string
          video_url: string | null
          vin: string | null
          warranty_months: number | null
          work_order_id: string | null
          year: number | null
        }
        Insert: {
          accessories?: Json | null
          actual_sell_price?: number | null
          appraisal_date?: string | null
          appraised_by?: string | null
          bpm_amount?: number | null
          brand?: string | null
          color?: string | null
          company_id: string
          condition_score?: number | null
          created_at?: string
          damage_checklist?: Json
          delivery_date?: string | null
          delivery_package_id?: string | null
          description_highlights?: string[] | null
          description_nl?: string | null
          estimated_repair_cost?: number
          fuel_type?: string | null
          general_notes?: string | null
          hexon_stocknumber?: string | null
          id?: string
          license_plate?: string | null
          mileage?: number | null
          model?: string | null
          nap_weblabel_status?: string | null
          photo_count?: number | null
          price_export?: number | null
          price_trade?: number | null
          purchase_price?: number
          purchased_from_customer_id?: string | null
          rdw_data?: Json | null
          sold_at?: string | null
          sold_to_customer_id?: string | null
          source?: string | null
          status?: string
          supplier_name?: string | null
          target_sell_price?: number
          transmission?: string | null
          transport_date?: string | null
          updated_at?: string
          video_url?: string | null
          vin?: string | null
          warranty_months?: number | null
          work_order_id?: string | null
          year?: number | null
        }
        Update: {
          accessories?: Json | null
          actual_sell_price?: number | null
          appraisal_date?: string | null
          appraised_by?: string | null
          bpm_amount?: number | null
          brand?: string | null
          color?: string | null
          company_id?: string
          condition_score?: number | null
          created_at?: string
          damage_checklist?: Json
          delivery_date?: string | null
          delivery_package_id?: string | null
          description_highlights?: string[] | null
          description_nl?: string | null
          estimated_repair_cost?: number
          fuel_type?: string | null
          general_notes?: string | null
          hexon_stocknumber?: string | null
          id?: string
          license_plate?: string | null
          mileage?: number | null
          model?: string | null
          nap_weblabel_status?: string | null
          photo_count?: number | null
          price_export?: number | null
          price_trade?: number | null
          purchase_price?: number
          purchased_from_customer_id?: string | null
          rdw_data?: Json | null
          sold_at?: string | null
          sold_to_customer_id?: string | null
          source?: string | null
          status?: string
          supplier_name?: string | null
          target_sell_price?: number
          transmission?: string | null
          transport_date?: string | null
          updated_at?: string
          video_url?: string | null
          vin?: string | null
          warranty_months?: number | null
          work_order_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_vehicles_appraised_by_fkey"
            columns: ["appraised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_vehicles_purchased_from_customer_id_fkey"
            columns: ["purchased_from_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_vehicles_sold_to_customer_id_fkey"
            columns: ["sold_to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_vehicles_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_outlook_tokens: {
        Row: {
          company_id: string
          created_at: string
          id: string
          outlook_email: string | null
          outlook_refresh_token: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          outlook_email?: string | null
          outlook_refresh_token: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          outlook_email?: string | null
          outlook_refresh_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_outlook_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_outlook_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_mileage_logs: {
        Row: {
          company_id: string
          id: string
          mileage: number
          recorded_at: string
          recorded_by: string | null
          vehicle_id: string
          work_order_id: string | null
        }
        Insert: {
          company_id: string
          id?: string
          mileage: number
          recorded_at?: string
          recorded_by?: string | null
          vehicle_id: string
          work_order_id?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          mileage?: number
          recorded_at?: string
          recorded_by?: string | null
          vehicle_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_mileage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mileage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mileage_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mileage_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mileage_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          apk_expiry_date: string | null
          brand: string | null
          build_year: number | null
          color: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          fuel_type: string | null
          id: string
          license_plate: string
          mileage_current: number | null
          mileage_updated_at: string | null
          model: string | null
          notes: string | null
          rdw_data: Json | null
          registration_date: string | null
          status: string
          trade_vehicle_id: string | null
          updated_at: string
          vehicle_mass: number | null
          vin: string | null
        }
        Insert: {
          apk_expiry_date?: string | null
          brand?: string | null
          build_year?: number | null
          color?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          fuel_type?: string | null
          id?: string
          license_plate: string
          mileage_current?: number | null
          mileage_updated_at?: string | null
          model?: string | null
          notes?: string | null
          rdw_data?: Json | null
          registration_date?: string | null
          status?: string
          trade_vehicle_id?: string | null
          updated_at?: string
          vehicle_mass?: number | null
          vin?: string | null
        }
        Update: {
          apk_expiry_date?: string | null
          brand?: string | null
          build_year?: number | null
          color?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          fuel_type?: string | null
          id?: string
          license_plate?: string
          mileage_current?: number | null
          mileage_updated_at?: string | null
          model?: string | null
          notes?: string | null
          rdw_data?: Json | null
          registration_date?: string | null
          status?: string
          trade_vehicle_id?: string | null
          updated_at?: string
          vehicle_mass?: number | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_trade_vehicle_id_fkey"
            columns: ["trade_vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      voys_config: {
        Row: {
          ai_fallback: boolean | null
          api_base_url: string | null
          api_token: string | null
          click_to_dial_enabled: boolean | null
          client_uuid: string | null
          company_id: string
          created_at: string | null
          destination_number: string | null
          enrich_summary: boolean | null
          fallback_delay_seconds: number | null
          fetch_summary: boolean | null
          id: string
          phone_numbers: string[] | null
          record_calls: boolean | null
          status: string | null
          transcribe: boolean | null
          updated_at: string | null
          voipgrid_api_url: string | null
          webhook_secret: string | null
        }
        Insert: {
          ai_fallback?: boolean | null
          api_base_url?: string | null
          api_token?: string | null
          click_to_dial_enabled?: boolean | null
          client_uuid?: string | null
          company_id: string
          created_at?: string | null
          destination_number?: string | null
          enrich_summary?: boolean | null
          fallback_delay_seconds?: number | null
          fetch_summary?: boolean | null
          id?: string
          phone_numbers?: string[] | null
          record_calls?: boolean | null
          status?: string | null
          transcribe?: boolean | null
          updated_at?: string | null
          voipgrid_api_url?: string | null
          webhook_secret?: string | null
        }
        Update: {
          ai_fallback?: boolean | null
          api_base_url?: string | null
          api_token?: string | null
          click_to_dial_enabled?: boolean | null
          client_uuid?: string | null
          company_id?: string
          created_at?: string | null
          destination_number?: string | null
          enrich_summary?: boolean | null
          fallback_delay_seconds?: number | null
          fetch_summary?: boolean | null
          id?: string
          phone_numbers?: string[] | null
          record_calls?: boolean | null
          status?: string | null
          transcribe?: boolean | null
          updated_at?: string | null
          voipgrid_api_url?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voys_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voys_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automations: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "whatsapp_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token: string
          company_id: string | null
          display_phone: string | null
          id: string
          phone_number_id: string
          tenant_id: string | null
          updated_at: string | null
          waba_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token: string
          company_id?: string | null
          display_phone?: string | null
          id?: string
          phone_number_id: string
          tenant_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string
          company_id?: string | null
          display_phone?: string | null
          id?: string
          phone_number_id?: string
          tenant_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_materials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          material_id: string | null
          name: string
          notes: string | null
          quantity: number
          total: number
          unit: string
          unit_price: number
          work_order_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          material_id?: string | null
          name: string
          notes?: string | null
          quantity?: number
          total?: number
          unit?: string
          unit_price?: number
          work_order_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          material_id?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          total?: number
          unit?: string
          unit_price?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          address_id: string | null
          appointment_id: string | null
          asset_id: string | null
          assigned_to: string | null
          attachments: Json | null
          bay_id: string | null
          checklist: Json | null
          company_id: string
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          internal_notes: string | null
          mileage_end: number | null
          mileage_start: number | null
          notes: Json | null
          photos_after: string[] | null
          photos_before: string[] | null
          project_id: string | null
          project_phase_id: string | null
          quote_id: string | null
          remarks: string | null
          room_checklists: Json | null
          service_id: string | null
          share_token: string | null
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
          total_amount: number | null
          travel_cost: number
          vehicle_id: string | null
          vehicles_washed: Json | null
          vehicles_washed_total: number | null
          work_order_number: string | null
          work_order_type: string | null
        }
        Insert: {
          address_id?: string | null
          appointment_id?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          bay_id?: string | null
          checklist?: Json | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          mileage_end?: number | null
          mileage_start?: number | null
          notes?: Json | null
          photos_after?: string[] | null
          photos_before?: string[] | null
          project_id?: string | null
          project_phase_id?: string | null
          quote_id?: string | null
          remarks?: string | null
          room_checklists?: Json | null
          service_id?: string | null
          share_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          total_amount?: number | null
          travel_cost?: number
          vehicle_id?: string | null
          vehicles_washed?: Json | null
          vehicles_washed_total?: number | null
          work_order_number?: string | null
          work_order_type?: string | null
        }
        Update: {
          address_id?: string | null
          appointment_id?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          bay_id?: string | null
          checklist?: Json | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          mileage_end?: number | null
          mileage_start?: number | null
          notes?: Json | null
          photos_after?: string[] | null
          photos_before?: string[] | null
          project_id?: string | null
          project_phase_id?: string | null
          quote_id?: string | null
          remarks?: string | null
          room_checklists?: Json | null
          service_id?: string | null
          share_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          total_amount?: number | null
          travel_cost?: number
          vehicle_id?: string | null
          vehicles_washed?: Json | null
          vehicles_washed_total?: number | null
          work_order_number?: string | null
          work_order_type?: string | null
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
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_bay_id_fkey"
            columns: ["bay_id"]
            isOneToOne: false
            referencedRelation: "workshop_bays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_phase_id_fkey"
            columns: ["project_phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_bays: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workshop_bays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_bays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      companies_safe: {
        Row: {
          accounting_provider: string | null
          address: string | null
          admin_notes: string | null
          asset_field_config: Json | null
          billing_email: string | null
          brand_color: string | null
          btw_number: string | null
          city: string | null
          created_at: string | null
          custom_domain: string | null
          eboekhouden_debtor_ledger_id: number | null
          eboekhouden_ledger_id: number | null
          eboekhouden_template_id: number | null
          email_provider: string | null
          enabled_features: string[] | null
          has_eboekhouden_token: boolean | null
          has_moneybird_token: boolean | null
          has_rompslomp_token: boolean | null
          has_wefact_key: boolean | null
          iban: string | null
          id: string | null
          imap_host: string | null
          imap_port: number | null
          industry: string | null
          kvk_number: string | null
          last_active_at: string | null
          logo_url: string | null
          max_users: number | null
          moneybird_administration_id: string | null
          monthly_price: number | null
          name: string | null
          outlook_client_id: string | null
          outlook_email: string | null
          outlook_tenant_id: string | null
          phone: string | null
          postal_code: string | null
          pwa_icon_url: string | null
          pwa_name: string | null
          rompslomp_company_id: string | null
          rompslomp_company_name: string | null
          rompslomp_tenant_id: string | null
          slug: string | null
          smtp_email: string | null
          smtp_host: string | null
          smtp_port: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subcategory: string | null
          subscription_plan: string | null
          subscription_status: string | null
          sync_invoices_to_accounting: boolean | null
          sync_quotes_to_accounting: boolean | null
          trial_ends_at: string | null
        }
        Insert: {
          accounting_provider?: string | null
          address?: string | null
          admin_notes?: string | null
          asset_field_config?: Json | null
          billing_email?: string | null
          brand_color?: string | null
          btw_number?: string | null
          city?: string | null
          created_at?: string | null
          custom_domain?: string | null
          eboekhouden_debtor_ledger_id?: number | null
          eboekhouden_ledger_id?: number | null
          eboekhouden_template_id?: number | null
          email_provider?: string | null
          enabled_features?: string[] | null
          has_eboekhouden_token?: never
          has_moneybird_token?: never
          has_rompslomp_token?: never
          has_wefact_key?: never
          iban?: string | null
          id?: string | null
          imap_host?: string | null
          imap_port?: number | null
          industry?: string | null
          kvk_number?: string | null
          last_active_at?: string | null
          logo_url?: string | null
          max_users?: number | null
          moneybird_administration_id?: string | null
          monthly_price?: number | null
          name?: string | null
          outlook_client_id?: string | null
          outlook_email?: string | null
          outlook_tenant_id?: string | null
          phone?: string | null
          postal_code?: string | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          rompslomp_company_id?: string | null
          rompslomp_company_name?: string | null
          rompslomp_tenant_id?: string | null
          slug?: string | null
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subcategory?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          sync_invoices_to_accounting?: boolean | null
          sync_quotes_to_accounting?: boolean | null
          trial_ends_at?: string | null
        }
        Update: {
          accounting_provider?: string | null
          address?: string | null
          admin_notes?: string | null
          asset_field_config?: Json | null
          billing_email?: string | null
          brand_color?: string | null
          btw_number?: string | null
          city?: string | null
          created_at?: string | null
          custom_domain?: string | null
          eboekhouden_debtor_ledger_id?: number | null
          eboekhouden_ledger_id?: number | null
          eboekhouden_template_id?: number | null
          email_provider?: string | null
          enabled_features?: string[] | null
          has_eboekhouden_token?: never
          has_moneybird_token?: never
          has_rompslomp_token?: never
          has_wefact_key?: never
          iban?: string | null
          id?: string | null
          imap_host?: string | null
          imap_port?: number | null
          industry?: string | null
          kvk_number?: string | null
          last_active_at?: string | null
          logo_url?: string | null
          max_users?: number | null
          moneybird_administration_id?: string | null
          monthly_price?: number | null
          name?: string | null
          outlook_client_id?: string | null
          outlook_email?: string | null
          outlook_tenant_id?: string | null
          phone?: string | null
          postal_code?: string | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          rompslomp_company_id?: string | null
          rompslomp_company_name?: string | null
          rompslomp_tenant_id?: string | null
          slug?: string | null
          smtp_email?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subcategory?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          sync_invoices_to_accounting?: boolean | null
          sync_quotes_to_accounting?: boolean | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_company_stats: {
        Args: never
        Returns: {
          company_id: string
          customer_count: number
          user_count: number
          work_order_count: number
        }[]
      }
      get_my_companies: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          company_slug: string
          is_active: boolean
          is_default: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_my_company_id: { Args: never; Returns: string }
      get_portal_customer_id: { Args: never; Returns: string }
      get_usage_summary: {
        Args: { p_company_id?: string; p_end?: string; p_start?: string }
        Returns: {
          company_id: string
          event_count: number
          event_type: string
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _company_id: string
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_portal_user: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      switch_company: { Args: { target_company_id: string }; Returns: Json }
      verify_record_ownership: {
        Args: { p_company_id: string; p_record_id: string; p_table: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "monteur" | "super_admin" | "verkoop"
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
      app_role: ["admin", "monteur", "super_admin", "verkoop"],
    },
  },
} as const
