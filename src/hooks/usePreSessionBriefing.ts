import { useState, useEffect, useCallback } from "react";
import { AIService } from "@/services/AIService";
import type { BriefingData } from "@/components/agenda/PreSessionBriefingCard";

interface UsePreSessionBriefingResult {
  briefing: BriefingData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePreSessionBriefing(
  sessionId: string | null,
  patientId: string | null
): UsePreSessionBriefingResult {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    if (!sessionId || !patientId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await AIService.generatePreSessionBriefing({
        patientId,
        sessionId,
      });
      setBriefing(result.data as unknown as BriefingData);
    } catch (err) {
      console.error("Error fetching briefing:", err);
      setError(err instanceof Error ? err.message : "Erro ao gerar briefing");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, patientId]);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const refresh = useCallback(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  return { briefing, isLoading, error, refresh };
}
