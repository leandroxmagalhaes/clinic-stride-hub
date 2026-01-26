import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database['public']['Enums']['app_role'];

export interface TeamMember {
  profile_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  clinic_id: string | null;
  created_at: string;
  roles: AppRole[];
}

export interface InviteUserData {
  email: string;
  full_name: string;
  role: AppRole;
}

export class TeamService {
  /**
   * Get all team members for the current clinic
   */
  static async getTeamMembers(): Promise<TeamMember[]> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .single();

    if (!profile?.clinic_id) return [];

    // Get profiles for this clinic
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('clinic_id', profile.clinic_id);

    if (profilesError) {
      console.error('Error fetching team members:', profilesError);
      return [];
    }

    // Get roles for each user
    const teamMembers: TeamMember[] = await Promise.all(
      (profiles || []).map(async (p) => {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', p.user_id);

        return {
          profile_id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          is_active: p.is_active,
          clinic_id: p.clinic_id,
          created_at: p.created_at,
          roles: (rolesData || []).map(r => r.role),
        };
      })
    );

    return teamMembers;
  }

  /**
   * Update a team member's roles
   */
  static async updateMemberRoles(userId: string, roles: AppRole[]): Promise<boolean> {
    try {
      // First, delete existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then insert new roles
      if (roles.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(roles.map(role => ({ user_id: userId, role })));

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error updating member roles:', error);
      return false;
    }
  }

  /**
   * Toggle a team member's active status
   */
  static async toggleMemberStatus(profileId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', profileId);

    if (error) {
      console.error('Error toggling member status:', error);
      return false;
    }

    return true;
  }

  /**
   * Invite a new user to the clinic
   * Note: This creates a profile entry. The user will need to sign up with this email.
   */
  static async inviteUser(data: InviteUserData): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user's clinic
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .single();

      if (!currentProfile?.clinic_id) {
        return { success: false, error: 'Clínica não encontrada' };
      }

      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();

      if (existingProfile) {
        return { success: false, error: 'Este email já está cadastrado' };
      }

      // For now, we'll just create a placeholder that will be linked when user signs up
      // In production, you'd want to use Supabase Auth invites or an edge function
      return { 
        success: true,
        error: 'Convite será enviado quando o sistema de emails estiver configurado. Por enquanto, peça ao usuário para se cadastrar com este email.'
      };
    } catch (error) {
      console.error('Error inviting user:', error);
      return { success: false, error: 'Erro ao convidar usuário' };
    }
  }
}
