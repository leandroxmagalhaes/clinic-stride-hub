import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user's clinic_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) return null;

      // Get clinic info
      const { data: clinic } = await supabase
        .from('clinics')
        .select('id, name, logo_url, phone, email, address')
        .eq('id', profile.clinic_id)
        .maybeSingle();

      return clinic;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
