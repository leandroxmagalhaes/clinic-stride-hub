import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, addDays } from "date-fns";

export type Frequency = "weekly" | "biweekly" | "monthly" | "every2months" | "every3months" | "every6months";

export interface FixedClient {
  id: string;
  paciente_id: string | null;
  nome: string;
  telefone: string | null;
  especialidade: string | null;
  frequencia: Frequency;
  sessoes_por_periodo: number;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  every2months: "A cada 2 meses",
  every3months: "A cada 3 meses",
  every6months: "A cada 6 meses",
};

export const FREQUENCY_SHORT: Record<Frequency, string> = {
  weekly: "/sem",
  biweekly: "/quinz",
  monthly: "/mês",
  every2months: "/2m",
  every3months: "/3m",
  every6months: "/6m",
};

function getPeriodRange(freq: Frequency): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (freq) {
    case "weekly":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "biweekly":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = addDays(start, 13);
      break;
    case "monthly":
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case "every2months":
      start = subMonths(now, 2);
      end = now;
      break;
    case "every3months":
      start = subMonths(now, 3);
      end = now;
      break;
    case "every6months":
      start = subMonths(now, 6);
      end = now;
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function useFixedClients(clinicId: string | null) {
  const [fixedClients, setFixedClients] = useState<FixedClient[]>([]);
  const [fixedClientSessions, setFixedClientSessions] = useState<Record<string, number>>({});

  const fetchFixedClients = useCallback(async () => {
    if (!clinicId) return;
    const { data, error } = await (supabase as any)
      .from("clientes_fixos")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching fixed clients:", error);
      return;
    }
    const clients: FixedClient[] = (data || []).map((r: any) => ({
      id: r.id,
      paciente_id: r.paciente_id || null,
      nome: r.nome,
      telefone: r.telefone || null,
      especialidade: r.especialidade || null,
      frequencia: r.frequencia as Frequency,
      sessoes_por_periodo: r.sessoes_por_periodo,
    }));
    setFixedClients(clients);
    await fetchSessionCounts(clients);
  }, [clinicId]);

  const fetchSessionCounts = useCallback(async (clients: FixedClient[]) => {
    const counts: Record<string, number> = {};
    for (const client of clients) {
      if (!client.paciente_id) {
        counts[client.id] = 0;
        continue;
      }
      const { start, end } = getPeriodRange(client.frequencia);
      const { data, error } = await (supabase as any)
        .from("sessoes")
        .select("id")
        .eq("paciente_id", client.paciente_id)
        .gte("start_time", start)
        .lte("start_time", end)
        .neq("status", "cancelado");
      if (error) {
        counts[client.id] = 0;
      } else {
        counts[client.id] = data?.length || 0;
      }
    }
    setFixedClientSessions(counts);
  }, []);

  const addFixedClient = useCallback(async (data: { nome: string; telefone?: string; especialidade?: string; frequencia: Frequency; sessoes_por_periodo: number; paciente_id?: string }) => {
    if (!clinicId) return;
    const { error } = await (supabase as any)
      .from("clientes_fixos")
      .insert({
        clinic_id: clinicId,
        nome: data.nome,
        telefone: data.telefone || null,
        especialidade: data.especialidade || null,
        frequencia: data.frequencia,
        sessoes_por_periodo: data.sessoes_por_periodo,
        paciente_id: data.paciente_id || null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Cliente fixo adicionado");
    await fetchFixedClients();
  }, [clinicId, fetchFixedClients]);

  const editFixedClient = useCallback(async (id: string, data: { nome: string; telefone?: string; especialidade?: string; frequencia: Frequency; sessoes_por_periodo: number; paciente_id?: string }) => {
    const { error } = await (supabase as any)
      .from("clientes_fixos")
      .update({
        nome: data.nome,
        telefone: data.telefone || null,
        especialidade: data.especialidade || null,
        frequencia: data.frequencia,
        sessoes_por_periodo: data.sessoes_por_periodo,
        paciente_id: data.paciente_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Cliente fixo atualizado");
    await fetchFixedClients();
  }, [fetchFixedClients]);

  const removeFixedClient = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("clientes_fixos")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Cliente fixo removido");
    await fetchFixedClients();
  }, [fetchFixedClients]);

  const totalMissingSessions = fixedClients.reduce((sum, c) => {
    const booked = fixedClientSessions[c.id] || 0;
    return sum + Math.max(0, c.sessoes_por_periodo - booked);
  }, 0);

  return {
    fixedClients,
    fixedClientSessions,
    totalMissingSessions,
    fetchFixedClients,
    addFixedClient,
    editFixedClient,
    removeFixedClient,
  };
}
