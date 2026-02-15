import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AppRole } from "@/services/UserRoleService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cachedUserId = useRef<string | null>(null);
  const isFetching = useRef(false);

  useEffect(() => {
    // Handle logout
    if (!user) {
      cachedUserId.current = null;
      setRoles([]);
      setIsLoading(false);
      return;
    }

    // Skip if same user and we already have roles
    if (user.id === cachedUserId.current && roles.length > 0) {
      setIsLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (isFetching.current) return;

    const fetchRoles = async () => {
      isFetching.current = true;
      cachedUserId.current = user.id;
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user roles:', error);
          setRoles([]);
        } else {
          setRoles((data || []).map(r => r.role));
        }
      } catch (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
      } finally {
        setIsLoading(false);
        isFetching.current = false;
      }
    };

    fetchRoles();
  }, [user?.id]); // Only re-run when user identity changes

  const roleChecks = useMemo(() => ({
    isPatient: roles.includes('patient'),
    isProfessional: roles.includes('professional'),
    isAdmin: roles.includes('admin'),
    isSecretary: roles.includes('secretary'),
  }), [roles]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  return {
    roles,
    isLoading,
    ...roleChecks,
    hasRole,
  };
}
