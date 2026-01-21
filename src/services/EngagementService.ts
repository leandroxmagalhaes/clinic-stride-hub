import { supabase } from "@/integrations/supabase/client";

export interface BirthdayPatient {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string;
  day: number;
}

export interface ChurnRiskPatient {
  id: string;
  full_name: string;
  phone: string | null;
  days_since_last_session: number;
  last_session_date: string | null;
}

export interface PatientFeedback {
  id: string;
  patient_id: string;
  patient_name?: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export class EngagementService {
  /**
   * Get patients with birthdays in the current month
   */
  static async getBirthdayPatients(): Promise<BirthdayPatient[]> {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, full_name, phone, birth_date')
      .eq('is_active', true)
      .not('birth_date', 'is', null);
    
    if (error) {
      console.error('Error fetching birthday patients:', error);
      return [];
    }
    
    // Filter by current month in JavaScript (more reliable than SQL extraction)
    const birthdayPatients = (data || [])
      .filter(patient => {
        if (!patient.birth_date) return false;
        const birthMonth = new Date(patient.birth_date).getMonth() + 1;
        return birthMonth === currentMonth;
      })
      .map(patient => ({
        id: patient.id,
        full_name: patient.full_name,
        phone: patient.phone,
        birth_date: patient.birth_date!,
        day: new Date(patient.birth_date!).getDate()
      }))
      .sort((a, b) => a.day - b.day);
    
    return birthdayPatients;
  }

  /**
   * Get active patients with no sessions in the last 30 days (churn risk)
   */
  static async getChurnRiskPatients(): Promise<ChurnRiskPatient[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get all active patients
    const { data: patients, error: patientsError } = await supabase
      .from('pacientes')
      .select('id, full_name, phone')
      .eq('is_active', true);
    
    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return [];
    }
    
    // Get all sessions from the last 30 days
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('sessoes')
      .select('paciente_id, start_time')
      .gte('start_time', thirtyDaysAgo.toISOString())
      .in('status', ['realizado', 'confirmado', 'agendado']);
    
    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return [];
    }
    
    // Get last session for each patient
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('sessoes')
      .select('paciente_id, start_time')
      .in('status', ['realizado', 'confirmado'])
      .order('start_time', { ascending: false });
    
    if (allSessionsError) {
      console.error('Error fetching all sessions:', allSessionsError);
      return [];
    }
    
    // Create a set of patient IDs with recent sessions
    const patientsWithRecentSessions = new Set(
      (recentSessions || []).map(s => s.paciente_id)
    );
    
    // Create a map of last session date per patient
    const lastSessionMap = new Map<string, string>();
    (allSessions || []).forEach(s => {
      if (!lastSessionMap.has(s.paciente_id)) {
        lastSessionMap.set(s.paciente_id, s.start_time);
      }
    });
    
    // Filter patients without recent sessions
    const today = new Date();
    const churnRiskPatients: ChurnRiskPatient[] = (patients || [])
      .filter(patient => !patientsWithRecentSessions.has(patient.id))
      .map(patient => {
        const lastSession = lastSessionMap.get(patient.id);
        let daysSince = 999;
        
        if (lastSession) {
          const lastDate = new Date(lastSession);
          daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        return {
          id: patient.id,
          full_name: patient.full_name,
          phone: patient.phone,
          days_since_last_session: daysSince,
          last_session_date: lastSession || null
        };
      })
      .filter(p => p.days_since_last_session > 30)
      .sort((a, b) => b.days_since_last_session - a.days_since_last_session);
    
    return churnRiskPatients;
  }

  /**
   * Get all feedback entries
   */
  static async getFeedback(): Promise<PatientFeedback[]> {
    const { data, error } = await supabase
      .from('patient_feedback')
      .select(`
        id,
        patient_id,
        score,
        comment,
        created_at,
        pacientes!inner(full_name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching feedback:', error);
      return [];
    }
    
    return (data || []).map(item => ({
      id: item.id,
      patient_id: item.patient_id,
      patient_name: (item.pacientes as any)?.full_name || 'Unknown',
      score: item.score,
      comment: item.comment,
      created_at: item.created_at
    }));
  }

  /**
   * Add new feedback
   */
  static async addFeedback(patientId: string, score: number, comment: string | null, clinicId: string): Promise<boolean> {
    const { error } = await supabase
      .from('patient_feedback')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        score,
        comment
      });
    
    if (error) {
      console.error('Error adding feedback:', error);
      return false;
    }
    
    return true;
  }

  /**
   * Calculate NPS score
   * NPS = % Promoters (9-10) - % Detractors (0-6)
   */
  static calculateNPS(feedback: PatientFeedback[]): { nps: number; avg: number; promoters: number; passives: number; detractors: number } {
    if (feedback.length === 0) {
      return { nps: 0, avg: 0, promoters: 0, passives: 0, detractors: 0 };
    }
    
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    let total = 0;
    
    feedback.forEach(f => {
      total += f.score;
      if (f.score >= 9) {
        promoters++;
      } else if (f.score >= 7) {
        passives++;
      } else {
        detractors++;
      }
    });
    
    const count = feedback.length;
    const nps = Math.round(((promoters - detractors) / count) * 100);
    const avg = total / count;
    
    return { nps, avg, promoters, passives, detractors };
  }

  /**
   * Generate WhatsApp link with pre-filled message
   */
  static generateWhatsAppLink(phone: string | null, message: string): string | null {
    if (!phone) return null;
    
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  /**
   * Generate birthday message
   */
  static getBirthdayMessage(name: string): string {
    const firstName = name.split(' ')[0];
    return `Olá ${firstName}, a Clínica PhysioOne deseja-lhe um feliz aniversário! 🎂 Muita saúde e felicidade!`;
  }

  /**
   * Generate reactivation message
   */
  static getReactivationMessage(name: string): string {
    const firstName = name.split(' ')[0];
    return `Olá ${firstName}, sentimos a sua falta! Notámos que não vem há algum tempo. Vamos retomar o seu tratamento? Aguardamos o seu contacto! 💪`;
  }
}
