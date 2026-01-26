import { useMemo } from "react";
import { useUserRole } from "./useUserRole";

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
  | 'equipe';

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
  const { roles, isLoading, isAdmin, isProfessional, hasRole } = useUserRole();

  const isSecretary = hasRole('secretary');
  const isAdminMaster = isAdmin;
  const isFisioterapeuta = isProfessional && !isAdmin && !isSecretary;

  const permissions = useMemo(() => {
    const getModulePermissions = (module: PermissionModule): ModulePermissions => {
      // Admin Master: full access to everything
      if (isAdminMaster) {
        return {
          canView: true,
          canEdit: true,
          canDelete: true,
          canViewFinancialDetails: true,
        };
      }

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
    };
  }, [isAdminMaster, isSecretary, isFisioterapeuta]);

  const getRoleLabel = (role: string): string => {
    return ROLE_LABELS[role] || role;
  };

  const getRolesLabels = (): string[] => {
    return roles.map(getRoleLabel);
  };

  return {
    permissions,
    isLoading,
    isAdminMaster,
    isSecretary,
    isFisioterapeuta,
    roles,
    getRoleLabel,
    getRolesLabels,
    canAccessModule: (module: PermissionModule) => permissions[module]?.canView ?? false,
    canEditModule: (module: PermissionModule) => permissions[module]?.canEdit ?? false,
    canViewFinancialDetails: permissions.financeiro?.canViewFinancialDetails ?? false,
  };
}
