import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { UserRoleService, AppRole } from "@/services/UserRoleService";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cachedUserId = useRef<string | null>(null);
  const isFetching = useRef(false);
  const rolesRef = useRef<AppRole[]>([]);

  // Keep rolesRef in sync
  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  const fetchRoles = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Skip fetch if user hasn't changed and we already have roles
    if (user?.id === cachedUserId.current && rolesRef.current.length > 0) {
      setIsLoading(false);
      return;
    }

    // Handle logout case
    if (!user) {
      cachedUserId.current = null;
      setRoles([]);
      setIsLoading(false);
      return;
    }

    isFetching.current = true;
    cachedUserId.current = user.id;
    setIsLoading(true);

    try {
      const userRoles = await UserRoleService.getUserRoles();
      setRoles(userRoles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles([]);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []); // No dependencies - uses refs instead

  useEffect(() => {
    fetchRoles();

    // Re-fetch only on SIGNED_IN and SIGNED_OUT events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        cachedUserId.current = null;
        setRoles([]);
        rolesRef.current = [];
        setIsLoading(false);
        return;
      }
      if (event === 'SIGNED_IN') {
        const { data: { user } } = await supabase.auth.getUser();
        // Only re-fetch if user actually changed
        if (user?.id === cachedUserId.current && rolesRef.current.length > 0) {
          return;
        }
        cachedUserId.current = null;
        fetchRoles();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  // Memoize the role check functions to prevent unnecessary recalculations
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
