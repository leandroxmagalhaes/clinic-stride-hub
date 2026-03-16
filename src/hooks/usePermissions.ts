import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useUserRole } from "./useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { UserPermissionService, UserPermissions, ModulePermission } from "@/services/UserPermissionService";
import { RolePermissionService } from "@/services/RolePermissionService";
import { supabase } from "@/integrations/supabase/client";

export type PermissionModule = 
  | 'dashboard'
  | 'agenda'
  | 'pacientes'
  | 'prontuarios'
  | 'profissionais'
  | 'servicos'
  | 'comercial'
  | 'financeiro'
  | 'engajamento'
  | 'configuracoes'
  | 'equipe'
  | 'permissoes';

export interface ModulePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewFinancialDetails: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin Master',
  professional: 'Fisioterapeuta',
  secretary: 'Secretaria',
  patient: 'Paciente',
};

export function usePermissions() {
  const { user } = useAuth();
  const { roles, isLoading: rolesLoading, isAdmin, isProfessional, hasRole } = useUserRole();
  const [customPermissions, setCustomPermissions] = useState<UserPermissions | null>(null);
  const [roleDefaults, setRoleDefaults] = useState<UserPermissions | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const hasLoadedPermissions = useRef(false);

  const isSecretary = hasRole('secretary');
  const isAdminMaster = isAdmin;
  const isFisioterapeuta = isProfessional && !isAdmin && !isSecretary;

  // Load custom permissions and role defaults from database
  useEffect(() => {
    if (rolesLoading || !user?.id) return;

    const loadPermissions = async () => {
      try {
        // Load custom user permissions
        const userPerms = await UserPermissionService.getUserPermissions(user.id);
        setCustomPermissions(userPerms);

        // Load role defaults from DB (for non-admin users)
        if (!isAdminMaster) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('clinic_id')
            .eq('user_id', user.id)
            .single();

          if (profile?.clinic_id) {
            const primaryRole = isSecretary ? 'secretary' : isFisioterapeuta ? 'professional' : null;
            if (primaryRole) {
              const dbDefaults = await RolePermissionService.getRolePermissions(profile.clinic_id, primaryRole);
              setRoleDefaults(dbDefaults);
            }
          }
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        if (!hasLoadedPermissions.current) {
          hasLoadedPermissions.current = true;
          setIsLoadingPermissions(false);
        }
      }
    };

    loadPermissions();
  }, [rolesLoading, user?.id, isAdminMaster, isSecretary, isFisioterapeuta]);

  const permissions = useMemo(() => {
    const getModulePermissions = (module: PermissionModule): ModulePermissions => {
      // Admin Master: full access always
      if (isAdminMaster) {
        return { canView: true, canEdit: true, canDelete: true, canViewFinancialDetails: true };
      }

      // 1. Check custom user-level permissions first
      if (customPermissions && customPermissions[module]) {
        const customPerms = customPermissions[module] as ModulePermission;
        return {
          canView: customPerms.view === true || customPerms.view === 'own',
          canEdit: customPerms.edit === true || customPerms.edit === 'own',
          canDelete: customPerms.delete === true || customPerms.delete === 'own',
          canViewFinancialDetails: customPerms.financial === true,
        };
      }

      // 2. Check role defaults from DB
      if (roleDefaults && roleDefaults[module]) {
        const dbPerms = roleDefaults[module] as ModulePermission;
        return {
          canView: dbPerms.view === true || dbPerms.view === 'own',
          canEdit: dbPerms.edit === true || dbPerms.edit === 'own',
          canDelete: dbPerms.delete === true || dbPerms.delete === 'own',
          canViewFinancialDetails: dbPerms.financial === true,
        };
      }

      // 3. Fall back to hardcoded role-based defaults
      if (isSecretary) {
        return {
          canView: true,
          canEdit: module !== 'configuracoes',
          canDelete: module !== 'configuracoes',
          canViewFinancialDetails: false,
        };
      }

      if (isFisioterapeuta) {
        const restrictedModules: PermissionModule[] = ['profissionais', 'comercial', 'financeiro', 'configuracoes', 'equipe'];
        const viewOnlyModules: PermissionModule[] = ['servicos', 'engajamento'];
        
        if (restrictedModules.includes(module)) {
          return { canView: false, canEdit: false, canDelete: false, canViewFinancialDetails: false };
        }
        if (viewOnlyModules.includes(module)) {
          return { canView: true, canEdit: false, canDelete: false, canViewFinancialDetails: false };
        }
        return { canView: true, canEdit: true, canDelete: false, canViewFinancialDetails: false };
      }

      return { canView: false, canEdit: false, canDelete: false, canViewFinancialDetails: false };
    };

    return {
      dashboard: getModulePermissions('dashboard'),
      agenda: getModulePermissions('agenda'),
      pacientes: getModulePermissions('pacientes'),
      prontuarios: getModulePermissions('prontuarios'),
      profissionais: getModulePermissions('profissionais'),
      servicos: getModulePermissions('servicos'),
      comercial: getModulePermissions('comercial'),
      financeiro: getModulePermissions('financeiro'),
      engajamento: getModulePermissions('engajamento'),
      configuracoes: getModulePermissions('configuracoes'),
      equipe: getModulePermissions('equipe'),
      permissoes: getModulePermissions('permissoes'),
    };
  }, [isAdminMaster, isSecretary, isFisioterapeuta, customPermissions, roleDefaults]);

  const getRoleLabel = useCallback((role: string): string => {
    return ROLE_LABELS[role] || role;
  }, []);

  const getRolesLabels = useCallback((): string[] => {
    return roles.map(r => ROLE_LABELS[r] || r);
  }, [roles]);

  const isLoading = rolesLoading || isLoadingPermissions;

  return {
    permissions,
    isLoading,
    isAdminMaster,
    isSecretary,
    isFisioterapeuta,
    roles,
    getRoleLabel,
    getRolesLabels,
    customPermissions,
    hasCustomPermissions: customPermissions !== null && Object.keys(customPermissions).length > 0,
    canAccessModule: (module: PermissionModule) => permissions[module]?.canView ?? false,
    canEditModule: (module: PermissionModule) => permissions[module]?.canEdit ?? false,
    canViewFinancialDetails: permissions.financeiro?.canViewFinancialDetails ?? false,
  };
}
