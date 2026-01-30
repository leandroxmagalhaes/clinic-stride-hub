import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/services/TeamService";

export type PermissionValue = boolean | 'own';

export interface ModulePermission {
  view: PermissionValue;
  edit: PermissionValue;
  delete: PermissionValue;
  financial: boolean;
}

export interface UserPermissions {
  [module: string]: ModulePermission;
}

export const MODULE_KEYS = [
  'dashboard',
  'agenda',
  'pacientes',
  'prontuarios',
  'profissionais',
  'servicos',
  'comercial',
  'financeiro',
  'engajamento',
  'configuracoes',
  'equipe',
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  pacientes: 'Pacientes',
  prontuarios: 'Prontuários',
  profissionais: 'Profissionais',
  servicos: 'Serviços',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  engajamento: 'Engajamento',
  configuracoes: 'Configurações',
  equipe: 'Equipe',
};

// Default permission templates for each role
export const DEFAULT_PERMISSIONS: Record<Exclude<AppRole, 'patient'>, UserPermissions> = {
  admin: {
    dashboard: { view: true, edit: true, delete: true, financial: true },
    agenda: { view: true, edit: true, delete: true, financial: true },
    pacientes: { view: true, edit: true, delete: true, financial: true },
    prontuarios: { view: true, edit: true, delete: true, financial: true },
    profissionais: { view: true, edit: true, delete: true, financial: true },
    servicos: { view: true, edit: true, delete: true, financial: true },
    comercial: { view: true, edit: true, delete: true, financial: true },
    financeiro: { view: true, edit: true, delete: true, financial: true },
    engajamento: { view: true, edit: true, delete: true, financial: true },
    configuracoes: { view: true, edit: true, delete: true, financial: true },
    equipe: { view: true, edit: true, delete: true, financial: true },
  },
  secretary: {
    dashboard: { view: true, edit: true, delete: true, financial: false },
    agenda: { view: true, edit: true, delete: true, financial: false },
    pacientes: { view: true, edit: true, delete: true, financial: false },
    prontuarios: { view: true, edit: true, delete: true, financial: false },
    profissionais: { view: true, edit: true, delete: true, financial: false },
    servicos: { view: true, edit: true, delete: true, financial: false },
    comercial: { view: true, edit: true, delete: true, financial: false },
    financeiro: { view: true, edit: true, delete: false, financial: false },
    engajamento: { view: true, edit: true, delete: true, financial: false },
    configuracoes: { view: false, edit: false, delete: false, financial: false },
    equipe: { view: false, edit: false, delete: false, financial: false },
  },
  professional: {
    dashboard: { view: true, edit: false, delete: false, financial: false },
    agenda: { view: true, edit: true, delete: false, financial: false },
    pacientes: { view: 'own', edit: 'own', delete: false, financial: false },
    prontuarios: { view: 'own', edit: 'own', delete: false, financial: false },
    profissionais: { view: false, edit: false, delete: false, financial: false },
    servicos: { view: true, edit: false, delete: false, financial: false },
    comercial: { view: false, edit: false, delete: false, financial: false },
    financeiro: { view: false, edit: false, delete: false, financial: false },
    engajamento: { view: true, edit: false, delete: false, financial: false },
    configuracoes: { view: false, edit: false, delete: false, financial: false },
    equipe: { view: false, edit: false, delete: false, financial: false },
  },
};

export class UserPermissionService {
  /**
   * Get custom permissions for a user
   */
  static async getUserPermissions(userId: string): Promise<UserPermissions | null> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permissions')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user permissions:', error);
      return null;
    }

    if (!data?.permissions) return null;
    return data.permissions as unknown as UserPermissions;
  }

  /**
   * Get current user's custom permissions
   */
  static async getCurrentUserPermissions(): Promise<UserPermissions | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return this.getUserPermissions(user.id);
  }

  /**
   * Save/update custom permissions for a user
   */
  static async saveUserPermissions(
    userId: string, 
    permissions: UserPermissions
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user's clinic
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .single();

      if (!profile?.clinic_id) {
        return { success: false, error: 'Clínica não encontrada' };
      }

      // Check if permission record exists
      const { data: existing } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('clinic_id', profile.clinic_id)
        .maybeSingle();

      let error;
      if (existing) {
        // Update existing
        const result = await supabase
          .from('user_permissions')
          .update({
            permissions: JSON.parse(JSON.stringify(permissions)),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existing.id);
        error = result.error;
      } else {
        // Insert new - use raw insert since types may not be updated yet
        const result = await supabase
          .from('user_permissions')
          .insert([{
            user_id: userId,
            clinic_id: profile.clinic_id,
            permissions: JSON.parse(JSON.stringify(permissions)),
          }] as any);
        error = result.error;
      }

      if (error) {
        console.error('Error saving permissions:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error saving permissions:', err);
      return { success: false, error: err.message || 'Erro ao guardar permissões' };
    }
  }

  /**
   * Delete custom permissions (reset to role defaults)
   */
  static async resetToRoleDefaults(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error resetting permissions:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error resetting permissions:', err);
      return { success: false, error: err.message || 'Erro ao restaurar permissões' };
    }
  }

  /**
   * Get default permissions for a role
   */
  static getDefaultPermissionsForRole(role: AppRole): UserPermissions {
    if (role === 'patient') {
      return {}; // Patients have no module permissions
    }
    return { ...DEFAULT_PERMISSIONS[role] };
  }

  /**
   * Get effective permissions for a user (custom or role default)
   */
  static async getEffectivePermissions(
    userId: string, 
    role: AppRole
  ): Promise<UserPermissions> {
    const customPermissions = await this.getUserPermissions(userId);
    
    if (customPermissions && Object.keys(customPermissions).length > 0) {
      return customPermissions;
    }
    
    return this.getDefaultPermissionsForRole(role);
  }
}
