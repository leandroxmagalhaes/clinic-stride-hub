import { useState, useEffect } from "react";
import { UserRoleService, AppRole } from "@/services/UserRoleService";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      const userRoles = await UserRoleService.getUserRoles();
      setRoles(userRoles);
      setIsLoading(false);
    };

    fetchRoles();

    // Re-fetch on auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    roles,
    isLoading,
    isPatient: roles.includes('patient'),
    isProfessional: roles.includes('professional'),
    isAdmin: roles.includes('admin'),
    isSecretary: roles.includes('secretary'),
    hasRole: (role: AppRole) => roles.includes(role),
  };
}
