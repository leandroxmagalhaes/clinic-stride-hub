import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { PortalAccountService } from "@/services/PortalAccountService";

interface Mensagem {
  id: string;
  autor_tipo: "professional" | "patient";
  autor_nome: string;
  texto: string;
  created_at: string;
}

export default function PortalMensagens() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [pacienteNome, setPacienteNome] = useState<string>("");
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate("/portal/login");
      return;
    }
    (async () => {
      const result = await PortalAccountService.resolveForUser(user.id);
      if (result.status === "ok" && result.primaryPacienteId) {
        setPacienteId(result.primaryPacienteId);
        setPacienteNome(result.pacienteNome || "");
      } else {
        navigate("/patient-portal");
      }
    })();
  }, [user, navigate]);

  const loadMessages = useCallback(async (pid: string) => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("portal_mensagens")
      .select("*")
      .eq("paciente_id", pid)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
    // Mark professional messages as read
    await (supabase as any)
      .from("portal_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("paciente_id", pid)
      .eq("autor_tipo", "professional")
      .is("lida_em", null);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    if (pacienteId) loadMessages(pacienteId);
  }, [pacienteId, loadMessages]);

  // Realtime
  useEffect(() => {
    if (!pacienteId) return;
    const ch = supabase
      .channel(`portal_msgs_patient_${pacienteId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portal_mensagens", filter: `paciente_id=eq.${pacienteId}` },
        () => loadMessages(pacienteId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [pacienteId, loadMessages]);

  const handleSend = async () => {
    if (!draft.trim() || !pacienteId) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("portal_mensagens").insert({
        paciente_id: pacienteId,
        autor_tipo: "patient",
        autor_id: user?.id,
        autor_nome: pacienteNome || "Utente",
        texto: draft.trim(),
      });
      if (error) throw error;
      setDraft("");
      await loadMessages(pacienteId);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patient-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Mensagens
            </h1>
            <p className="text-xs text-muted-foreground">Conversa com a clínica</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <Card className="flex flex-col h-[calc(100vh-180px)]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sem mensagens ainda. Quando a clínica lhe enviar uma mensagem irá aparecer aqui.
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.autor_tipo === "patient" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        m.autor_tipo === "patient"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                      <p className="text-[10px] opacity-70 mt-1">
                        {m.autor_nome} ·{" "}
                        {formatDistanceToNow(new Date(m.created_at), {
                          locale: pt,
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-3 border-t flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
