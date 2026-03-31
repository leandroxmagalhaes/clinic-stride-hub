import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DiaryEntryCard, type DiaryEntry } from "@/components/patient-portal/DiaryEntryCard";
import type { DiaryReply } from "@/components/patient-portal/DiaryReplyThread";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface PatientDiaryTabProps {
  pacienteId: string;
  patientName: string;
}

export function PatientDiaryTab({ pacienteId, patientName }: PatientDiaryTabProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLabel, setProfileLabel] = useState("Paciente");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load entries
      const { data: diarioData } = await (supabase as any)
        .from("portal_diario")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      // Load replies for all entries
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

      const mapped: DiaryEntry[] = (diarioData || []).map((e: any) => ({
        ...e,
        replies: repliesMap[e.id] || [],
      }));

      setEntries(mapped);

      // Load profile type for label
      const { data: questionario } = await (supabase as any)
        .from("portal_questionario")
        .select("perfil_tipo")
        .eq("paciente_id", pacienteId)
        .maybeSingle();

      if (questionario?.perfil_tipo) {
        const labels: Record<string, string> = {
          baby: "Pais",
          child: "Pais / Paciente",
          adult: "Paciente",
          elderly: "Paciente / Cuidador",
        };
        setProfileLabel(labels[questionario.perfil_tipo] || "Paciente");
      }
    } catch (err) {
      console.error("Error loading diary:", err);
    } finally {
      setIsLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReply = async (diarioId: string, texto: string) => {
    // Get professional name
    let autorNome = "Profissional";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) autorNome = profile.full_name;
    }

    const { error } = await (supabase as any).from("portal_respostas").insert({
      diario_id: diarioId,
      autor_nome: autorNome,
      autor_tipo: "professional",
      texto,
    });

    if (error) {
      toast.error("Erro ao enviar resposta");
      return;
    }

    toast.success("Resposta enviada!");
    await loadData();
  };

  // Find concerning entries (since last session, or all if no session)
  const concerningEntries = entries.filter(
    (e) => e.categoria === "worsening" || e.categoria === "fall" || (e.nivel_dor != null && e.nivel_dor >= 6)
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="font-display text-lg">Diário do Paciente</CardTitle>
            <Badge variant="secondary" className="text-xs">{entries.length} registos</Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Registos por: {profileLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerts */}
        {concerningEntries.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pontos de atenção</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 space-y-1">
                {concerningEntries.slice(0, 5).map((e) => (
                  <li key={e.id} className="text-xs">
                    {new Date(e.created_at).toLocaleDateString("pt-BR")} — {e.categoria === "worsening" ? "📉 Piora" : e.categoria === "fall" ? "⚡ Queda" : ""}{e.nivel_dor != null && e.nivel_dor >= 6 ? ` 🔥 Dor ${e.nivel_dor}/10` : ""}: {e.texto.slice(0, 80)}...
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Timeline */}
        {entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma entrada no diário ainda.</p>
            <p className="text-xs mt-1">As entradas aparecerão aqui quando o paciente escrever no portal.</p>
          </div>
        ) : (
          <div className="space-y-3 relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />
            {entries.map((entry) => (
              <div key={entry.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-3.5 top-4 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <DiaryEntryCard
                  entry={entry}
                  onReply={handleReply}
                  autorTipo="professional"
                  showAlertStyle
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
