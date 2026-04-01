import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireProfessional?: boolean;
}

export function ProtectedRoute({ children, requireProfessional = false }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: roleLoading, isPatient, isProfessional, isAdmin, isSecretary } = useUserRole();
  const location = useLocation();

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If route requires professional access, check roles
  if (requireProfessional) {
    const hasStaffRole = isProfessional || isAdmin || isSecretary;
    if (!hasStaffRole && isPatient) {
      // Patient trying to access Physione → redirect to portal
      return <Navigate to="/patient-portal" replace />;
    }
  }

  return <>{children}</>;
}
