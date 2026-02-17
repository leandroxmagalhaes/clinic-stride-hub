import { supabase } from '@/integrations/supabase/client';
import { getAuthContext } from '@/lib/auth-helpers';
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
    const { clinicId } = await getAuthContext().catch(() => ({ clinicId: null as string | null }));
    if (!clinicId) return null;

    const { data, error } = await supabase
      .from('clinic_settings')
      .select('*')
      .eq('clinic_id', clinicId)
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
    const { clinicId } = await getAuthContext();

    // Check if settings already exist
    const { data: existing } = await supabase
      .from('clinic_settings')
      .select('id')
      .eq('clinic_id', clinicId)
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
        .eq('clinic_id', clinicId)
        .select()
        .single();

      if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('clinic_settings')
        .insert({
          clinic_id: clinicId,
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
    const { clinicId } = await getAuthContext().catch(() => ({ clinicId: null as string | null }));
    if (!clinicId) return null;

    const { data } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single();

    return data;
  }
}
