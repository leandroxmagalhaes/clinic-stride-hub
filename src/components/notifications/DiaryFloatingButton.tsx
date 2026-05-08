import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, ArrowLeft, Send, ExternalLink, Loader2, Search, UserPlus, CheckCircle2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useClinicInfo } from "@/hooks/useClinicInfo";
import { useFloatingPanels } from "@/contexts/FloatingPanelsContext";
import {
  UnifiedThread,
  useUnifiedThread,
  enviarMensagemUnificada,
} from "@/components/messages/UnifiedThread";

interface PatientItem {
  paciente_id: string;
  paciente_nome: string;
  ultima_mensagem: string | null;
  ultima_data: string | null;
  nao_lidas: number;
  portal_activo: boolean;
  acessado_em: string | null;
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
  const { data: clinic } = useClinicInfo();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [bounce, setBounce] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [profName, setProfName] = useState("Profissional");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActivate, setShowActivate] = useState(false);
  const [welcomeText, setWelcomeText] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [activating, setActivating] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<number | undefined>(undefined);

  const { refresh: refreshThread } = useUnifiedThread(selectedPatient?.paciente_id || null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setProfName(data.full_name); });
  }, [user]);

  const fetchPatients = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("listar_pacientes_para_atalho", {
        p_query: query.trim().length >= 2 ? query.trim() : null,
        p_limit: 20,
      });
      if (error) throw error;
      const list = (data || []) as PatientItem[];
      setPatients(list);
      // total unread only counts default-mode list
      if (query.trim().length < 2) {
        setTotalUnread(list.reduce((s, c) => s + (c.nao_lidas || 0), 0));
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + on search change (debounced)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchPatients(searchQuery), 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [searchQuery, fetchPatients]);

  // Periodic refresh of default list
  useEffect(() => {
    const t = setInterval(() => { if (searchQuery.trim().length < 2) fetchPatients(""); }, 30000);
    return () => clearInterval(t);
  }, [fetchPatients, searchQuery]);

  // Realtime: refresh when any portal_mensagens row changes
  useEffect(() => {
    const ch = supabase
      .channel("portal_msgs_floating")
      .on("postgres_changes", { event: "*", schema: "public", table: "portal_mensagens" }, () => {
        if (searchQuery.trim().length < 2) fetchPatients("");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPatients, searchQuery]);

  useEffect(() => {
    if (totalUnread > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
  }, [totalUnread]);

  const openChat = useCallback(async (p: PatientItem) => {
    setSelectedPatient(p);
    setView("chat");
    await (supabase as any)
      .from("portal_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("paciente_id", p.paciente_id)
      .eq("autor_tipo", "patient")
      .is("lida_em", null);
    fetchPatients(searchQuery.trim().length >= 2 ? searchQuery : "");
  }, [fetchPatients, searchQuery]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedPatient) return;
    // Patient with no portal → open activation modal
    if (!selectedPatient.portal_activo) {
      const firstName = selectedPatient.paciente_nome.split(" ")[0] || selectedPatient.paciente_nome;
      const clinicName = clinic?.name || "a sua clínica";
      setWelcomeText(
        `Olá ${firstName}!\n\nBem-vindo ao seu Diário de Acompanhamento na ${clinicName}. Aqui pode comunicar connosco entre sessões, registar como se sente e partilhar o seu progresso.\n\nEstamos consigo a cada passo.`
      );
      setPendingMessage(draft.trim());
      setShowActivate(true);
      return;
    }
    setSending(true);
    try {
      await enviarMensagemUnificada({
        paciente_id: selectedPatient.paciente_id,
        texto: draft.trim(),
        autor_tipo: "professional",
        autor_nome: profName,
        tipo: "mensagem",
      });
      setDraft("");
      await refreshThread();
      await fetchPatients(searchQuery.trim().length >= 2 ? searchQuery : "");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleActivateAndSend = async () => {
    if (!selectedPatient || !pendingMessage.trim() || !welcomeText.trim()) return;
    setActivating(true);
    try {
      // Lookup patient email
      const { data: pacRow } = await supabase
        .from("pacientes")
        .select("email")
        .eq("id", selectedPatient.paciente_id)
        .maybeSingle();
      const email = pacRow?.email || null;

      if (email) {
        const { error } = await supabase.functions.invoke("send-portal-welcome-with-message", {
          body: {
            paciente_id: selectedPatient.paciente_id,
            email,
            welcome_text: welcomeText.trim(),
            message_text: pendingMessage.trim(),
            professional_name: profName,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("generate-portal-invite", {
          body: { paciente_id: selectedPatient.paciente_id },
        });
        if (error) throw error;
      }

      // Register the message in the conversation
      await enviarMensagemUnificada({
        paciente_id: selectedPatient.paciente_id,
        texto: pendingMessage.trim(),
        autor_tipo: "professional",
        autor_nome: profName,
        tipo: "mensagem",
      });

      toast.success(
        email
          ? `Portal activado e email enviado para ${selectedPatient.paciente_nome}`
          : `Mensagem registada. Convite por código gerado para ${selectedPatient.paciente_nome}.`,
      );
      setShowActivate(false);
      setDraft("");
      setPendingMessage("");
      // Mark portal as active locally so subsequent sends bypass the modal
      setSelectedPatient((prev) => prev ? { ...prev, portal_activo: !!email || prev.portal_activo } : prev);
      await refreshThread();
      await fetchPatients(searchQuery.trim().length >= 2 ? searchQuery : "");
    } catch (e: any) {
      toast.error(e.message || "Erro ao activar portal");
    } finally {
      setActivating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setView("list");
    setSelectedPatient(null);
    setSearchQuery("");
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
        aria-label="Diário de Acompanhamento"
        title="Diário de Acompanhamento"
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
                  <h3 className="font-semibold text-sm">📔 Diário de Acompanhamento</h3>
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

              <div className="border-b p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Procurar utente..."
                    className="pl-8 h-9"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                {loading && patients.length === 0 ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : patients.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery.trim().length >= 2 ? "Nenhum utente encontrado" : "Sem registos recentes"}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {patients.map((c) => (
                      <button
                        key={c.paciente_id}
                        onClick={() => openChat(c)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors hover:bg-accent/50 flex items-center gap-3",
                          c.nao_lidas > 0 && "bg-amber-50"
                        )}
                      >
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getAvatarColor(c.paciente_nome))}>
                          {getInitials(c.paciente_nome)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{c.paciente_nome}</p>
                            {c.ultima_data && (
                              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                                {formatDistanceToNow(new Date(c.ultima_data), { addSuffix: true, locale: pt })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {c.portal_activo ? (
                              <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                Portal activo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="h-4 px-1 text-[9px]">Sem portal</Badge>
                            )}
                            <p className="text-xs text-muted-foreground truncate">
                              {c.ultima_mensagem || "—"}
                            </p>
                          </div>
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
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold", getAvatarColor(selectedPatient.paciente_nome))}>
                      {getInitials(selectedPatient.paciente_nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedPatient.paciente_nome}</p>
                      {!selectedPatient.portal_activo && (
                        <p className="text-[10px] text-muted-foreground">Sem portal activo</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        handleClose();
                        navigate(`/prontuarios?paciente=${selectedPatient.paciente_id}&tab=acompanhamento`);
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
                  <UnifiedThread pacienteId={selectedPatient.paciente_id} viewerTipo="professional" compact />
                )}
              </div>

              <div className="p-2 border-t flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={selectedPatient?.portal_activo ? "Mensagem..." : "Escreva — pediremos para activar o portal"}
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

      <Dialog open={showActivate} onOpenChange={(v) => !activating && setShowActivate(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Activar Portal de Acompanhamento?
            </DialogTitle>
            <DialogDescription>
              {selectedPatient?.paciente_nome} ainda não tem Portal de Acompanhamento activado.
              Vamos activar e enviar um email único com o link de acesso e a sua mensagem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Mensagem de boas-vindas (editável)</p>
              <Textarea
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                rows={6}
                className="text-sm"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">A sua primeira mensagem</p>
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {pendingMessage}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowActivate(false)} disabled={activating}>
              Cancelar
            </Button>
            <Button onClick={handleActivateAndSend} disabled={activating || !welcomeText.trim()}>
              {activating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Activar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
