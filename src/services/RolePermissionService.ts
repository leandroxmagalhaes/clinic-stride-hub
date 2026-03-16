import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/services/TeamService";
import { DEFAULT_PERMISSIONS, type UserPermissions } from "@/services/UserPermissionService";

export class RolePermissionService {
  static async getRolePermissions(clinicId: string, role: AppRole): Promise<UserPermissions | null> {
    const { data, error } = await (supabase as any)
      .from('role_permissions')
      .select('permissions')
      .eq('clinic_id', clinicId)
      .eq('role', role)
      .maybeSingle();

    if (error) {
      console.error('Error fetching role permissions:', error);
      return null;
    }
    if (!data?.permissions) return null;
    return data.permissions as UserPermissions;
  }

  static async getAllRolePermissions(clinicId: string): Promise<Record<string, UserPermissions>> {
    const { data, error } = await (supabase as any)
      .from('role_permissions')
      .select('role, permissions')
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error fetching all role permissions:', error);
      return {};
    }

    const result: Record<string, UserPermissions> = {};
    if (data) {
      for (const row of data) {
        result[row.role] = row.permissions as UserPermissions;
      }
    }
    return result;
  }

  static async saveRolePermissions(
    clinicId: string,
    role: AppRole,
    permissions: UserPermissions
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existing } = await (supabase as any)
        .from('role_permissions')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('role', role)
        .maybeSingle();

      let error;
      if (existing) {
        const result = await (supabase as any)
          .from('role_permissions')
          .update({
            permissions: JSON.parse(JSON.stringify(permissions)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        error = result.error;
      } else {
        const result = await (supabase as any)
          .from('role_permissions')
          .insert([{
            clinic_id: clinicId,
            role,
            permissions: JSON.parse(JSON.stringify(permissions)),
            updated_at: new Date().toISOString(),
          }]);
        error = result.error;
      }

      if (error) {
        console.error('Error saving role permissions:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error saving role permissions:', err);
      return { success: false, error: err.message };
    }
  }

  static async resetToDefaults(clinicId: string, role: AppRole): Promise<{ success: boolean }> {
    const { error } = await (supabase as any)
      .from('role_permissions')
      .delete()
      .eq('clinic_id', clinicId)
      .eq('role', role);

    if (error) {
      console.error('Error resetting role permissions:', error);
      return { success: false };
    }
    return { success: true };
  }

  static async getEffectiveRoleDefaults(clinicId: string, role: AppRole): Promise<UserPermissions> {
    if (role === 'patient') return {};
    const dbPerms = await this.getRolePermissions(clinicId, role);
    if (dbPerms && Object.keys(dbPerms).length > 0) return dbPerms;
    return { ...DEFAULT_PERMISSIONS[role as Exclude<AppRole, 'patient'>] };
  }
}
