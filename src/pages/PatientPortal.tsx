import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiaryNewEntryForm } from "@/components/patient-portal/DiaryNewEntryForm";
import { DiaryEntryCard, type DiaryEntry } from "@/components/patient-portal/DiaryEntryCard";
import type { DiaryReply } from "@/components/patient-portal/DiaryReplyThread";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ProfileType = "baby" | "child" | "adult" | "elderly";

export default function PatientPortal() {
  const { user, loading: authLoading } = useAuth();
  const { isPatient, isLoading: roleLoading } = useUserRole();

  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [perfilTipo, setPerfilTipo] = useState<ProfileType>("adult");
  const [patientName, setPatientName] = useState("Paciente");
  const [pacienteId, setPacienteId] = useState<string | null>(null);

  // Resolve paciente_id from portal_contas using auth user id
  const resolvePatientId = useCallback(async () => {
    if (!user) return null;
    const { data } = await (supabase as any)
      .from("portal_contas")
      .select("paciente_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return data?.paciente_id || null;
  }, [user]);

  const loadEntries = useCallback(async (pid: string) => {
    setIsLoadingEntries(true);
    try {
      const { data: diarioData } = await (supabase as any)
        .from("portal_diario")
        .select("*")
        .eq("paciente_id", pid)
        .order("created_at", { ascending: false })
        .limit(30);

      const entryIds = (diarioData || []).map((e: any) => e.id);
      let repliesMap: Record<string, DiaryReply[]> = {};
      if (entryIds.length > 0) {
        const { data: respostasData } = await (supabase as any)
          .from("portal_respostas")
          .select("*")
          .in("diario_id", entryIds)
          .order("created_at", { ascending: true });

        (respostasData || []).forEach((r: any) => {
          if (!repliesMap[r.diario_id]) repliesMap[r.diario_id] = [];
          repliesMap[r.diario_id].push(r);
        });
      }

      setEntries((diarioData || []).map((e: any) => ({ ...e, replies: repliesMap[e.id] || [] })));
    } catch (err) {
      console.error("Error loading diary entries:", err);
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const pid = await resolvePatientId();
      if (!pid) return;
      setPacienteId(pid);

      // Load profile type
      const { data: questionario } = await (supabase as any)
        .from("portal_questionario")
        .select("perfil_tipo")
        .eq("paciente_id", pid)
        .maybeSingle();
      if (questionario?.perfil_tipo) setPerfilTipo(questionario.perfil_tipo);

      // Load patient name
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("full_name")
        .eq("id", pid)
        .maybeSingle();
      if (paciente) setPatientName(paciente.full_name);

      await loadEntries(pid);
    })();
  }, [user, resolvePatientId, loadEntries]);

  const handleSubmit = async (data: {
    humor: string;
    categoria: string;
    texto: string;
    nivel_dor: number | null;
    foto_file: File | null;
  }) => {
    if (!pacienteId) return;
    setIsSubmitting(true);
    try {
      let fotoUrl: string | null = null;
      let temFoto = false;

      // Upload photo if present
      if (data.foto_file) {
        const filename = `${Date.now()}_${data.foto_file.name}`;
        const path = `${pacienteId}/diary/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("patient-documents")
          .upload(path, data.foto_file);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("patient-documents").getPublicUrl(path);
          fotoUrl = urlData?.publicUrl || null;
          temFoto = true;
        }
      }

      const autorNome = patientName.split(" ")[0];
      const isUrgent = data.categoria === "worsening" || data.categoria === "fall" || (data.nivel_dor != null && data.nivel_dor >= 6);

      // Insert diary entry
      const { data: newEntry, error } = await (supabase as any)
        .from("portal_diario")
        .insert({
          paciente_id: pacienteId,
          autor_nome: autorNome,
          humor: data.humor,
          categoria: data.categoria,
          texto: data.texto,
          nivel_dor: data.nivel_dor,
          tem_foto: temFoto,
          foto_url: fotoUrl,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao guardar entrada");
        return;
      }

      // Create notification for professional
      await (supabase as any).from("portal_notificacoes").insert({
        paciente_id: pacienteId,
        tipo: "diary_entry",
        titulo: `${autorNome} escreveu no diário de ${patientName}`,
        texto_preview: data.texto.slice(0, 100),
        urgente: isUrgent,
        referencia_id: newEntry?.id,
      });

      toast.success("Entrada guardada!");
      setShowForm(false);
      await loadEntries(pacienteId);
    } catch (err) {
      toast.error("Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (diarioId: string, texto: string) => {
    if (!pacienteId) return;
    const autorNome = patientName.split(" ")[0];

    const { error } = await (supabase as any).from("portal_respostas").insert({
      diario_id: diarioId,
      autor_nome: autorNome,
      autor_tipo: "patient",
      texto,
    });

    if (error) {
      toast.error("Erro ao enviar resposta");
      return;
    }

    // Notification
    await (supabase as any).from("portal_notificacoes").insert({
      paciente_id: pacienteId,
      tipo: "diary_reply",
      titulo: `${autorNome} respondeu no diário`,
      texto_preview: texto.slice(0, 100),
      urgente: false,
      referencia_id: diarioId,
    });

    toast.success("Resposta enviada!");
    await loadEntries(pacienteId);
  };

  // Loading state
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isPatient) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold">Meu Diário</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Show Form or CTA Button */}
        {showForm ? (
          <DiaryNewEntryForm
            perfilTipo={perfilTipo}
            patientName={patientName}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed border-primary/30 hover:border-primary/50"
            onClick={() => setShowForm(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Nova Entrada no Diário</h2>
              <p className="text-muted-foreground">Partilhe como está o seu dia</p>
            </CardContent>
          </Card>
        )}

        {/* Entry list */}
        {isLoadingEntries ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma entrada ainda.</p>
            <p className="text-xs mt-1">Comece por partilhar como se sente hoje!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Entradas anteriores</h3>
            {entries.map((entry) => (
              <DiaryEntryCard
                key={entry.id}
                entry={entry}
                onReply={handleReply}
                autorTipo="patient"
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
