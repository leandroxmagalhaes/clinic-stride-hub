import { useState, useEffect, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, BookOpen, ArrowLeftRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiaryNewEntryForm } from "@/components/patient-portal/DiaryNewEntryForm";
import { DiaryEntryCard, type DiaryEntry } from "@/components/patient-portal/DiaryEntryCard";
import type { DiaryReply } from "@/components/patient-portal/DiaryReplyThread";
import { ProfileSelector } from "@/components/patient-portal/ProfileSelector";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ProfileType = "baby" | "child" | "adult" | "elderly";

export default function PatientPortal() {
  const { user, loading: authLoading } = useAuth();
  const { isPatient, isLoading: roleLoading } = useUserRole();

  const [contaId, setContaId] = useState<string | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<string[]>([]);
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [perfilTipo, setPerfilTipo] = useState<ProfileType>("adult");
  const [patientName, setPatientName] = useState("Paciente");
  const [resolving, setResolving] = useState(true);

  // Resolve conta and linked patients
  useEffect(() => {
    if (!user) return;
    (async () => {
      setResolving(true);

      // Get portal account
      const { data: conta } = await (supabase as any)
        .from("portal_contas")
        .select("id, paciente_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!conta) {
        setResolving(false);
        return;
      }

      setContaId(conta.id);

      // Get linked patients from portal_conta_pacientes
      const { data: links } = await (supabase as any)
        .from("portal_conta_pacientes")
        .select("paciente_id")
        .eq("conta_id", conta.id);

      const patientIds = (links || []).map((l: any) => l.paciente_id);

      // Fallback: if no links exist yet, use legacy paciente_id
      if (patientIds.length === 0 && conta.paciente_id) {
        patientIds.push(conta.paciente_id);
      }

      setLinkedPatients(patientIds);

      if (patientIds.length === 1) {
        setSelectedPacienteId(patientIds[0]);
        setShowProfileSelector(false);
      } else if (patientIds.length > 1) {
        setShowProfileSelector(true);
      }

      setResolving(false);
    })();
  }, [user]);

  // Load diary when patient selected
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
    if (!selectedPacienteId) return;
    (async () => {
      // Load profile type
      const { data: questionario } = await (supabase as any)
        .from("portal_questionario")
        .select("perfil_tipo")
        .eq("paciente_id", selectedPacienteId)
        .maybeSingle();
      if (questionario?.perfil_tipo) setPerfilTipo(questionario.perfil_tipo);

      // Load patient name
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("full_name")
        .eq("id", selectedPacienteId)
        .maybeSingle();
      if (paciente) setPatientName(paciente.full_name);

      await loadEntries(selectedPacienteId);
    })();
  }, [selectedPacienteId, loadEntries]);

  const handleProfileSelect = (pacienteId: string) => {
    setSelectedPacienteId(pacienteId);
    setShowProfileSelector(false);
  };

  const handleSwitchProfile = () => {
    setSelectedPacienteId(null);
    setShowProfileSelector(true);
    setEntries([]);
    setShowForm(false);
  };

  const handleSubmit = async (data: {
    humor: string;
    categoria: string;
    texto: string;
    nivel_dor: number | null;
    foto_file: File | null;
  }) => {
    if (!selectedPacienteId) return;
    setIsSubmitting(true);
    try {
      let fotoUrl: string | null = null;
      let temFoto = false;

      if (data.foto_file) {
        const filename = `${Date.now()}_${data.foto_file.name}`;
        const path = `${selectedPacienteId}/diary/${filename}`;
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

      const { data: newEntry, error } = await (supabase as any)
        .from("portal_diario")
        .insert({
          paciente_id: selectedPacienteId,
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

      await (supabase as any).from("portal_notificacoes").insert({
        paciente_id: selectedPacienteId,
        tipo: "diary_entry",
        titulo: `${autorNome} escreveu no diário de ${patientName}`,
        texto_preview: data.texto.slice(0, 100),
        urgente: isUrgent,
        referencia_id: newEntry?.id,
      });

      toast.success("Entrada guardada!");
      setShowForm(false);
      await loadEntries(selectedPacienteId);
    } catch (err) {
      toast.error("Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (diarioId: string, texto: string) => {
    if (!selectedPacienteId) return;
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

    await (supabase as any).from("portal_notificacoes").insert({
      paciente_id: selectedPacienteId,
      tipo: "diary_reply",
      titulo: `${autorNome} respondeu no diário`,
      texto_preview: texto.slice(0, 100),
      urgente: false,
      referencia_id: diarioId,
    });

    toast.success("Resposta enviada!");
    await loadEntries(selectedPacienteId);
  };

  // Loading state
  if (authLoading || roleLoading || resolving) {
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

  // Profile selector for multi-patient accounts
  if (showProfileSelector && contaId) {
    return <ProfileSelector contaId={contaId} onSelect={handleProfileSelect} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-display font-bold">Meu Diário</h1>
              <p className="text-xs text-muted-foreground">{patientName}</p>
            </div>
          </div>
          {linkedPatients.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handleSwitchProfile} className="gap-1.5 text-xs">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Trocar
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
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
