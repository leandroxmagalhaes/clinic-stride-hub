import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// =====================================================
// TIPOS
// =====================================================

export type ReservedSlotType = 'fixo' | 'personalizado';
export type ReservedSlotStatus = 'ativo' | 'pausado' | 'cancelado';

export interface CustomScheduleEntry {
  dia: number; // 1-7 (ISO: Segunda=1, Domingo=7)
  hora: string; // "HH:MM" format
}

export interface ReservedSlot {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string | null;
  service_id: string | null;
  tipo: ReservedSlotType;
  titulo: string;
  dias_semana: number[] | null; // For 'fixo' type
  horario_inicio: string; // TIME as string "HH:MM:SS"
  duracao_minutos: number;
  horarios_personalizados: CustomScheduleEntry[] | null; // For 'personalizado' type
  data_inicio: string; // DATE as string "YYYY-MM-DD"
  data_fim: string | null;
  status: ReservedSlotStatus;
  cor: string;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (optional)
  patient?: { id: string; full_name: string };
  professional?: { id: string; full_name: string } | null;
  service?: { id: string; name: string; color: string } | null;
}

export interface CreateReservedSlotData {
  clinic_id: string;
  patient_id: string;
  professional_id?: string | null;
  service_id?: string | null;
  tipo: ReservedSlotType;
  titulo: string;
  dias_semana?: number[] | null;
  horario_inicio: string;
  duracao_minutos?: number;
  horarios_personalizados?: CustomScheduleEntry[] | null;
  data_inicio: string;
  data_fim?: string | null;
  cor?: string;
  observacoes?: string | null;
  created_by?: string | null;
}

export interface UpdateReservedSlotData {
  professional_id?: string | null;
  service_id?: string | null;
  tipo?: ReservedSlotType;
  titulo?: string;
  dias_semana?: number[] | null;
  horario_inicio?: string;
  duracao_minutos?: number;
  horarios_personalizados?: CustomScheduleEntry[] | null;
  data_inicio?: string;
  data_fim?: string | null;
  status?: ReservedSlotStatus;
  cor?: string;
  observacoes?: string | null;
}

export interface ReservationCheckResult {
  reservado: boolean;
  reservation_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  tipo: string | null;
  cor: string | null;
  titulo: string | null;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Safely parse JSONB horarios_personalizados to CustomScheduleEntry[]
 */
function parseCustomSchedule(json: Json | null): CustomScheduleEntry[] | null {
  if (!json || !Array.isArray(json)) return null;
  return json as unknown as CustomScheduleEntry[];
}

/**
 * Convert CustomScheduleEntry[] to Json for database insert/update
 */
function toJsonSchedule(entries: CustomScheduleEntry[] | null | undefined): Json | null {
  if (!entries) return null;
  return entries as unknown as Json;
}

/**
 * Map database row to ReservedSlot type
 */
function mapToReservedSlot(row: Record<string, unknown>): ReservedSlot {
  return {
    id: row.id as string,
    clinic_id: row.clinic_id as string,
    patient_id: row.patient_id as string,
    professional_id: row.professional_id as string | null,
    service_id: row.service_id as string | null,
    tipo: row.tipo as ReservedSlotType,
    titulo: row.titulo as string,
    dias_semana: row.dias_semana as number[] | null,
    horario_inicio: row.horario_inicio as string,
    duracao_minutos: row.duracao_minutos as number,
    horarios_personalizados: parseCustomSchedule(row.horarios_personalizados as Json | null),
    data_inicio: row.data_inicio as string,
    data_fim: row.data_fim as string | null,
    status: row.status as ReservedSlotStatus,
    cor: row.cor as string,
    observacoes: row.observacoes as string | null,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    patient: row.patient as { id: string; full_name: string } | undefined,
    professional: row.professional as { id: string; full_name: string } | null | undefined,
    service: row.service as { id: string; name: string; color: string } | null | undefined,
  };
}

// =====================================================
// SERVICE
// =====================================================

export const ReservedSlotService = {
  /**
   * Fetch all reserved slots for the current clinic
   */
  async fetchAll(): Promise<ReservedSlot[]> {
    const { data, error } = await supabase
      .from('horarios_reservados')
      .select(`
        *,
        patient:pacientes!patient_id(id, full_name),
        professional:profiles!horarios_reservados_professional_id_fkey(id, full_name),
        service:servicos!service_id(id, name, color)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reserved slots:', error);
      throw new Error(error.message);
    }

    return (data || []).map(row => mapToReservedSlot(row as Record<string, unknown>));
  },

  /**
   * Fetch only active reserved slots
   */
  async fetchActive(): Promise<ReservedSlot[]> {
    const { data, error } = await supabase
      .from('horarios_reservados')
      .select(`
        *,
        patient:pacientes!patient_id(id, full_name),
        professional:profiles!horarios_reservados_professional_id_fkey(id, full_name),
        service:servicos!service_id(id, name, color)
      `)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active reserved slots:', error);
      throw new Error(error.message);
    }

    return (data || []).map(row => mapToReservedSlot(row as Record<string, unknown>));
  },

  /**
   * Fetch reserved slots for a specific patient
   */
  async fetchByPatient(patientId: string): Promise<ReservedSlot[]> {
    const { data, error } = await supabase
      .from('horarios_reservados')
      .select(`
        *,
        patient:pacientes!patient_id(id, full_name),
        professional:profiles!horarios_reservados_professional_id_fkey(id, full_name),
        service:servicos!service_id(id, name, color)
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reserved slots by patient:', error);
      throw new Error(error.message);
    }

    return (data || []).map(row => mapToReservedSlot(row as Record<string, unknown>));
  },

  /**
   * Create a new reserved slot
   */
  async create(data: CreateReservedSlotData): Promise<ReservedSlot> {
    // Validate based on type
    if (data.tipo === 'fixo' && (!data.dias_semana || data.dias_semana.length === 0)) {
      throw new Error('Para bloqueio fixo, é necessário selecionar pelo menos um dia da semana');
    }

    if (data.tipo === 'personalizado' && (!data.horarios_personalizados || data.horarios_personalizados.length === 0)) {
      throw new Error('Para bloqueio personalizado, é necessário definir pelo menos um horário');
    }

    const insertData = {
      clinic_id: data.clinic_id,
      patient_id: data.patient_id,
      professional_id: data.professional_id || null,
      service_id: data.service_id || null,
      tipo: data.tipo,
      titulo: data.titulo,
      dias_semana: data.tipo === 'fixo' ? data.dias_semana : null,
      horario_inicio: data.horario_inicio,
      duracao_minutos: data.duracao_minutos || 60,
      horarios_personalizados: data.tipo === 'personalizado' ? toJsonSchedule(data.horarios_personalizados) : null,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim || null,
      cor: data.cor || '#FCD34D',
      observacoes: data.observacoes || null,
      created_by: data.created_by || null,
    };

    const { data: result, error } = await supabase
      .from('horarios_reservados')
      .insert(insertData)
      .select(`
        *,
        patient:pacientes!patient_id(id, full_name),
        professional:profiles!horarios_reservados_professional_id_fkey(id, full_name),
        service:servicos!service_id(id, name, color)
      `)
      .single();

    if (error) {
      console.error('Error creating reserved slot:', error);
      throw new Error(error.message);
    }

    return mapToReservedSlot(result as Record<string, unknown>);
  },

  /**
   * Update an existing reserved slot
   */
  async update(id: string, data: UpdateReservedSlotData): Promise<ReservedSlot> {
    // Convert horarios_personalizados to Json if present
    const updateData: Record<string, unknown> = { ...data };
    if (data.horarios_personalizados !== undefined) {
      updateData.horarios_personalizados = toJsonSchedule(data.horarios_personalizados);
    }

    const { data: result, error } = await supabase
      .from('horarios_reservados')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        patient:pacientes!patient_id(id, full_name),
        professional:profiles!horarios_reservados_professional_id_fkey(id, full_name),
        service:servicos!service_id(id, name, color)
      `)
      .single();

    if (error) {
      console.error('Error updating reserved slot:', error);
      throw new Error(error.message);
    }

    return mapToReservedSlot(result as Record<string, unknown>);
  },

  /**
   * Cancel a reserved slot (soft delete)
   */
  async cancel(id: string): Promise<void> {
    const { error } = await supabase
      .from('horarios_reservados')
      .update({ status: 'cancelado' })
      .eq('id', id);

    if (error) {
      console.error('Error canceling reserved slot:', error);
      throw new Error(error.message);
    }
  },

  /**
   * Pause a reserved slot
   */
  async pause(id: string): Promise<void> {
    const { error } = await supabase
      .from('horarios_reservados')
      .update({ status: 'pausado' })
      .eq('id', id);

    if (error) {
      console.error('Error pausing reserved slot:', error);
      throw new Error(error.message);
    }
  },

  /**
   * Reactivate a paused or canceled reserved slot
   */
  async activate(id: string): Promise<void> {
    const { error } = await supabase
      .from('horarios_reservados')
      .update({ status: 'ativo' })
      .eq('id', id);

    if (error) {
      console.error('Error activating reserved slot:', error);
      throw new Error(error.message);
    }
  },

  /**
   * Hard delete a reserved slot (permanent)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('horarios_reservados')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reserved slot:', error);
      throw new Error(error.message);
    }
  },

  /**
   * Check if a specific date/time is reserved
   * Uses the SQL helper function for efficiency
   */
  async checkReservation(
    date: string, // "YYYY-MM-DD"
    time: string, // "HH:MM" or "HH:MM:SS"
    professionalId?: string | null
  ): Promise<ReservationCheckResult | null> {
    const { data, error } = await supabase
      .rpc('check_horario_reservado', {
        p_date: date,
        p_time: time,
        p_professional_id: professionalId || null,
      });

    if (error) {
      console.error('Error checking reservation:', error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as ReservationCheckResult;
  },

  /**
   * Get all reservations that fall within a date range
   * Expands recurring patterns into individual occurrences
   */
  async getForDateRange(
    startDate: string, // "YYYY-MM-DD"
    endDate: string,   // "YYYY-MM-DD"
    professionalId?: string | null
  ): Promise<Array<{
    date: string;
    time: string;
    reservation: ReservedSlot;
  }>> {
    // Fetch all active reservations that could fall in this range
    let query = supabase
      .from('horarios_reservados')
      .select(`
        *,
        patient:pacientes!patient_id(id, full_name),
        professional:profiles!horarios_reservados_professional_id_fkey(id, full_name),
        service:servicos!service_id(id, name, color)
      `)
      .eq('status', 'ativo')
      .lte('data_inicio', endDate)
      .or(`data_fim.is.null,data_fim.gte.${startDate}`);

    if (professionalId) {
      query = query.or(`professional_id.is.null,professional_id.eq.${professionalId}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reservations for date range:', error);
      throw new Error(error.message);
    }

    const reservations = (data || []).map(row => mapToReservedSlot(row as Record<string, unknown>));
    const results: Array<{ date: string; time: string; reservation: ReservedSlot }> = [];

    // Expand each reservation into individual occurrences
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const reservation of reservations) {
      const reservationStart = new Date(reservation.data_inicio);
      const reservationEnd = reservation.data_fim ? new Date(reservation.data_fim) : null;

      // Iterate through each day in the range
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Skip if before reservation start
        if (d < reservationStart) continue;
        // Skip if after reservation end
        if (reservationEnd && d > reservationEnd) continue;

        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // Convert Sunday from 0 to 7

        if (reservation.tipo === 'fixo') {
          // Check if this day of week is in the pattern
          if (reservation.dias_semana?.includes(dayOfWeek)) {
            results.push({
              date: dateStr,
              time: reservation.horario_inicio,
              reservation,
            });
          }
        } else if (reservation.tipo === 'personalizado' && reservation.horarios_personalizados) {
          // Check custom schedule
          for (const entry of reservation.horarios_personalizados) {
            if (entry.dia === dayOfWeek) {
              results.push({
                date: dateStr,
                time: entry.hora,
                reservation,
              });
            }
          }
        }
      }
    }

    return results;
  },

  /**
   * Get reservations for a specific day
   */
  async getForDate(
    date: string, // "YYYY-MM-DD"
    professionalId?: string | null
  ): Promise<Array<{
    time: string;
    reservation: ReservedSlot;
  }>> {
    const results = await this.getForDateRange(date, date, professionalId);
    return results.map(r => ({ time: r.time, reservation: r.reservation }));
  },
};
