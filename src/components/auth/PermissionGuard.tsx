import { useRef } from 'react';
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
 * After the first successful load, children stay mounted even during background re-checks.
 */
export function PermissionGuard({ children, module, redirectTo = '/' }: PermissionGuardProps) {
  const { canAccessModule, isLoading } = usePermissions();
  const hasLoadedOnce = useRef(false);

  if (!isLoading) {
    hasLoadedOnce.current = true;
  }

  // First load: show spinner
  if (isLoading && !hasLoadedOnce.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // After first load, only redirect if actually no access (not during loading)
  if (!isLoading && !canAccessModule(module)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
