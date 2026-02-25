import { supabase } from '@/integrations/supabase/client';

export interface AIResponse<T = string> {
  data: T;
  model?: string;
  tokens_used?: number;
}

export interface AIClinicalSummary {
  resumo_progresso: string;
  alertas_clinicos: string[];
  focos_terapeuticos: string[];
  tendencia_dor: string;
}

export interface AIClinicalAssist {
  suggestion: string;
  mode: 'expand' | 'improve';
}

export interface AIReportDraft {
  draft: string;
}

export interface AIChurnAnalysis {
  patient_name: string;
  risk_level: 'critico' | 'alto' | 'moderado';
  probable_reason: string;
  reactivation_message: string;
}

export interface AIFinancialInsight {
  title: string;
  description: string;
  type: 'positivo' | 'neutro' | 'alerta';
}

export interface AILeadScore {
  lead_name: string;
  score: 'alto' | 'medio' | 'baixo';
  justification: string;
  next_step: string;
}

export interface AIDailyBriefing {
  greeting: string;
  highlights: Array<{ icon: string; text: string }>;
  priority: string;
}

export type AIFeature = 
  | 'clinical-summary'
  | 'clinical-assist'
  | 'report-draft'
  | 'churn-analysis'
  | 'financial-insights'
  | 'lead-scoring'
  | 'daily-briefing';

/**
 * Centralized AI Service - calls edge functions for each AI feature.
 * Never sends prompts from client; all logic lives in backend functions.
 */
export class AIService {
  static async generateClinicalSummary(payload: {
    prontuarioId: string;
    patientName: string;
    anamnese?: string;
    diagnostico?: string;
    objetivos?: string;
    evolutions: Array<{
      descricao: string;
      escala_dor: number | null;
      created_at: string;
      structured_data?: Record<string, unknown> | null;
    }>;
  }): Promise<AIResponse<AIClinicalSummary>> {
    return this.invoke<AIClinicalSummary>('ai-clinical-summary', payload);
  }

  static async assistClinicalText(payload: {
    field: 'anamnese' | 'diagnostico' | 'objetivos' | 'observacoes';
    currentText: string;
    mode: 'expand' | 'improve';
    context?: {
      patientName?: string;
      anamnese?: string;
      diagnostico?: string;
    };
  }): Promise<AIResponse<AIClinicalAssist>> {
    return this.invoke<AIClinicalAssist>('ai-clinical-assist', payload);
  }

  static async generateReportDraft(payload: {
    prontuarioId: string;
    patientName?: string;
    tipo?: string;
    periodoInicio: string;
    periodoFim: string;
  }): Promise<AIResponse<AIReportDraft>> {
    return this.invoke<AIReportDraft>('ai-report-draft', payload);
  }

  static async analyzeChurnRisk(payload: {
    patients: Array<{
      full_name: string;
      days_since_last_session: number;
    }>;
  }): Promise<AIResponse<{ analyses: AIChurnAnalysis[] }>> {
    return this.invoke<{ analyses: AIChurnAnalysis[] }>('ai-churn-analysis', payload);
  }

  static async generateFinancialInsights(payload: {
    kpis: {
      salesRevenue: number;
      executedRevenue: number;
      averageTicket: number;
      salesCount: number;
      sessionsCompleted: number;
    };
  }): Promise<AIResponse<{ insights: AIFinancialInsight[] }>> {
    return this.invoke<{ insights: AIFinancialInsight[] }>('ai-financial-insights', payload);
  }

  static async scoreLeads(payload: {
    leads: Array<{
      name: string;
      status: string;
      estimated_value: number | null;
      source: string | null;
      created_at: string;
      notes: string | null;
    }>;
  }): Promise<AIResponse<{ scores: AILeadScore[] }>> {
    return this.invoke<{ scores: AILeadScore[] }>('ai-lead-scoring', payload);
  }

  static async generateDailyBriefing(payload: {
    todaySessions: number;
    activePatients: number;
    churnRiskCount: number;
    pendingLeads: number;
  }): Promise<AIResponse<AIDailyBriefing>> {
    return this.invoke<AIDailyBriefing>('ai-daily-briefing', payload);
  }

  private static async invoke<T>(functionName: string, body: Record<string, unknown>): Promise<AIResponse<T>> {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      const message = error.message || '';
      if (message.includes('429') || message.includes('rate limit')) {
        throw new AIRateLimitError('Limite de requisições atingido. Tente novamente em alguns segundos.');
      }
      if (message.includes('402') || message.includes('payment')) {
        throw new AICreditsError('Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.');
      }
      throw new AIError(`Erro ao gerar conteúdo com IA: ${message}`);
    }

    if (data?.error) {
      if (data.status === 429) {
        throw new AIRateLimitError('Limite de requisições atingido. Tente novamente em alguns segundos.');
      }
      if (data.status === 402) {
        throw new AICreditsError('Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.');
      }
      throw new AIError(data.error);
    }

    return data as AIResponse<T>;
  }
}

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIError';
  }
}

export class AIRateLimitError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = 'AIRateLimitError';
  }
}

export class AICreditsError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = 'AICreditsError';
  }
}
