import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface UnifiedItem {
  id: string;
  paciente_id: string;
  autor_tipo: "patient" | "professional";
  autor_nome: string;
  texto: string;
  tipo: "mensagem" | "diario";
  humor: string | null;
  categoria: string | null;
  nivel_dor: number | null;
  created_at: string;
  origem: "mensagem" | "diario_legacy" | "resposta_legacy";
}

const moodEmojis: Record<string, string> = {
  great: "😄", good: "🙂", okay: "😐", bad: "😟", terrible: "😢",
};

const categoryLabels: Record<string, string> = {
  observation: "Observação", milestone: "Marco", worsening: "Piora",
  fall: "Queda", exercise: "Exercício", pain: "Dor", sleep: "Sono",
  medication: "Medicação", question: "Pergunta", improvement: "Melhoria",
};

interface Props {
  pacienteId: string;
  /** "professional" = bolha azul à direita; "patient" = bolha azul à direita */
  viewerTipo: "professional" | "patient";
  compact?: boolean;
  className?: string;
}

export function useUnifiedThread(pacienteId: string | null) {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!pacienteId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("listar_thread_unificado", {
      p_paciente_id: pacienteId,
    });
    if (!error) setItems((data || []) as UnifiedItem[]);
    setLoading(false);
  }, [pacienteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // realtime — unique channel per subscriber instance to evitar colisões
  useEffect(() => {
    if (!pacienteId) return;
    const channelName = `unified_${pacienteId}_${Math.random().toString(36).slice(2, 9)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_mensagens", filter: `paciente_id=eq.${pacienteId}` },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [pacienteId, refresh]);

  return { items, loading, refresh };
}

export function UnifiedThread({ pacienteId, viewerTipo, compact, className }: Props) {
  const { items, loading } = useUnifiedThread(pacienteId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [items.length]);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        Sem mensagens ainda.
      </p>
    );
  }

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div className={cn("space-y-3", compact ? "p-2" : "p-4")}>
        {items.map((m) => {
          const isMine = m.autor_tipo === viewerTipo;
          const isDiary = m.tipo === "diario";

          if (isDiary) {
            const urgent = m.categoria === "worsening" || m.categoria === "fall" || (m.nivel_dor != null && m.nivel_dor >= 6);
            return (
              <div key={m.id} className="flex justify-center">
                <div className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 border w-full",
                  urgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                )}>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-white">📔 Diário</Badge>
                    {m.humor && <span className="text-base">{moodEmojis[m.humor] || "😐"}</span>}
                    {m.categoria && m.categoria !== "observation" && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {categoryLabels[m.categoria] || m.categoria}
                      </Badge>
                    )}
                    {m.nivel_dor != null && (
                      <Badge variant={m.nivel_dor >= 6 ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                        Dor: {m.nivel_dor}/10
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {m.autor_nome} · {format(new Date(m.created_at), "dd/MM HH:mm")}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2",
                isMine ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                <p className="text-[10px] opacity-70 mt-1">
                  {m.autor_nome} · {format(new Date(m.created_at), "dd/MM HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}

/** Helper para enviar mensagem/diário via RPC */
export async function enviarMensagemUnificada(params: {
  paciente_id: string;
  texto: string;
  autor_tipo: "patient" | "professional";
  autor_nome: string;
  tipo?: "mensagem" | "diario";
  humor?: string | null;
  categoria?: string | null;
  nivel_dor?: number | null;
}) {
  const { error, data } = await (supabase as any).rpc("enviar_mensagem_unificada", {
    p_paciente_id: params.paciente_id,
    p_texto: params.texto,
    p_autor_tipo: params.autor_tipo,
    p_autor_nome: params.autor_nome,
    p_tipo: params.tipo || "mensagem",
    p_humor: params.humor ?? null,
    p_categoria: params.categoria ?? null,
    p_nivel_dor: params.nivel_dor ?? null,
  });
  if (error) throw error;
  return data;
}
