import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsService } from '@/services/SettingsService';
import type { ClinicSettings, SettingsUpdatePayload } from '@/types/settings';
import { toast } from 'sonner';

const SETTINGS_QUERY_KEY = ['clinic-settings'];

/**
 * Custom hook for managing clinic settings
 * Provides reactive data fetching and optimistic updates
 */
export function useSettings() {
  const queryClient = useQueryClient();

  // Fetch settings with loading and error states
  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: SettingsService.getSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for saving settings with optimistic updates
  const saveMutation = useMutation({
    mutationFn: (payload: SettingsUpdatePayload) => 
      SettingsService.saveSettings(payload),
    
    // Optimistic update
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<ClinicSettings>(SETTINGS_QUERY_KEY);

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData<ClinicSettings>(SETTINGS_QUERY_KEY, {
          ...previousSettings,
          ...newData,
        });
      }

      return { previousSettings };
    },

    onError: (err, _newData, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previousSettings);
      }
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    },

    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
      toast.success('Configurações salvas com sucesso!');
    },
  });

  // Fetch clinic info as fallback for name
  const { data: clinicInfo } = useQuery({
    queryKey: ['clinic-info'],
    queryFn: SettingsService.getClinicInfo,
    staleTime: 10 * 60 * 1000,
  });

  return {
    settings,
    isLoading,
    error,
    refetch,
    saveSettings: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    clinicInfo,
  };
}
