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
      ai_usage_logs: {
        Row: {
          action: string
          clinic_id: string
          created_at: string
          duration_ms: number | null
          error_code: string | null
          feature: string
          id: string
          model: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          action?: string
          clinic_id: string
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          feature: string
          id?: string
          model?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          feature?: string
          id?: string
          model?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
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
      automation_logs: {
        Row: {
          channel: string | null
          clinic_id: string
          error_message: string | null
          flow_id: string | null
          id: string
          paciente_id: string | null
          recipient_email: string | null
          sent_at: string | null
          sessao_id: string | null
          status: string | null
          subject: string | null
          trigger_type: string | null
        }
        Insert: {
          channel?: string | null
          clinic_id: string
          error_message?: string | null
          flow_id?: string | null
          id?: string
          paciente_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          sessao_id?: string | null
          status?: string | null
          subject?: string | null
          trigger_type?: string | null
        }
        Update: {
          channel?: string | null
          clinic_id?: string
          error_message?: string | null
          flow_id?: string | null
          id?: string
          paciente_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          sessao_id?: string | null
          status?: string | null
          subject?: string | null
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "automation_logs_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_fixos: {
        Row: {
          ativo: boolean | null
          clinic_id: string | null
          created_at: string | null
          especialidade: string | null
          frequencia: string
          id: string
          nome: string
          paciente_id: string | null
          sessoes_por_periodo: number
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          especialidade?: string | null
          frequencia?: string
          id?: string
          nome: string
          paciente_id?: string | null
          sessoes_por_periodo?: number
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          especialidade?: string | null
          frequencia?: string
          id?: string
          nome?: string
          paciente_id?: string | null
          sessoes_por_periodo?: number
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          ai_clinical_enabled: boolean
          ai_enabled: boolean
          ai_management_enabled: boolean
          clinic_id: string
          clinic_name: string | null
          confirmacao_dia_anterior_ativo: boolean
          confirmacao_hora_corte: string
          confirmacao_saudacao: string | null
          created_at: string
          email_enabled: boolean | null
          iban: string | null
          iban_nome: string | null
          id: string
          language: string | null
          logo_url: string | null
          mbway_nome_1: string | null
          mbway_nome_2: string | null
          mbway_numero_1: string | null
          mbway_numero_2: string | null
          notificar_clinica_email_remarcacao: boolean
          primary_color: string | null
          reminder_antecedencia_horas: number
          reminder_ativo: boolean
          reminder_saudacao: string | null
          sms_enabled: boolean | null
          timezone: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          ai_clinical_enabled?: boolean
          ai_enabled?: boolean
          ai_management_enabled?: boolean
          clinic_id: string
          clinic_name?: string | null
          confirmacao_dia_anterior_ativo?: boolean
          confirmacao_hora_corte?: string
          confirmacao_saudacao?: string | null
          created_at?: string
          email_enabled?: boolean | null
          iban?: string | null
          iban_nome?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          mbway_nome_1?: string | null
          mbway_nome_2?: string | null
          mbway_numero_1?: string | null
          mbway_numero_2?: string | null
          notificar_clinica_email_remarcacao?: boolean
          primary_color?: string | null
          reminder_antecedencia_horas?: number
          reminder_ativo?: boolean
          reminder_saudacao?: string | null
          sms_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          ai_clinical_enabled?: boolean
          ai_enabled?: boolean
          ai_management_enabled?: boolean
          clinic_id?: string
          clinic_name?: string | null
          confirmacao_dia_anterior_ativo?: boolean
          confirmacao_hora_corte?: string
          confirmacao_saudacao?: string | null
          created_at?: string
          email_enabled?: boolean | null
          iban?: string | null
          iban_nome?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          mbway_nome_1?: string | null
          mbway_nome_2?: string | null
          mbway_numero_1?: string | null
          mbway_numero_2?: string | null
          notificar_clinica_email_remarcacao?: boolean
          primary_color?: string | null
          reminder_antecedencia_horas?: number
          reminder_ativo?: boolean
          reminder_saudacao?: string | null
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
          slug: string
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
          slug: string
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
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          clinic_id: string
          content: string
          created_at: string
          file_name: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          content?: string
          created_at?: string
          file_name?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string
          file_name?: string | null
          id?: string
          role?: string
          user_id?: string
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
            foreignKeyName: "credit_transactions_related_session_id_fkey"
            columns: ["related_session_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas_auditoria: {
        Row: {
          accao: string
          clinic_id: string
          created_at: string
          etiqueta_cor: string | null
          etiqueta_id: string | null
          etiqueta_nome: string
          id: string
          paciente_id: string
          realizado_por: string
          realizado_por_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          accao: string
          clinic_id: string
          created_at?: string
          etiqueta_cor?: string | null
          etiqueta_id?: string | null
          etiqueta_nome: string
          id?: string
          paciente_id: string
          realizado_por: string
          realizado_por_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          accao?: string
          clinic_id?: string
          created_at?: string
          etiqueta_cor?: string | null
          etiqueta_id?: string | null
          etiqueta_nome?: string
          id?: string
          paciente_id?: string
          realizado_por?: string
          realizado_por_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
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
      horarios_reservados: {
        Row: {
          clinic_id: string
          cor: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          dias_semana: number[] | null
          duracao_minutos: number
          horario_inicio: string
          horarios_personalizados: Json | null
          id: string
          observacoes: string | null
          patient_id: string
          professional_id: string | null
          service_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          dias_semana?: number[] | null
          duracao_minutos?: number
          horario_inicio: string
          horarios_personalizados?: Json | null
          id?: string
          observacoes?: string | null
          patient_id: string
          professional_id?: string | null
          service_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          dias_semana?: number[] | null
          duracao_minutos?: number
          horario_inicio?: string
          horarios_personalizados?: Json | null
          id?: string
          observacoes?: string | null
          patient_id?: string
          professional_id?: string | null
          service_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_reservados_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_reservados_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_reservados_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "horarios_reservados_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_reservados_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      import_queue: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          import_date: string | null
          match_confidence: number | null
          raw_data: Json
          status: string
          suggested_patient_id: string | null
          suggested_service_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          import_date?: string | null
          match_confidence?: number | null
          raw_data: Json
          status?: string
          suggested_patient_id?: string | null
          suggested_service_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          import_date?: string | null
          match_confidence?: number | null
          raw_data?: Json
          status?: string
          suggested_patient_id?: string | null
          suggested_service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_queue_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_queue_suggested_patient_id_fkey"
            columns: ["suggested_patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_queue_suggested_patient_id_fkey"
            columns: ["suggested_patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "import_queue_suggested_service_id_fkey"
            columns: ["suggested_service_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_espera: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          especialidade: string
          id: string
          nome: string
          observacoes: string | null
          prioridade: string
          telefone: string
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          especialidade: string
          id?: string
          nome: string
          observacoes?: string | null
          prioridade?: string
          telefone: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          especialidade?: string
          id?: string
          nome?: string
          observacoes?: string | null
          prioridade?: string
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lista_espera_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_lembretes: {
        Row: {
          clinic_id: string | null
          concluida: boolean | null
          created_at: string | null
          data_prazo: string | null
          id: string
          texto: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          concluida?: boolean | null
          created_at?: string | null
          data_prazo?: string | null
          id?: string
          texto: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          concluida?: boolean | null
          created_at?: string | null
          data_prazo?: string | null
          id?: string
          texto?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_lembretes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          message: string
          patient_id: string | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          message: string
          patient_id?: string | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          message?: string
          patient_id?: string | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      paciente_etiquetas: {
        Row: {
          clinic_id: string
          cor: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          nome: string
          paciente_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          cor?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nome: string
          paciente_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          cor?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nome?: string
          paciente_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          address: string | null
          billing_address: Json | null
          billing_name: string | null
          billing_nif: string | null
          birth_date: string | null
          clinic_id: string
          cpf: string | null
          created_at: string
          data_consent: boolean
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          full_name: string
          gender: string | null
          health_insurance: string | null
          health_tags: string[] | null
          height_cm: number | null
          id: string
          image_consent: boolean
          initial_assessment_data: Json | null
          is_active: boolean | null
          notes: string | null
          onboarding_completed_at: string | null
          phone: string | null
          primary_specialty_id: string | null
          privacy_consent_at: string | null
          public_token: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          billing_address?: Json | null
          billing_name?: string | null
          billing_nif?: string | null
          birth_date?: string | null
          clinic_id: string
          cpf?: string | null
          created_at?: string
          data_consent?: boolean
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name: string
          gender?: string | null
          health_insurance?: string | null
          health_tags?: string[] | null
          height_cm?: number | null
          id?: string
          image_consent?: boolean
          initial_assessment_data?: Json | null
          is_active?: boolean | null
          notes?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          primary_specialty_id?: string | null
          privacy_consent_at?: string | null
          public_token?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          billing_address?: Json | null
          billing_name?: string | null
          billing_nif?: string | null
          birth_date?: string | null
          clinic_id?: string
          cpf?: string | null
          created_at?: string
          data_consent?: boolean
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string
          gender?: string | null
          health_insurance?: string | null
          health_tags?: string[] | null
          height_cm?: number | null
          id?: string
          image_consent?: boolean
          initial_assessment_data?: Json | null
          is_active?: boolean | null
          notes?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          primary_specialty_id?: string | null
          privacy_consent_at?: string | null
          public_token?: string
          updated_at?: string
          weight_kg?: number | null
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
      pacientes_acessos_recentes: {
        Row: {
          acessado_em: string
          id: string
          paciente_id: string
          user_id: string
        }
        Insert: {
          acessado_em?: string
          id?: string
          paciente_id: string
          user_id: string
        }
        Update: {
          acessado_em?: string
          id?: string
          paciente_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_acessos_recentes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_acessos_recentes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      pacientes_excluidos: {
        Row: {
          clinic_id: string | null
          dados_paciente: Json
          excluido_em: string | null
          excluido_por: string | null
          id: string
          motivo: string | null
          paciente_id_original: string | null
        }
        Insert: {
          clinic_id?: string | null
          dados_paciente: Json
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          motivo?: string | null
          paciente_id_original?: string | null
        }
        Update: {
          clinic_id?: string | null
          dados_paciente?: Json
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          motivo?: string | null
          paciente_id_original?: string | null
        }
        Relationships: []
      }
      packs: {
        Row: {
          clinic_id: string
          created_at: string
          data_inicio: string
          data_validade: string | null
          id: string
          notes: string | null
          numero_pack: number
          paciente_id: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          status: string
          total_sessoes: number
          updated_at: string
          valor_total: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          data_inicio?: string
          data_validade?: string | null
          id?: string
          notes?: string | null
          numero_pack: number
          paciente_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          status?: string
          total_sessoes: number
          updated_at?: string
          valor_total?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          data_inicio?: string
          data_validade?: string | null
          id?: string
          notes?: string | null
          numero_pack?: number
          paciente_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          status?: string
          total_sessoes?: number
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "packs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
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
      patient_documents: {
        Row: {
          category: string
          clinic_id: string
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          paciente_id: string
          prontuario_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          clinic_id: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          paciente_id: string
          prontuario_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          paciente_id?: string
          prontuario_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_documents_prontuario_id_fkey"
            columns: ["prontuario_id"]
            isOneToOne: false
            referencedRelation: "prontuarios"
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
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          ifthenpay_request_id: string | null
          invoice_issued: boolean
          mb_entity: string | null
          mb_reference: string | null
          mbway_phone: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          patient_id: string
          session_id: string
          status: Database["public"]["Enums"]["payment_status"]
          toconline_invoice_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          clinic_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ifthenpay_request_id?: string | null
          invoice_issued?: boolean
          mb_entity?: string | null
          mb_reference?: string | null
          mbway_phone?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          patient_id: string
          session_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          toconline_invoice_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          clinic_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ifthenpay_request_id?: string | null
          invoice_issued?: boolean
          mb_entity?: string | null
          mb_reference?: string | null
          mbway_phone?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          patient_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          toconline_invoice_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_conta_pacientes: {
        Row: {
          conta_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          paciente_id: string
          relacao: string | null
        }
        Insert: {
          conta_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          paciente_id: string
          relacao?: string | null
        }
        Update: {
          conta_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          paciente_id?: string
          relacao?: string | null
        }
        Relationships: []
      }
      portal_contas: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string | null
          id: string
          onboarding_completo: boolean | null
          paciente_id: string
          provider: string | null
          status: string | null
          ultimo_acesso: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          onboarding_completo?: boolean | null
          paciente_id: string
          provider?: string | null
          status?: string | null
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          onboarding_completo?: boolean | null
          paciente_id?: string
          provider?: string | null
          status?: string | null
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      portal_convites: {
        Row: {
          codigo: string
          created_at: string | null
          enviado_para_email: string | null
          enviado_para_telefone: string | null
          expira_em: string
          id: string
          link_token: string
          max_tentativas: number | null
          paciente_id: string
          template_id: string | null
          tentativas: number | null
          tipo: string
          utilizado: boolean | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          enviado_para_email?: string | null
          enviado_para_telefone?: string | null
          expira_em: string
          id?: string
          link_token: string
          max_tentativas?: number | null
          paciente_id: string
          template_id?: string | null
          tentativas?: number | null
          tipo?: string
          utilizado?: boolean | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          enviado_para_email?: string | null
          enviado_para_telefone?: string | null
          expira_em?: string
          id?: string
          link_token?: string
          max_tentativas?: number | null
          paciente_id?: string
          template_id?: string | null
          tentativas?: number | null
          tipo?: string
          utilizado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_convites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "portal_questionario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_diario: {
        Row: {
          autor_nome: string
          categoria: string | null
          created_at: string | null
          foto_url: string | null
          humor: string | null
          id: string
          nivel_dor: number | null
          paciente_id: string
          tem_foto: boolean | null
          texto: string
        }
        Insert: {
          autor_nome: string
          categoria?: string | null
          created_at?: string | null
          foto_url?: string | null
          humor?: string | null
          id?: string
          nivel_dor?: number | null
          paciente_id: string
          tem_foto?: boolean | null
          texto: string
        }
        Update: {
          autor_nome?: string
          categoria?: string | null
          created_at?: string | null
          foto_url?: string | null
          humor?: string | null
          id?: string
          nivel_dor?: number | null
          paciente_id?: string
          tem_foto?: boolean | null
          texto?: string
        }
        Relationships: []
      }
      portal_mensagens: {
        Row: {
          autor_id: string | null
          autor_nome: string
          autor_tipo: string
          broadcast_id: string | null
          categoria: string | null
          created_at: string
          humor: string | null
          id: string
          lida_em: string | null
          nivel_dor: number | null
          paciente_id: string
          texto: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome: string
          autor_tipo: string
          broadcast_id?: string | null
          categoria?: string | null
          created_at?: string
          humor?: string | null
          id?: string
          lida_em?: string | null
          nivel_dor?: number | null
          paciente_id: string
          texto: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string
          autor_tipo?: string
          broadcast_id?: string | null
          categoria?: string | null
          created_at?: string
          humor?: string | null
          id?: string
          lida_em?: string | null
          nivel_dor?: number | null
          paciente_id?: string
          texto?: string
          tipo?: string
        }
        Relationships: []
      }
      portal_notificacoes: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          paciente_id: string
          referencia_id: string | null
          texto_preview: string | null
          tipo: string
          titulo: string
          urgente: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          paciente_id: string
          referencia_id?: string | null
          texto_preview?: string | null
          tipo: string
          titulo: string
          urgente?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          paciente_id?: string
          referencia_id?: string | null
          texto_preview?: string | null
          tipo?: string
          titulo?: string
          urgente?: boolean | null
        }
        Relationships: []
      }
      portal_questionario: {
        Row: {
          completo: boolean | null
          created_at: string | null
          dados_pessoais: Json | null
          expectativas: Json | null
          id: string
          paciente_id: string
          perfil_saude: Json | null
          perfil_tipo: string
          respostas: Json | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          completo?: boolean | null
          created_at?: string | null
          dados_pessoais?: Json | null
          expectativas?: Json | null
          id?: string
          paciente_id: string
          perfil_saude?: Json | null
          perfil_tipo: string
          respostas?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completo?: boolean | null
          created_at?: string | null
          dados_pessoais?: Json | null
          expectativas?: Json | null
          id?: string
          paciente_id?: string
          perfil_saude?: Json | null
          perfil_tipo?: string
          respostas?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_questionario_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "portal_questionario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_questionario_historico: {
        Row: {
          alterado_por: string
          campo_alterado: string
          created_at: string | null
          id: string
          paciente_id: string
          questionario_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por: string
          campo_alterado: string
          created_at?: string | null
          id?: string
          paciente_id: string
          questionario_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string
          campo_alterado?: string
          created_at?: string | null
          id?: string
          paciente_id?: string
          questionario_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      portal_questionario_templates: {
        Row: {
          clinic_id: string | null
          created_at: string
          description: string | null
          estimated_minutes: string | null
          id: string
          identifier: string
          is_active: boolean
          is_system: boolean
          name: string
          schema: Json
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: string | null
          id?: string
          identifier: string
          is_active?: boolean
          is_system?: boolean
          name: string
          schema: Json
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: string | null
          id?: string
          identifier?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          schema?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_questionario_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_respostas: {
        Row: {
          autor_nome: string
          autor_tipo: string
          created_at: string | null
          diario_id: string
          id: string
          texto: string
        }
        Insert: {
          autor_nome: string
          autor_tipo?: string
          created_at?: string | null
          diario_id: string
          id?: string
          texto: string
        }
        Update: {
          autor_nome?: string
          autor_tipo?: string
          created_at?: string | null
          diario_id?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_respostas_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "portal_diario"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_seguranca_auditoria: {
        Row: {
          accao: string
          clinic_id: string
          created_at: string
          detalhes: Json | null
          id: string
          paciente_id: string
          realizado_por: string
          realizado_por_email: string | null
          realizado_por_nome: string | null
        }
        Insert: {
          accao: string
          clinic_id: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          paciente_id: string
          realizado_por: string
          realizado_por_email?: string | null
          realizado_por_nome?: string | null
        }
        Update: {
          accao?: string
          clinic_id?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          paciente_id?: string
          realizado_por?: string
          realizado_por_email?: string | null
          realizado_por_nome?: string | null
        }
        Relationships: []
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
          portal_role: string | null
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
          portal_role?: string | null
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
          portal_role?: string | null
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
        ]
      }
      relatorios_clinicos: {
        Row: {
          clinic_id: string
          conteudo: string | null
          created_at: string | null
          created_by: string | null
          data_validade: string | null
          destinatario_especialidade: string | null
          destinatario_identificacao: string | null
          destinatario_nome: string | null
          diagnostico_clinico: string | null
          dias_aviso_antecedencia: number | null
          entregue_em: string | null
          enviado_em: string | null
          evolucao_paciente: string | null
          id: string
          objetivo_tratamento: string | null
          observacoes: string | null
          patient_id: string
          periodo_fim: string
          periodo_inicio: string
          professional_id: string
          recomendacoes: string | null
          resultados_obtidos: string | null
          sessoes_realizadas: number | null
          status: string | null
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          conteudo?: string | null
          created_at?: string | null
          created_by?: string | null
          data_validade?: string | null
          destinatario_especialidade?: string | null
          destinatario_identificacao?: string | null
          destinatario_nome?: string | null
          diagnostico_clinico?: string | null
          dias_aviso_antecedencia?: number | null
          entregue_em?: string | null
          enviado_em?: string | null
          evolucao_paciente?: string | null
          id?: string
          objetivo_tratamento?: string | null
          observacoes?: string | null
          patient_id: string
          periodo_fim: string
          periodo_inicio: string
          professional_id: string
          recomendacoes?: string | null
          resultados_obtidos?: string | null
          sessoes_realizadas?: number | null
          status?: string | null
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          conteudo?: string | null
          created_at?: string | null
          created_by?: string | null
          data_validade?: string | null
          destinatario_especialidade?: string | null
          destinatario_identificacao?: string | null
          destinatario_nome?: string | null
          diagnostico_clinico?: string | null
          dias_aviso_antecedencia?: number | null
          entregue_em?: string | null
          enviado_em?: string | null
          evolucao_paciente?: string | null
          id?: string
          objetivo_tratamento?: string | null
          observacoes?: string | null
          patient_id?: string
          periodo_fim?: string
          periodo_inicio?: string
          professional_id?: string
          recomendacoes?: string | null
          resultados_obtidos?: string | null
          sessoes_realizadas?: number | null
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_clinicos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_clinicos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_clinicos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "relatorios_clinicos_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          canal: string
          created_at: string
          enviado_em: string
          id: string
          sessao_id: string
        }
        Insert: {
          canal?: string
          created_at?: string
          enviado_em?: string
          id?: string
          sessao_id: string
        }
        Update: {
          canal?: string
          created_at?: string
          enviado_em?: string
          id?: string
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      respiratory_reports: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          created_by: string | null
          data: Json
          id: string
          patient_name: string
          report_date: string
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data: Json
          id?: string
          patient_name: string
          report_date?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json
          id?: string
          patient_name?: string
          report_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respiratory_reports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          clinic_id: string
          id: string
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          id?: string
          permissions?: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
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
      session_briefings: {
        Row: {
          briefing_data: Json
          clinic_id: string
          expires_at: string | null
          generated_at: string
          id: string
          patient_id: string
          session_id: string
        }
        Insert: {
          briefing_data: Json
          clinic_id: string
          expires_at?: string | null
          generated_at?: string
          id?: string
          patient_id: string
          session_id: string
        }
        Update: {
          briefing_data?: Json
          clinic_id?: string
          expires_at?: string | null
          generated_at?: string
          id?: string
          patient_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_briefings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_briefings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_briefings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "session_briefings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          clinic_id: string
          confirmacao_em: string | null
          confirmacao_estado: string
          confirmation_token: string
          created_at: string
          created_by: string | null
          end_time: string
          gympass_booking_id: string | null
          id: string
          isento: boolean
          isento_em: string | null
          isento_motivo: string | null
          isento_por: string | null
          notes: string | null
          numero_no_pack: number | null
          paciente_id: string
          pack_id: string | null
          pagamento_data: string | null
          pagamento_estado: string | null
          pagamento_metodo: string | null
          payment_method: string | null
          payment_status: string | null
          price: number | null
          profissional_id: string
          servico_id: string | null
          start_time: string
          status: string
          tipo_agendamento: string
          updated_at: string
          valor_sessao: number | null
        }
        Insert: {
          clinic_id: string
          confirmacao_em?: string | null
          confirmacao_estado?: string
          confirmation_token?: string
          created_at?: string
          created_by?: string | null
          end_time: string
          gympass_booking_id?: string | null
          id?: string
          isento?: boolean
          isento_em?: string | null
          isento_motivo?: string | null
          isento_por?: string | null
          notes?: string | null
          numero_no_pack?: number | null
          paciente_id: string
          pack_id?: string | null
          pagamento_data?: string | null
          pagamento_estado?: string | null
          pagamento_metodo?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          profissional_id: string
          servico_id?: string | null
          start_time: string
          status?: string
          tipo_agendamento?: string
          updated_at?: string
          valor_sessao?: number | null
        }
        Update: {
          clinic_id?: string
          confirmacao_em?: string | null
          confirmacao_estado?: string
          confirmation_token?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          gympass_booking_id?: string | null
          id?: string
          isento?: boolean
          isento_em?: string | null
          isento_motivo?: string | null
          isento_por?: string | null
          notes?: string | null
          numero_no_pack?: number | null
          paciente_id?: string
          pack_id?: string | null
          pagamento_data?: string | null
          pagamento_estado?: string | null
          pagamento_metodo?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          profissional_id?: string
          servico_id?: string | null
          start_time?: string
          status?: string
          tipo_agendamento?: string
          updated_at?: string
          valor_sessao?: number | null
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
            foreignKeyName: "sessoes_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
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
      team_invites: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      v_pending_payments: {
        Row: {
          amount: number | null
          clinic_id: string | null
          created_at: string | null
          id: string | null
          mb_entity: string | null
          mb_reference: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          patient_id: string | null
          patient_name: string | null
          patient_phone: string | null
          pending_for: string | null
          session_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_credit_balances"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      batch_insert_sessions: { Args: { p_sessions: Json }; Returns: number }
      cancel_session_with_pack_rule: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: Json
      }
      check_horario_reservado: {
        Args: { p_date: string; p_professional_id?: string; p_time: string }
        Returns: {
          cor: string
          patient_id: string
          patient_name: string
          reservado: boolean
          reservation_id: string
          tipo: string
          titulo: string
        }[]
      }
      ensure_portal_account_link: {
        Args: {
          p_email?: string
          p_link_token?: string
          p_paciente_id: string
          p_provider?: string
        }
        Returns: string
      }
      enviar_mensagem_unificada: {
        Args: {
          p_autor_nome: string
          p_autor_tipo: string
          p_categoria?: string
          p_humor?: string
          p_nivel_dor?: number
          p_paciente_id: string
          p_texto: string
          p_tipo?: string
        }
        Returns: string
      }
      expire_packs: { Args: never; Returns: number }
      get_invite_details: { Args: { invite_token: string }; Returns: Json }
      get_patient_balance: { Args: { p_patient_id: string }; Returns: number }
      get_patient_credit_balance: {
        Args: { p_patient_id: string }
        Returns: number
      }
      get_pending_team_invite_for_me: {
        Args: never
        Returns: {
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }[]
      }
      get_portal_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          codigo: string
          enviado_para_email: string
          expira_em: string
          id: string
          max_tentativas: number
          paciente_id: string
          template_id: string
          tentativas: number
          tipo: string
          utilizado: boolean
        }[]
      }
      get_portal_patient_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_team_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          clinic_id: string
          email: string
          expires_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      get_user_clinic_id: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_portal_invite_attempts: {
        Args: { p_token: string }
        Returns: number
      }
      is_professional: { Args: { p_user_id: string }; Returns: boolean }
      isentar_falta_cobrada: {
        Args: { p_motivo: string; p_session_id: string }
        Returns: undefined
      }
      list_portal_conversations: {
        Args: { p_clinic_id: string }
        Returns: {
          nao_lidas: number
          paciente_email: string
          paciente_id: string
          paciente_nome: string
          ultima_autor_tipo: string
          ultima_mensagem: string
          ultima_mensagem_em: string
        }[]
      }
      listar_conversas_recentes: {
        Args: never
        Returns: {
          nao_lidas: number
          paciente_id: string
          paciente_nome: string
          ultima_data: string
          ultima_mensagem: string
          ultima_origem: string
        }[]
      }
      listar_pacientes_para_atalho: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          acessado_em: string
          nao_lidas: number
          paciente_id: string
          paciente_nome: string
          portal_activo: boolean
          ultima_data: string
          ultima_mensagem: string
        }[]
      }
      listar_thread_unificado: {
        Args: { p_paciente_id: string }
        Returns: {
          autor_nome: string
          autor_tipo: string
          categoria: string
          created_at: string
          humor: string
          id: string
          nivel_dor: number
          origem: string
          paciente_id: string
          texto: string
          tipo: string
        }[]
      }
      portal_resolve_account: {
        Args: { p_user_id: string }
        Returns: {
          conta_id: string
          is_primary: boolean
          onboarding_completo: boolean
          paciente_id: string
          paciente_nome: string
        }[]
      }
      process_team_invite: { Args: { invite_token: string }; Returns: Json }
      professional_can_access_patient: {
        Args: { p_patient_id: string; p_user_id: string }
        Returns: boolean
      }
      professional_can_access_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      recompute_pack_status: { Args: { p_pack_id: string }; Returns: undefined }
      upsert_portal_questionnaire: {
        Args: {
          p_completo?: boolean
          p_link_token?: string
          p_paciente_id: string
          p_perfil_tipo: string
          p_respostas: Json
          p_template_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "professional" | "patient" | "secretary"
      payment_method: "mbway" | "multibanco" | "dinheiro" | "transferencia"
      payment_status: "pendente" | "pago" | "expirado" | "cancelado"
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
      payment_method: ["mbway", "multibanco", "dinheiro", "transferencia"],
      payment_status: ["pendente", "pago", "expirado", "cancelado"],
    },
  },
} as const
