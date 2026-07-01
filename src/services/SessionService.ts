// SessionService - Business logic for session/appointment operations (SRP)
import { isSameDay, setHours, setMinutes, addMinutes } from "date-fns";

export interface Session {
  id: string;
  clinic_id: string;
  paciente_id: string;
  profissional_id: string;
  servico_id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  confirmacao_estado?: string | null;
  price: number;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  paciente?: { id: string; full_name: string; birth_date?: string | null };
  profissional?: { id: string; full_name: string };
  servico?: {
    id: string;
    name: string;
    color: string;
    duration_minutes: number;
    consumes_credit?: boolean;
  };
}

export interface CreateSessionData {
  pacienteId: string;
  profissionalId: string;
  servicoId: string;
  date: Date;
  hour: number;
  minute?: number;
  endHour?: number; // ── hora de fim editável
  endMinute?: number; // ── minuto de fim editável
  notes?: string;
}

export interface ServiceData {
  id: string;
  name: string;
  color: string | null;
  duration_minutes: number;
  price: number;
  consumes_credit?: boolean;
}

export interface PatientData {
  id: string;
  full_name: string;
}

export interface ProfessionalData {
  id: string;
  full_name: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// ── Resultado de conflito — não bloqueia, apenas informa ─────────────────────
export interface ConflictResult {
  hasConflict: boolean;
  message?: string;
  conflictingSession?: Session;
}
// ─────────────────────────────────────────────────────────────────────────────

export class SessionService {
  static validate(data: CreateSessionData): ValidationResult {
    if (!data.pacienteId) return { isValid: false, error: "Selecione um paciente" };
    if (!data.profissionalId) return { isValid: false, error: "Selecione um profissional" };
    if (!data.servicoId) return { isValid: false, error: "Selecione um serviço" };
    if (!data.date || data.hour === undefined) return { isValid: false, error: "Data e hora são obrigatórios" };
    return { isValid: true };
  }

  // ── Verifica conflito mas NÃO bloqueia — retorna info para o caller decidir ──
  static checkConflict(
    sessions: Session[],
    profissionalId: string,
    date: Date,
    hour: number,
    minute: number = 0,
    durationMinutes: number = 60,
    endHour?: number,
    endMinute?: number,
  ): ConflictResult {
    const newStart = setMinutes(setHours(new Date(date), hour), minute);
    const newEnd =
      endHour !== undefined
        ? setMinutes(setHours(new Date(date), endHour), endMinute ?? 0)
        : addMinutes(newStart, durationMinutes);

    const conflicting = sessions.find((s) => {
      if (s.profissional_id !== profissionalId) return false;
      if (s.status === "cancelado" || s.status === "falta" || s.status === "faltou") return false;
      if (!isSameDay(new Date(s.start_time), newStart)) return false;
      const existingStart = new Date(s.start_time);
      const existingEnd = new Date(s.end_time);
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (conflicting) {
      return {
        hasConflict: true,
        message: `Conflito de horário: já existe uma sessão para este profissional neste intervalo`,
        conflictingSession: conflicting,
      };
    }

    return { hasConflict: false };
  }

  // ── create() NÃO verifica conflito — o caller já decidiu se ignora ou não ──
  static create(
    data: CreateSessionData,
    existingSessions: Session[],
    clinicId: string,
    lookupData?: {
      services?: ServiceData[];
      patients?: PatientData[];
      professionals?: ProfessionalData[];
    },
    skipConflictCheck: boolean = false,
  ): Session {
    const validation = this.validate(data);
    if (!validation.isValid) throw new Error(validation.error);

    const servico = lookupData?.services?.find((s) => s.id === data.servicoId);
    const durationMinutes = servico?.duration_minutes || 60;

    // Só verifica conflito se skipConflictCheck === false
    if (!skipConflictCheck) {
      const conflict = this.checkConflict(
        existingSessions,
        data.profissionalId,
        data.date,
        data.hour,
        data.minute ?? 0,
        durationMinutes,
        data.endHour,
        data.endMinute,
      );
      if (conflict.hasConflict) {
        throw new Error(conflict.message);
      }
    }

    const paciente = lookupData?.patients?.find((p) => p.id === data.pacienteId);
    const profissional = lookupData?.professionals?.find((p) => p.id === data.profissionalId);

    const startTime = setMinutes(setHours(new Date(data.date), data.hour), data.minute ?? 0);
    const endTime =
      data.endHour !== undefined
        ? setMinutes(setHours(new Date(data.date), data.endHour), data.endMinute ?? 0)
        : addMinutes(startTime, durationMinutes);

    return {
      id: `sess-${Date.now()}`,
      clinic_id: clinicId,
      paciente_id: data.pacienteId,
      profissional_id: data.profissionalId,
      servico_id: data.servicoId,
      start_time: startTime,
      end_time: endTime,
      status: "agendado",
      price: servico?.price || 0,
      payment_status: "pendente",
      payment_method: null,
      notes: data.notes || null,
      paciente: paciente ? { id: paciente.id, full_name: paciente.full_name } : undefined,
      profissional: profissional ? { id: profissional.id, full_name: profissional.full_name } : undefined,
      servico: servico
        ? {
            id: servico.id,
            name: servico.name,
            color: servico.color || "#10B981",
            duration_minutes: servico.duration_minutes,
            consumes_credit: servico.consumes_credit,
          }
        : undefined,
    };
  }

  static filterByDate(sessions: Session[], date: Date): Session[] {
    return sessions.filter((s) => isSameDay(new Date(s.start_time), date));
  }

  static filterByProfessional(sessions: Session[], profissionalId: string): Session[] {
    return sessions.filter((s) => s.profissional_id === profissionalId);
  }

  static getForTimeSlot(sessions: Session[], date: Date, hour: number): Session[] {
    return sessions.filter(
      (s) => isSameDay(new Date(s.start_time), date) && new Date(s.start_time).getHours() === hour,
    );
  }

  static reschedule(
    session: Session,
    newDate: Date,
    newHour: number,
    existingSessions: Session[],
  ): { success: boolean; error?: string; updatedSession?: Session } {
    const otherSessions = existingSessions.filter((s) => s.id !== session.id);
    const conflict = this.checkConflict(otherSessions, session.profissional_id, newDate, newHour);

    if (conflict.hasConflict) {
      return { success: false, error: conflict.message };
    }

    const duration = session.servico?.duration_minutes || 60;
    const newStartTime = setMinutes(setHours(new Date(newDate), newHour), 0);
    const newEndTime = addMinutes(newStartTime, duration);

    return {
      success: true,
      updatedSession: { ...session, start_time: newStartTime, end_time: newEndTime },
    };
  }
}
