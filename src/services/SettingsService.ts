import { supabase } from '@/integrations/supabase/client';
import type { ClinicSettings, SettingsUpdatePayload } from '@/types/settings';

/**
 * SettingsService - Handles all settings-related database operations
 * Implements idempotent upsert pattern to prevent duplicate records
 */
export class SettingsService {
  /**
   * Fetches current clinic settings
   * Returns null if no settings exist yet
   */
  static async getSettings(): Promise<ClinicSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user's clinic_id first
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.clinic_id) return null;

    const { data, error } = await supabase
      .from('clinic_settings')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      throw new Error('Erro ao carregar configurações');
    }

    return data as ClinicSettings | null;
  }

  /**
   * Idempotent upsert - creates or updates settings
   * Safe to call multiple times with same data
   */
  static async saveSettings(payload: SettingsUpdatePayload): Promise<ClinicSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Get user's clinic_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.clinic_id) throw new Error('Clínica não encontrada');

    // Check if settings already exist
    const { data: existing } = await supabase
      .from('clinic_settings')
      .select('id')
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle();

    let result;

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('clinic_settings')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', profile.clinic_id)
        .select()
        .single();

      if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('clinic_settings')
        .insert({
          clinic_id: profile.clinic_id,
          ...payload,
        })
        .select()
        .single();

      if (error) throw new Error(`Erro ao criar: ${error.message}`);
      result = data;
    }

    return result as ClinicSettings;
  }

  /**
   * Updates only specific fields (partial update)
   */
  static async updatePartial(payload: SettingsUpdatePayload): Promise<ClinicSettings> {
    return this.saveSettings(payload);
  }

  /**
   * Gets clinic name from clinics table as fallback
   */
  static async getClinicInfo(): Promise<{ name: string } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.clinic_id) return null;

    const { data } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', profile.clinic_id)
      .single();

    return data;
  }
}
