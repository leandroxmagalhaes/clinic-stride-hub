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

export interface PendingInvite {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: string;
  created_at: string;
  expires_at: string;
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
   * Get pending invites for the current clinic
   */
  static async getPendingInvites(): Promise<PendingInvite[]> {
    const { data, error } = await supabase
      .from('team_invites')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending invites:', error);
      return [];
    }

    return (data || []).map(invite => ({
      id: invite.id,
      email: invite.email,
      full_name: invite.full_name,
      role: invite.role as AppRole,
      status: invite.status,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
    }));
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
   * Invite a new user to the clinic via email
   */
  static async inviteUser(data: InviteUserData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: response, error } = await supabase.functions.invoke('send-team-invite', {
        body: {
          email: data.email,
          full_name: data.full_name,
          role: data.role,
        },
      });

      if (error) {
        console.error('Error invoking send-team-invite:', error);
        return { success: false, error: error.message || 'Erro ao enviar convite' };
      }

      if (!response?.success) {
        return { success: false, error: response?.error || 'Erro desconhecido' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error inviting user:', error);
      return { success: false, error: error.message || 'Erro ao convidar utilizador' };
    }
  }

  /**
   * Cancel a pending invite
   */
  static async cancelInvite(inviteId: string): Promise<boolean> {
    const { error } = await supabase
      .from('team_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId);

    if (error) {
      console.error('Error cancelling invite:', error);
      return false;
    }

    return true;
  }

  /**
   * Resend an invite (creates a new invite and cancels the old one)
   */
  static async resendInvite(invite: PendingInvite): Promise<{ success: boolean; error?: string }> {
    // Cancel the old invite
    await this.cancelInvite(invite.id);

    // Send a new invite
    return this.inviteUser({
      email: invite.email,
      full_name: invite.full_name,
      role: invite.role,
    });
  }
}
