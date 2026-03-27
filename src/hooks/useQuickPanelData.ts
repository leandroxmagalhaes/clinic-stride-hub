import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WaitingPatient, QuickNote, NoteType } from "@/components/agenda/quick-panel/types";

// Field mapping helpers
function mapDbToWaitingPatient(row: any): WaitingPatient {
  const createdAt = row.created_at ? row.created_at.split("T")[0] : new Date().toISOString().split("T")[0];
  const now = new Date();
  const created = new Date(row.created_at);
  const daysWaiting = Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    id: row.id,
    name: row.nome,
    phone: row.telefone,
    specialty: row.especialidade,
    priority: row.prioridade,
    observations: row.observacoes || undefined,
    daysWaiting,
    addedAt: createdAt,
  };
}

function mapDbToNote(row: any): QuickNote {
  const typeMap: Record<string, NoteType> = { tarefa: "tarefa", lembrete: "lembrete", fixa: "fixa" };
  return {
    id: row.id,
    type: typeMap[row.tipo] || "tarefa",
    text: row.texto,
    completed: row.concluida ?? false,
    deadline: row.data_prazo || undefined,
    createdAt: row.created_at ? row.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
  };
}

export function useQuickPanelData(clinicId: string | null, panelOpen: boolean) {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWaitingList = useCallback(async () => {
    if (!clinicId) return;
    const { data, error } = await (supabase as any)
      .from("lista_espera")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching waiting list:", error);
      return;
    }
    setWaitingPatients((data || []).map(mapDbToWaitingPatient));
  }, [clinicId]);

  const fetchNotes = useCallback(async () => {
    if (!clinicId) return;
    const { data, error } = await (supabase as any)
      .from("notas_lembretes")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching notes:", error);
      return;
    }
    setQuickNotes((data || []).map(mapDbToNote));
  }, [clinicId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchWaitingList(), fetchNotes()]);
    setLoading(false);
  }, [fetchWaitingList, fetchNotes]);

  // Fetch on mount and when clinicId changes
  useEffect(() => {
    if (clinicId) fetchAll();
  }, [clinicId, fetchAll]);

  // Re-fetch when panel opens
  useEffect(() => {
    if (panelOpen && clinicId) fetchAll();
  }, [panelOpen, clinicId, fetchAll]);

  // --- Waiting list CRUD ---
  const addPatient = useCallback(async (data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => {
    if (!clinicId) return;
    const { error } = await (supabase as any)
      .from("lista_espera")
      .insert({
        clinic_id: clinicId,
        nome: data.name,
        telefone: data.phone,
        especialidade: data.specialty,
        prioridade: data.priority,
        observacoes: data.observations || "",
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Paciente adicionado à lista de espera");
    await fetchWaitingList();
  }, [clinicId, fetchWaitingList]);

  const editPatient = useCallback(async (id: string, data: Omit<WaitingPatient, "id" | "daysWaiting" | "addedAt">) => {
    const { error } = await (supabase as any)
      .from("lista_espera")
      .update({
        nome: data.name,
        telefone: data.phone,
        especialidade: data.specialty,
        prioridade: data.priority,
        observacoes: data.observations || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Paciente atualizado");
    await fetchWaitingList();
  }, [fetchWaitingList]);

  const removePatient = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("lista_espera")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Paciente removido da lista");
    await fetchWaitingList();
  }, [fetchWaitingList]);

  // --- Notes CRUD ---
  const addNote = useCallback(async (data: { type: NoteType; text: string; deadline?: string }) => {
    if (!clinicId) return;
    const { error } = await (supabase as any)
      .from("notas_lembretes")
      .insert({
        clinic_id: clinicId,
        tipo: data.type,
        texto: data.text,
        concluida: false,
        data_prazo: data.deadline || null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Nota adicionada");
    await fetchNotes();
  }, [clinicId, fetchNotes]);

  const editNote = useCallback(async (id: string, data: { type: NoteType; text: string; deadline?: string }) => {
    const { error } = await (supabase as any)
      .from("notas_lembretes")
      .update({
        tipo: data.type,
        texto: data.text,
        data_prazo: data.deadline || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Nota atualizada");
    await fetchNotes();
  }, [fetchNotes]);

  const removeNote = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("notas_lembretes")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    toast.success("Nota removida");
    await fetchNotes();
  }, [fetchNotes]);

  const toggleNote = useCallback(async (id: string) => {
    const current = quickNotes.find((n) => n.id === id);
    if (!current) return;
    const { error } = await (supabase as any)
      .from("notas_lembretes")
      .update({
        concluida: !current.completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao guardar. Tente novamente.");
      return;
    }
    await fetchNotes();
  }, [quickNotes, fetchNotes]);

  return {
    waitingPatients,
    quickNotes,
    loading,
    addPatient,
    editPatient,
    removePatient,
    addNote,
    editNote,
    removeNote,
    toggleNote,
  };
}
