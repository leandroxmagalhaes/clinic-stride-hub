import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Zod schema for diary entry validation
export const diaryEntrySchema = z.object({
  pain_level: z.number().min(0).max(10),
  activity_description: z.string().trim().min(1, "Descreva o que estava fazendo").max(500),
  notes: z.string().trim().max(1000).optional(),
});

export type DiaryEntryInput = z.infer<typeof diaryEntrySchema>;

export interface DiaryEntry {
  id: string;
  patient_id: string;
  clinic_id: string | null;
  pain_level: number;
  activity_description: string;
  notes: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

// Type for the patient_diary table (not yet in generated types)
type PatientDiaryTable = {
  id: string;
  patient_id: string;
  clinic_id: string | null;
  pain_level: number;
  activity_description: string;
  notes: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
};

export class PatientDiaryService {
  /**
   * Create a new diary entry (idempotent - only one entry per day)
   */
  static async createEntry(input: DiaryEntryInput): Promise<{ success: boolean; error?: string; entry?: DiaryEntry }> {
    // Validate input
    const validation = diaryEntrySchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0]?.message || "Dados inválidos" };
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: "Usuário não autenticado" };
    }

    // Check if entry already exists for today (idempotency)
    const today = new Date().toISOString().split('T')[0];
    
    // Use raw query approach since types aren't generated yet
    const { data: existing } = await supabase
      .from('patient_diary' as any)
      .select('id')
      .eq('patient_id', userData.user.id)
      .eq('entry_date', today)
      .maybeSingle();

    if (existing) {
      // Update existing entry instead of creating duplicate
      const { data, error } = await supabase
        .from('patient_diary' as any)
        .update({
          pain_level: validation.data.pain_level,
          activity_description: validation.data.activity_description,
          notes: validation.data.notes || null,
        })
        .eq('id', (existing as any).id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, entry: data as unknown as DiaryEntry };
    }

    // Create new entry
    const { data, error } = await supabase
      .from('patient_diary' as any)
      .insert({
        patient_id: userData.user.id,
        pain_level: validation.data.pain_level,
        activity_description: validation.data.activity_description,
        notes: validation.data.notes || null,
        entry_date: today,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, entry: data as unknown as DiaryEntry };
  }

  /**
   * Get diary entries for the last N days
   */
  static async getRecentEntries(days: number = 7): Promise<DiaryEntry[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('patient_diary' as any)
      .select('*')
      .eq('patient_id', userData.user.id)
      .gte('entry_date', startDate.toISOString().split('T')[0])
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching diary entries:', error);
      return [];
    }

    return (data || []) as unknown as DiaryEntry[];
  }

  /**
   * Check if entry exists for today
   */
  static async hasTodayEntry(): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('patient_diary' as any)
      .select('id')
      .eq('patient_id', userData.user.id)
      .eq('entry_date', today)
      .maybeSingle();

    return !!data;
  }
}
