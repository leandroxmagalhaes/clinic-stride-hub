import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

type DraftSource = "server" | "local" | "completed" | "none";

interface DetectedDraft {
  source: DraftSource;
  updatedAt: Date | null;
  answers: Record<string, Record<string, any>> | null;
  serverCompleto: boolean;
}

interface Props {
  pacienteId: string;
  templateId: string;
  onResume: (answers: Record<string, Record<string, any>>) => void;
  onStartFresh: () => void;
  onAlreadyCompleted?: () => void;
}

export function DraftDetectionBanner({ pacienteId, templateId, onResume, onStartFresh, onAlreadyCompleted }: Props) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DetectedDraft>({ source: "none", updatedAt: null, answers: null, serverCompleto: false });
  const [confirmFresh, setConfirmFresh] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let serverAnswers: Record<string, Record<string, any>> | null = null;
      let serverUpdatedAt: Date | null = null;
      let serverCompleto = false;

      try {
        const { data } = await (supabase as any)
          .from("portal_questionario")
          .select("respostas, completo, updated_at")
          .eq("paciente_id", pacienteId)
          .maybeSingle();
        if (data) {
          serverCompleto = !!data.completo;
          serverUpdatedAt = data.updated_at ? new Date(data.updated_at) : null;
          if (data.respostas && typeof data.respostas === "object" && Object.keys(data.respostas).length > 0) {
            serverAnswers = data.respostas;
          }
        }
      } catch {
        // ignore
      }

      // Local draft
      const localKey = `portal_questionario_draft:${pacienteId}:${templateId}`;
      let localAnswers: Record<string, Record<string, any>> | null = null;
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            localAnswers = parsed;
          }
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      if (serverCompleto) {
        setDraft({ source: "completed", updatedAt: serverUpdatedAt, answers: serverAnswers, serverCompleto: true });
      } else if (serverAnswers) {
        setDraft({ source: "server", updatedAt: serverUpdatedAt, answers: serverAnswers, serverCompleto: false });
      } else if (localAnswers) {
        setDraft({ source: "local", updatedAt: null, answers: localAnswers, serverCompleto: false });
      } else {
        setDraft({ source: "none", updatedAt: null, answers: null, serverCompleto: false });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pacienteId, templateId]);

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A verificar progresso anterior...
      </Card>
    );
  }

  if (draft.source === "completed") {
    return (
      <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-950/20">
        <div className="flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="font-semibold text-sm">Questionário já submetido</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submetido {draft.updatedAt ? formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: pt }) : "anteriormente"}.
              </p>
            </div>
            {onAlreadyCompleted && (
              <Button size="sm" variant="outline" onClick={onAlreadyCompleted}>
                Continuar para o Portal
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (draft.source === "server" && draft.answers) {
    return (
      <Card className="p-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <div className="flex gap-3">
          <RotateCcw className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Continuar onde parou</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tem respostas guardadas {draft.updatedAt ? formatDistanceToNow(draft.updatedAt, { addSuffix: true, locale: pt }) : "anteriormente"}.
                {" "}Pode continuar de onde estava ou começar do zero.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onResume(draft.answers!)}>
                Continuar
              </Button>
              {!confirmFresh ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmFresh(true)}>
                  Começar do zero
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-destructive">Tem a certeza? Vai perder o progresso.</span>
                  <Button size="sm" variant="destructive" onClick={onStartFresh}>Sim, recomeçar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmFresh(false)}>Cancelar</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (draft.source === "local" && draft.answers) {
    return (
      <Card className="p-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Rascunho local detetado</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Encontrámos respostas guardadas neste dispositivo que ainda não foram enviadas para o servidor.
                Pode continuar — vamos sincronizar automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onResume(draft.answers!)}>
                Continuar com rascunho local
              </Button>
              {!confirmFresh ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmFresh(true)}>
                  Descartar e começar
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-destructive">Confirmar — descartar rascunho?</span>
                  <Button size="sm" variant="destructive" onClick={() => {
                    try { localStorage.removeItem(`portal_questionario_draft:${pacienteId}:${templateId}`); } catch {}
                    onStartFresh();
                  }}>Sim, descartar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmFresh(false)}>Cancelar</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // No draft — render nothing, parent shows normal "Start" UI
  return null;
}
