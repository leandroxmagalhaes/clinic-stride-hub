import { useMemo, useState, useEffect } from "react";
import { useUserRole } from "./useUserRole";
import { UserPermissionService, UserPermissions, ModulePermission } from "@/services/UserPermissionService";

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
  const { roles, isLoading: rolesLoading, isAdmin, isProfessional, hasRole } = useUserRole();
  const [customPermissions, setCustomPermissions] = useState<UserPermissions | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  const isSecretary = hasRole('secretary');
  const isAdminMaster = isAdmin;
  const isFisioterapeuta = isProfessional && !isAdmin && !isSecretary;

  // Load custom permissions from database
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await UserPermissionService.getCurrentUserPermissions();
        setCustomPermissions(permissions);
      } catch (error) {
        console.error('Error loading custom permissions:', error);
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    if (!rolesLoading) {
      loadPermissions();
    }
  }, [rolesLoading]);

  const permissions = useMemo(() => {
    const getModulePermissions = (module: PermissionModule): ModulePermissions => {
      // Admin Master: full access to everything (cannot be customized)
      if (isAdminMaster) {
        return {
          canView: true,
          canEdit: true,
          canDelete: true,
          canViewFinancialDetails: true,
        };
      }

      // Check for custom permissions first
      if (customPermissions && customPermissions[module]) {
        const customPerms = customPermissions[module] as ModulePermission;
        return {
          canView: customPerms.view === true || customPerms.view === 'own',
          canEdit: customPerms.edit === true || customPerms.edit === 'own',
          canDelete: customPerms.delete === true || customPerms.delete === 'own',
          canViewFinancialDetails: customPerms.financial === true,
        };
      }

      // Fall back to role-based defaults
      // Secretary: access to everything except financial reports/totals
      if (isSecretary) {
        return {
          canView: true,
          canEdit: module !== 'configuracoes',
          canDelete: module !== 'configuracoes',
          canViewFinancialDetails: false, // Can see individual payments but not totals/reports
        };
      }

      // Fisioterapeuta: restricted access
      if (isFisioterapeuta) {
        const restrictedModules: PermissionModule[] = ['profissionais', 'comercial', 'financeiro', 'configuracoes', 'equipe'];
        const viewOnlyModules: PermissionModule[] = ['servicos', 'engajamento'];
        
        if (restrictedModules.includes(module)) {
          return {
            canView: false,
            canEdit: false,
            canDelete: false,
            canViewFinancialDetails: false,
          };
        }

        if (viewOnlyModules.includes(module)) {
          return {
            canView: true,
            canEdit: false,
            canDelete: false,
            canViewFinancialDetails: false,
          };
        }

        // Can view/edit their own patients, sessions, records
        return {
          canView: true,
          canEdit: true,
          canDelete: false,
          canViewFinancialDetails: false,
        };
      }

      // Default: no access
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canViewFinancialDetails: false,
      };
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
  }, [isAdminMaster, isSecretary, isFisioterapeuta, customPermissions]);

  const getRoleLabel = (role: string): string => {
    return ROLE_LABELS[role] || role;
  };

  const getRolesLabels = (): string[] => {
    return roles.map(getRoleLabel);
  };

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
