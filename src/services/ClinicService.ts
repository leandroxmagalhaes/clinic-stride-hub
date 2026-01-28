import { supabase } from '@/integrations/supabase/client';
import type { Clinic, ClinicDataFormData } from '@/types/clinic';

/**
 * ClinicService - Handles clinic data operations
 */
export class ClinicService {
  /**
   * Get the current user's clinic data
   */
  static async getClinic(): Promise<Clinic | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user's clinic_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.clinic_id) return null;

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', profile.clinic_id)
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Get user's clinic_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.clinic_id) throw new Error('Clínica não encontrada');

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
      .eq('id', profile.clinic_id)
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.clinic_id) throw new Error('Clínica não encontrada');

    const { error } = await supabase
      .from('clinics')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.clinic_id);

    if (error) {
      console.error('Error updating logo:', error);
      throw new Error(`Erro ao atualizar logo: ${error.message}`);
    }
  }
}
