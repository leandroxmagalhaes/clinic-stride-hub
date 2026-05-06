import { memo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, ArrowLeft, Send, ExternalLink, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  UnifiedThread,
  useUnifiedThread,
  enviarMensagemUnificada,
} from "@/components/messages/UnifiedThread";

interface ConversationSummary {
  paciente_id: string;
  paciente_nome: string;
  ultima_mensagem: string | null;
  ultima_data: string | null;
  nao_lidas: number;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function getAvatarColor(name: string) {
  const colors = ["bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-violet-500","bg-cyan-500","bg-pink-500","bg-teal-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export const DiaryFloatingButton = memo(function DiaryFloatingButton() {
  const { isPatient, isProfessional, isAdmin, isSecretary, isLoading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [bounce, setBounce] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [profName, setProfName] = useState("Profissional");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { refresh: refreshThread } = useUnifiedThread(selectedPatient?.id || null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setProfName(data.full_name); });
  }, [user]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("listar_conversas_recentes");
      if (error) throw error;
      const convos = (data || []) as ConversationSummary[];
      setConversations(convos);
      setTotalUnread(convos.reduce((s, c) => s + (c.nao_lidas || 0), 0));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const t = setInterval(fetchConversations, 30000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // Realtime: refresh when any portal_mensagens row changes
  useEffect(() => {
    const ch = supabase
      .channel("portal_msgs_floating")
      .on("postgres_changes", { event: "*", schema: "public", table: "portal_mensagens" }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchConversations]);

  useEffect(() => {
    if (totalUnread > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
  }, [totalUnread]);

  const openChat = useCallback(async (id: string, name: string) => {
    setSelectedPatient({ id, name });
    setView("chat");
    // mark patient messages as read
    await (supabase as any)
      .from("portal_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("paciente_id", id)
      .eq("autor_tipo", "patient")
      .is("lida_em", null);
    fetchConversations();
  }, [fetchConversations]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedPatient) return;
    setSending(true);
    try {
      await enviarMensagemUnificada({
        paciente_id: selectedPatient.id,
        texto: draft.trim(),
        autor_tipo: "professional",
        autor_nome: profName,
        tipo: "mensagem",
      });
      setDraft("");
      await refreshThread();
      await fetchConversations();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setView("list");
    setSelectedPatient(null);
  };

  const hasStaffRole = isProfessional || isAdmin || isSecretary;
  if (!hasStaffRole && isPatient) return null;
  if (roleLoading) return null;

  return (
    <>
      <button
        onClick={() => { if (open) handleClose(); else setOpen(true); }}
        className={cn(
          "fixed bottom-6 right-6 z-[90] flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105",
          "bg-gradient-to-br from-blue-800 to-blue-500",
          bounce && "animate-bounce"
        )}
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
        aria-label="Mensagens"
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white bg-destructive">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-[84px] right-6 z-[95] w-[400px] max-h-[600px] rounded-xl border bg-background shadow-xl flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
        >
          {view === "list" ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <h3 className="font-semibold text-sm">💬 Mensagens</h3>
                  {totalUnread > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {totalUnread} não lida{totalUnread !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                {loading && conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Sem conversas recentes</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((c) => (
                      <button
                        key={c.paciente_id}
                        onClick={() => openChat(c.paciente_id, c.paciente_nome)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors hover:bg-accent/50 flex items-center gap-3",
                          c.nao_lidas > 0 && "bg-amber-50"
                        )}
                      >
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getAvatarColor(c.paciente_nome))}>
                          {getInitials(c.paciente_nome)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{c.paciente_nome}</p>
                            {c.ultima_data && (
                              <span className="text-[10px] text-muted-foreground/60 ml-2 flex-shrink-0">
                                {formatDistanceToNow(new Date(c.ultima_data), { addSuffix: true, locale: pt })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.ultima_mensagem || "Sem mensagens"}</p>
                        </div>
                        {c.nao_lidas > 0 && (
                          <span className="h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0 px-1">
                            {c.nao_lidas}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setView("list"); setSelectedPatient(null); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {selectedPatient && (
                  <>
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold", getAvatarColor(selectedPatient.name))}>
                      {getInitials(selectedPatient.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedPatient.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        handleClose();
                        navigate(`/prontuarios?paciente=${selectedPatient.id}&tab=diario`);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Prontuário
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                {selectedPatient && (
                  <UnifiedThread pacienteId={selectedPatient.id} viewerTipo="professional" compact />
                )}
              </div>

              <div className="p-2 border-t flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Mensagem..."
                  rows={1}
                  className="resize-none min-h-[40px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button size="icon" onClick={handleSend} disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
});
