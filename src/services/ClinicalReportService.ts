import { supabase } from "@/integrations/supabase/client";

// Types
export type ReportType = 'avaliacao_inicial' | 'evolucao_periodica' | 'alta' | 'progresso_mensal';
export type ReportStatus = 'rascunho' | 'finalizado' | 'enviado' | 'entregue';

export interface ClinicalReport {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  titulo: string;
  tipo: ReportType;
  periodo_inicio: string;
  periodo_fim: string;
  diagnostico_clinico?: string | null;
  objetivo_tratamento?: string | null;
  sessoes_realizadas?: number | null;
  evolucao_paciente?: string | null;
  resultados_obtidos?: string | null;
  recomendacoes?: string | null;
  observacoes?: string | null;
  destinatario_nome?: string | null;
  destinatario_especialidade?: string | null;
  destinatario_identificacao?: string | null;
  data_validade?: string | null;
  dias_aviso_antecedencia: number;
  status: ReportStatus;
  enviado_em?: string | null;
  entregue_em?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  paciente?: { full_name: string; email?: string | null; phone?: string | null; birth_date?: string | null };
  profissional?: { full_name: string; council_number?: string | null; specialty?: string | null };
}

export interface ClinicalReportInsert {
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  titulo: string;
  tipo: ReportType;
  periodo_inicio: string;
  periodo_fim: string;
  diagnostico_clinico?: string;
  objetivo_tratamento?: string;
  sessoes_realizadas?: number;
  evolucao_paciente?: string;
  resultados_obtidos?: string;
  recomendacoes?: string;
  observacoes?: string;
  destinatario_nome?: string;
  destinatario_especialidade?: string;
  destinatario_identificacao?: string;
  data_validade?: string;
  dias_aviso_antecedencia?: number;
  status?: ReportStatus;
  created_by?: string;
}

export interface ClinicalReportUpdate {
  titulo?: string;
  tipo?: ReportType;
  periodo_inicio?: string;
  periodo_fim?: string;
  diagnostico_clinico?: string;
  objetivo_tratamento?: string;
  sessoes_realizadas?: number;
  evolucao_paciente?: string;
  resultados_obtidos?: string;
  recomendacoes?: string;
  observacoes?: string;
  destinatario_nome?: string;
  destinatario_especialidade?: string;
  destinatario_identificacao?: string;
  data_validade?: string;
  dias_aviso_antecedencia?: number;
  status?: ReportStatus;
  enviado_em?: string;
  entregue_em?: string;
}

export interface ReportFilters {
  status?: ReportStatus;
  patientId?: string;
  professionalId?: string;
  deadline?: 'all' | 'expiring' | 'expired';
}

// Report type labels
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  avaliacao_inicial: 'Avaliação Inicial',
  evolucao_periodica: 'Evolução Periódica',
  progresso_mensal: 'Progresso Mensal',
  alta: 'Alta',
};

// Report status labels and colors
export const REPORT_STATUS_CONFIG: Record<ReportStatus, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  finalizado: { label: 'Finalizado', className: 'bg-info/10 text-info border-info/20' },
  enviado: { label: 'Enviado', className: 'bg-warning/10 text-warning border-warning/20' },
  entregue: { label: 'Entregue', className: 'bg-success/10 text-success border-success/20' },
};

export const ClinicalReportService = {
  /**
   * Get all reports for a clinic with optional filters
   */
  async getAll(clinicId: string, filters?: ReportFilters): Promise<ClinicalReport[]> {
    let query = supabase
      .from('relatorios_clinicos')
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.patientId) {
      query = query.eq('patient_id', filters.patientId);
    }

    if (filters?.professionalId) {
      query = query.eq('professional_id', filters.professionalId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching clinical reports:', error);
      throw error;
    }

    let reports = (data || []) as unknown as ClinicalReport[];

    // Apply deadline filter in memory (since it requires date comparison)
    if (filters?.deadline && filters.deadline !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      reports = reports.filter((r) => {
        if (!r.data_validade || r.status === 'entregue') return false;
        const deadline = new Date(r.data_validade);
        deadline.setHours(0, 0, 0, 0);

        if (filters.deadline === 'expired') {
          return deadline < today;
        } else if (filters.deadline === 'expiring') {
          return deadline >= today && deadline <= sevenDaysFromNow;
        }
        return true;
      });
    }

    return reports;
  },

  /**
   * Get a single report by ID
   */
  async getById(id: string): Promise<ClinicalReport | null> {
    const { data, error } = await supabase
      .from('relatorios_clinicos')
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching clinical report:', error);
      throw error;
    }

    return data as unknown as ClinicalReport | null;
  },

  /**
   * Create a new report
   */
  async create(report: ClinicalReportInsert): Promise<ClinicalReport> {
    const { data, error } = await supabase
      .from('relatorios_clinicos')
      .insert(report)
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .single();

    if (error) {
      console.error('Error creating clinical report:', error);
      throw error;
    }

    return data as unknown as ClinicalReport;
  },

  /**
   * Update an existing report
   */
  async update(id: string, updates: ClinicalReportUpdate): Promise<ClinicalReport> {
    const { data, error } = await supabase
      .from('relatorios_clinicos')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .single();

    if (error) {
      console.error('Error updating clinical report:', error);
      throw error;
    }

    return data as unknown as ClinicalReport;
  },

  /**
   * Delete a report
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('relatorios_clinicos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting clinical report:', error);
      throw error;
    }
  },

  /**
   * Mark report as finalized
   */
  async markAsFinalized(id: string): Promise<ClinicalReport> {
    return this.update(id, { status: 'finalizado' });
  },

  /**
   * Mark report as sent
   */
  async markAsSent(id: string): Promise<ClinicalReport> {
    return this.update(id, { 
      status: 'enviado', 
      enviado_em: new Date().toISOString() 
    });
  },

  /**
   * Mark report as delivered
   */
  async markAsDelivered(id: string): Promise<ClinicalReport> {
    return this.update(id, { 
      status: 'entregue', 
      entregue_em: new Date().toISOString() 
    });
  },

  /**
   * Count sessions in a period for a patient
   */
  async countSessionsInPeriod(
    patientId: string, 
    startDate: string, 
    endDate: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from('sessoes')
      .select('*', { count: 'exact', head: true })
      .eq('paciente_id', patientId)
      .gte('start_time', startDate)
      .lte('start_time', endDate + 'T23:59:59')
      .in('status', ['realizado', 'finalizado']);

    if (error) {
      console.error('Error counting sessions:', error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Get reports for a specific patient
   */
  async getByPatient(patientId: string): Promise<ClinicalReport[]> {
    const { data, error } = await supabase
      .from('relatorios_clinicos')
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching patient reports:', error);
      throw error;
    }

    return (data || []) as unknown as ClinicalReport[];
  },

  /**
   * Get expiring reports (within N days)
   */
  async getExpiring(clinicId: string, days: number = 7): Promise<ClinicalReport[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('relatorios_clinicos')
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .eq('clinic_id', clinicId)
      .not('status', 'eq', 'entregue')
      .not('data_validade', 'is', null)
      .gte('data_validade', today.toISOString().split('T')[0])
      .lte('data_validade', futureDate.toISOString().split('T')[0])
      .order('data_validade', { ascending: true });

    if (error) {
      console.error('Error fetching expiring reports:', error);
      throw error;
    }

    return (data || []) as unknown as ClinicalReport[];
  },

  /**
   * Get expired reports
   */
  async getExpired(clinicId: string): Promise<ClinicalReport[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('relatorios_clinicos')
      .select(`
        *,
        paciente:pacientes(full_name, email, phone, birth_date),
        profissional:profissionais(full_name, council_number, specialty)
      `)
      .eq('clinic_id', clinicId)
      .not('status', 'eq', 'entregue')
      .not('data_validade', 'is', null)
      .lt('data_validade', today)
      .order('data_validade', { ascending: true });

    if (error) {
      console.error('Error fetching expired reports:', error);
      throw error;
    }

    return (data || []) as unknown as ClinicalReport[];
  },

  /**
   * Get evolutions for a period (to import into report)
   */
  async getEvolutionsForPeriod(
    prontuarioId: string, 
    startDate: string, 
    endDate: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('evolucoes_clinicas')
      .select('descricao, created_at, escala_dor')
      .eq('prontuario_id', prontuarioId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching evolutions:', error);
      return '';
    }

    if (!data || data.length === 0) {
      return '';
    }

    // Format evolutions as text
    return data.map((ev, index) => {
      const date = new Date(ev.created_at).toLocaleDateString('pt-BR');
      const painInfo = ev.escala_dor !== null ? ` (Dor: ${ev.escala_dor}/10)` : '';
      return `${index + 1}. ${date}${painInfo}\n${ev.descricao}`;
    }).join('\n\n');
  },
};
