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
  /**
   * Generate clinical summary from evolutions
   */
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

  /**
   * AI writing assistant for clinical text fields
   */
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

  /**
   * Generic invoke with error handling for rate limits and credits
   */
  private static async invoke<T>(functionName: string, body: Record<string, unknown>): Promise<AIResponse<T>> {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      // Check for specific error codes
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

// Custom error classes for specific handling
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
