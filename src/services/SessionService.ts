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
  price: number;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  // Joined data for display
  paciente?: {
    id: string;
    full_name: string;
  };
  profissional?: {
    id: string;
    full_name: string;
  };
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
  minute?: number; // 0-59, defaults to 0
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

export class SessionService {
  // Validate session data before creation
  static validate(data: CreateSessionData): ValidationResult {
    if (!data.pacienteId) {
      return { isValid: false, error: "Selecione um paciente" };
    }
    if (!data.profissionalId) {
      return { isValid: false, error: "Selecione um profissional" };
    }
    if (!data.servicoId) {
      return { isValid: false, error: "Selecione um serviço" };
    }
    if (!data.date || !data.hour) {
      return { isValid: false, error: "Data e hora são obrigatórios" };
    }

    return { isValid: true };
  }

  // Check for scheduling conflicts (interval overlap)
  static checkConflict(
    sessions: Session[],
    profissionalId: string,
    date: Date,
    hour: number,
    minute: number = 0,
    durationMinutes: number = 60
  ): ValidationResult {
    const newStart = setMinutes(setHours(new Date(date), hour), minute);
    const newEnd = addMinutes(newStart, durationMinutes);

    const hasConflict = sessions.some((s) => {
      if (s.profissional_id !== profissionalId) return false;
      if (!isSameDay(new Date(s.start_time), newStart)) return false;
      
      const existingStart = new Date(s.start_time);
      const existingEnd = new Date(s.end_time);
      
      // Check for overlap: newStart < existingEnd AND newEnd > existingStart
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (hasConflict) {
      return {
        isValid: false,
        error: "Conflito de horário: já existe um agendamento para este profissional neste intervalo",
      };
    }

    return { isValid: true };
  }

  // Create session data (clinic_id provided by caller)
  static create(
    data: CreateSessionData, 
    existingSessions: Session[],
    clinicId: string,
    lookupData?: {
      services?: ServiceData[];
      patients?: PatientData[];
      professionals?: ProfessionalData[];
    }
  ): Session {
    // Validate required fields
    const validation = this.validate(data);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Get service details for duration
    const servico = lookupData?.services?.find((s) => s.id === data.servicoId);
    const durationMinutes = servico?.duration_minutes || 60;

    // Check for conflicts with interval overlap
    const conflictCheck = this.checkConflict(
      existingSessions,
      data.profissionalId,
      data.date,
      data.hour,
      data.minute ?? 0,
      durationMinutes
    );
    if (!conflictCheck.isValid) {
      throw new Error(conflictCheck.error);
    }

    // Get patient and professional details
    const paciente = lookupData?.patients?.find((p) => p.id === data.pacienteId);
    const profissional = lookupData?.professionals?.find((p) => p.id === data.profissionalId);

    const startTime = setMinutes(setHours(new Date(data.date), data.hour), data.minute ?? 0);
    const endTime = addMinutes(startTime, durationMinutes);

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
      // Joined data
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

  // Filter sessions by date
  static filterByDate(sessions: Session[], date: Date): Session[] {
    return sessions.filter((s) => isSameDay(new Date(s.start_time), date));
  }

  // Filter sessions by professional
  static filterByProfessional(sessions: Session[], profissionalId: string): Session[] {
    return sessions.filter((s) => s.profissional_id === profissionalId);
  }

  // Get sessions for a specific time slot
  static getForTimeSlot(sessions: Session[], date: Date, hour: number): Session[] {
    return sessions.filter(
      (s) =>
        isSameDay(new Date(s.start_time), date) &&
        new Date(s.start_time).getHours() === hour
    );
  }

  // Reschedule a session to a new date/time
  static reschedule(
    session: Session,
    newDate: Date,
    newHour: number,
    existingSessions: Session[]
  ): { success: boolean; error?: string; updatedSession?: Session } {
    // Check for conflicts (excluding the session being moved)
    const otherSessions = existingSessions.filter((s) => s.id !== session.id);
    const conflictCheck = this.checkConflict(
      otherSessions,
      session.profissional_id,
      newDate,
      newHour
    );

    if (!conflictCheck.isValid) {
      return { success: false, error: conflictCheck.error };
    }

    // Calculate new times
    const duration = session.servico?.duration_minutes || 60;
    const newStartTime = setMinutes(setHours(new Date(newDate), newHour), 0);
    const newEndTime = addMinutes(newStartTime, duration);

    return {
      success: true,
      updatedSession: {
        ...session,
        start_time: newStartTime,
        end_time: newEndTime,
      },
    };
  }
}
