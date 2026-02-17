import { supabase } from '@/integrations/supabase/client';
import { getAuthContext } from '@/lib/auth-helpers';
import type { Clinic, ClinicDataFormData } from '@/types/clinic';

/**
 * ClinicService - Handles clinic data operations
 */
export class ClinicService {
  /**
   * Get the current user's clinic data
   */
  static async getClinic(): Promise<Clinic | null> {
    const { clinicId } = await getAuthContext().catch(() => ({ clinicId: null as string | null }));
    if (!clinicId) return null;

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching clinic:', error);
      throw new Error('Erro ao carregar dados da clínica');
    }

    return data as Clinic | null;
  }

  /**
   * Update clinic data
   */
  static async updateClinic(payload: ClinicDataFormData): Promise<Clinic> {
    const { clinicId } = await getAuthContext();

    const { data, error } = await supabase
      .from('clinics')
      .update({
        name: payload.name,
        address: payload.address || null,
        phone: payload.phone || null,
        email: payload.email || null,
        cnpj: payload.cnpj || null,
        website: payload.website || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clinicId)
      .select()
      .single();

    if (error) {
      console.error('Error updating clinic:', error);
      throw new Error(`Erro ao atualizar: ${error.message}`);
    }

    return data as Clinic;
  }

  /**
   * Update clinic logo URL
   */
  static async updateLogo(logoUrl: string | null): Promise<void> {
    const { clinicId } = await getAuthContext();

    const { error } = await supabase
      .from('clinics')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clinicId);

    if (error) {
      console.error('Error updating logo:', error);
      throw new Error(`Erro ao atualizar logo: ${error.message}`);
    }
  }
}
