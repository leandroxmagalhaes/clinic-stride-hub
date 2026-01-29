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
      audit_logs: {
        Row: {
          action: string
          clinic_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          attachment_url: string | null
          channel: string
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          message_template: string
          name: string
          priority: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          channel?: string
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          priority?: number
          trigger_type: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          priority?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          clinic_id: string
          clinic_name: string | null
          created_at: string
          email_enabled: boolean | null
          id: string
          language: string | null
          logo_url: string | null
          primary_color: string | null
          sms_enabled: boolean | null
          timezone: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          clinic_id: string
          clinic_name?: string | null
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          language?: string | null
          logo_url?: string | null
          primary_color?: string | null
          sms_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          clinic_id?: string
          clinic_name?: string | null
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          language?: string | null
          logo_url?: string | null
          primary_color?: string | null
          sms_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
      clinics: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          clinic_id: string | null
          created_at: string
          description: string | null
          id: string
          monetary_value: number | null
          patient_id: string
          payment_method: string | null
          payment_status: string | null
          related_session_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          monetary_value?: number | null
          patient_id: string
          payment_method?: string | null
          payment_status?: string | null
          related_session_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          monetary_value?: number | null
          patient_id?: string
          payment_method?: string | null
          payment_status?: string | null
          related_session_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "credit_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "credit_transactions_related_session_id_fkey"
            columns: ["related_session_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes: {
        Row: {
          anexos: Json | null
          clinic_id: string
          conteudo: string
          created_at: string
          created_by: string | null
          id: string
          patient_id: string
          professional_id: string
          session_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: Json | null
          clinic_id: string
          conteudo: string
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id: string
          professional_id: string
          session_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: Json | null
          clinic_id?: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id?: string
          professional_id?: string
          session_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolucoes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolucoes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes_clinicas: {
        Row: {
          anexos_urls: string[] | null
          clinic_id: string
          created_at: string
          descricao: string
          escala_dor: number | null
          id: string
          profissional_id: string
          prontuario_id: string
          sessao_id: string | null
          specialty_id: string | null
          structured_data: Json | null
        }
        Insert: {
          anexos_urls?: string[] | null
          clinic_id: string
          created_at?: string
          descricao: string
          escala_dor?: number | null
          id?: string
          profissional_id: string
          prontuario_id: string
          sessao_id?: string | null
          specialty_id?: string | null
          structured_data?: Json | null
        }
        Update: {
          anexos_urls?: string[] | null
          clinic_id?: string
          created_at?: string
          descricao?: string
          escala_dor?: number | null
          id?: string
          profissional_id?: string
          prontuario_id?: string
          sessao_id?: string | null
          specialty_id?: string | null
          structured_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_clinicas_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_clinicas_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_clinicas_prontuario_id_fkey"
            columns: ["prontuario_id"]
            isOneToOne: false
            referencedRelation: "prontuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_clinicas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_clinicas_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialty_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          address: string | null
          birth_date: string | null
          clinic_id: string
          cpf: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          full_name: string
          gender: string | null
          health_insurance: string | null
          health_tags: string[] | null
          id: string
          initial_assessment_data: Json | null
          is_active: boolean | null
          notes: string | null
          phone: string | null
          primary_specialty_id: string | null
          privacy_consent_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          clinic_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name: string
          gender?: string | null
          health_insurance?: string | null
          health_tags?: string[] | null
          id?: string
          initial_assessment_data?: Json | null
          is_active?: boolean | null
          notes?: string | null
          phone?: string | null
          primary_specialty_id?: string | null
          privacy_consent_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          clinic_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string
          gender?: string | null
          health_insurance?: string | null
          health_tags?: string[] | null
          id?: string
          initial_assessment_data?: Json | null
          is_active?: boolean | null
          notes?: string | null
          phone?: string | null
          primary_specialty_id?: string | null
          privacy_consent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_primary_specialty_id_fkey"
            columns: ["primary_specialty_id"]
            isOneToOne: false
            referencedRelation: "specialty_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_diary: {
        Row: {
          activity_description: string
          clinic_id: string | null
          created_at: string
          entry_date: string
          id: string
          notes: string | null
          pain_level: number
          patient_id: string
          updated_at: string
        }
        Insert: {
          activity_description: string
          clinic_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          pain_level: number
          patient_id: string
          updated_at?: string
        }
        Update: {
          activity_description?: string
          clinic_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          pain_level?: number
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_diary_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_feedback: {
        Row: {
          clinic_id: string
          comment: string | null
          created_at: string
          id: string
          patient_id: string
          score: number
        }
        Insert: {
          clinic_id: string
          comment?: string | null
          created_at?: string
          id?: string
          patient_id: string
          score: number
        }
        Update: {
          clinic_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_feedback_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      professional_patient_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          clinic_id: string
          id: string
          patient_id: string
          professional_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          clinic_id: string
          id?: string
          patient_id: string
          professional_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          clinic_id?: string
          id?: string
          patient_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_patient_assignments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "professional_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "professional_patient_assignments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clinic_id: string | null
          created_at: string
          crefito: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          crefito?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          crefito?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais: {
        Row: {
          avatar_url: string | null
          clinic_id: string
          council_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          specialty: string | null
          updated_at: string
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          clinic_id: string
          council_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string
          council_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuarios: {
        Row: {
          anamnese: string | null
          clinic_id: string
          created_at: string
          diagnostico: string | null
          id: string
          objetivos: string | null
          observacoes: string | null
          paciente_id: string
          updated_at: string
        }
        Insert: {
          anamnese?: string | null
          clinic_id: string
          created_at?: string
          diagnostico?: string | null
          id?: string
          objetivos?: string | null
          observacoes?: string | null
          paciente_id: string
          updated_at?: string
        }
        Update: {
          anamnese?: string | null
          clinic_id?: string
          created_at?: string
          diagnostico?: string | null
          id?: string
          objetivos?: string | null
          observacoes?: string | null
          paciente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuarios_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuarios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuarios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "prontuarios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          clinic_id: string
          converted_at: string | null
          converted_patient_id: string | null
          created_at: string
          email: string | null
          estimated_value: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          converted_at?: string | null
          converted_patient_id?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          converted_at?: string | null
          converted_patient_id?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "sales_leads_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      servicos: {
        Row: {
          clinic_id: string
          color: string | null
          consumes_credit: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          color?: string | null
          consumes_credit?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          color?: string | null
          consumes_credit?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          end_time: string
          gympass_booking_id: string | null
          id: string
          notes: string | null
          paciente_id: string
          payment_method: string | null
          payment_status: string | null
          price: number | null
          profissional_id: string
          servico_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          gympass_booking_id?: string | null
          id?: string
          notes?: string | null
          paciente_id: string
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          profissional_id: string
          servico_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          gympass_booking_id?: string | null
          id?: string
          notes?: string | null
          paciente_id?: string
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          profissional_id?: string
          servico_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "sessoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      specialty_templates: {
        Row: {
          clinic_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          schema: Json
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          schema: Json
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          schema?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialty_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_credito: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          expira_em: string | null
          id: string
          metodo_pagamento: string | null
          motivo: string | null
          package_id: string | null
          patient_id: string
          quantidade: number
          session_id: string | null
          tipo: string
          valor_pago: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          expira_em?: string | null
          id?: string
          metodo_pagamento?: string | null
          motivo?: string | null
          package_id?: string | null
          patient_id: string
          quantidade: number
          session_id?: string | null
          tipo: string
          valor_pago?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          expira_em?: string | null
          id?: string
          metodo_pagamento?: string | null
          motivo?: string | null
          package_id?: string | null
          patient_id?: string
          quantidade?: number
          session_id?: string | null
          tipo?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_credito_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_credito_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_credito_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "transacoes_credito_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "saldo_creditos"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "transacoes_credito_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
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
    }
    Views: {
      patient_credit_balances: {
        Row: {
          balance: number | null
          clinic_id: string | null
          full_name: string | null
          patient_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      saldo_creditos: {
        Row: {
          clinic_id: string | null
          full_name: string | null
          patient_id: string | null
          saldo: number | null
          total_compras: number | null
          ultima_compra: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_patient_balance: { Args: { p_patient_id: string }; Returns: number }
      get_patient_credit_balance: {
        Args: { p_patient_id: string }
        Returns: number
      }
      get_user_clinic_id: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      professional_can_access_patient: {
        Args: { p_patient_id: string; p_user_id: string }
        Returns: boolean
      }
      professional_can_access_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "professional" | "patient" | "secretary"
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
      app_role: ["admin", "professional", "patient", "secretary"],
    },
  },
} as const
