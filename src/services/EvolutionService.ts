// EvolutionService - Business logic for clinical evolution operations (SRP)

export interface Evolution {
  id: string;
  clinic_id: string;
  prontuario_id: string;
  sessao_id: string | null;
  profissional_id: string;
  descricao: string;
  escala_dor: number | null;
  anexos_urls: string[] | null;
  created_at: string;
  // New fields for dynamic specialty templates
  specialty_id?: string | null;
  structured_data?: Record<string, unknown> | null;
  profissional?: {
    id: string;
    full_name: string;
  };
}

export interface CreateEvolutionData {
  prontuario_id: string;
  profissional_id: string;
  descricao: string;
  escala_dor: number;
  sessao_id?: string;
  // New fields for dynamic specialty templates
  specialty_id?: string | null;
  structured_data?: Record<string, unknown> | null;
}

export class EvolutionService {
  /**
   * Validate evolution data before creation
   */
  static validate(data: CreateEvolutionData): void {
    if (!data.descricao?.trim()) {
      throw new Error("Descrição é obrigatória");
    }

    if (data.escala_dor < 0 || data.escala_dor > 10) {
      throw new Error("Escala de dor deve estar entre 0 e 10");
    }

    if (!data.prontuario_id) {
      throw new Error("Prontuário não selecionado");
    }

    if (!data.profissional_id) {
      throw new Error("Profissional não selecionado");
    }
  }

  /**
   * Create evolution data (clinic_id provided by caller)
   */
  static createData(
    data: CreateEvolutionData,
    clinicId: string,
    profissionalName?: string
  ): Evolution {
    // Validate
    this.validate(data);

    // Generate unique ID
    const id = `evol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      clinic_id: clinicId,
      prontuario_id: data.prontuario_id,
      sessao_id: data.sessao_id || null,
      profissional_id: data.profissional_id,
      descricao: data.descricao.trim(),
      escala_dor: data.escala_dor,
      anexos_urls: null,
      created_at: new Date().toISOString(),
      // New fields for specialty templates
      specialty_id: data.specialty_id || null,
      structured_data: data.structured_data || null,
      profissional: profissionalName
        ? { id: data.profissional_id, full_name: profissionalName }
        : undefined,
    };
  }

  /**
   * Get evolutions for a specific prontuario
   */
  static getByProntuario(
    evolutions: Evolution[],
    prontuarioId: string
  ): Evolution[] {
    return evolutions
      .filter((e) => e.prontuario_id === prontuarioId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }
}
