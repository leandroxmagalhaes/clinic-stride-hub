import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getAuthContext } from '@/lib/auth-helpers';

interface ClinicInfo {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/**
 * Hook to fetch the current user's clinic information
 */
export function useClinicInfo() {
  return useQuery({
    queryKey: ['clinic-info'],
    queryFn: async (): Promise<ClinicInfo | null> => {
      let clinicId: string;
      try {
        ({ clinicId } = await getAuthContext());
      } catch {
        return null;
      }

      // Get clinic info
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id, name, logo_url, phone, email, address')
        .eq('id', clinicId)
        .maybeSingle();

      return clinic;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
