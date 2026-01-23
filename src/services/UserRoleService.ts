import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database['public']['Enums']['app_role'];

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export class UserRoleService {
  /**
   * Get all roles for the current user
   */
  static async getUserRoles(): Promise<AppRole[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }

    return (data || []).map(r => r.role);
  }

  /**
   * Check if current user has a specific role
   */
  static async hasRole(role: AppRole): Promise<boolean> {
    const roles = await this.getUserRoles();
    return roles.includes(role);
  }

  /**
   * Check if user is a patient
   */
  static async isPatient(): Promise<boolean> {
    return this.hasRole('patient');
  }

  /**
   * Check if user is a professional
   */
  static async isProfessional(): Promise<boolean> {
    return this.hasRole('professional');
  }

  /**
   * Check if user is an admin
   */
  static async isAdmin(): Promise<boolean> {
    return this.hasRole('admin');
  }
}
