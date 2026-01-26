import { Navigate } from 'react-router-dom';
import { usePermissions, PermissionModule } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  module: PermissionModule;
  redirectTo?: string;
}

/**
 * Wraps a component and only renders it if the user has permission to access the module.
 * Otherwise redirects to the specified route (defaults to /).
 */
export function PermissionGuard({ children, module, redirectTo = '/' }: PermissionGuardProps) {
  const { canAccessModule, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!canAccessModule(module)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
