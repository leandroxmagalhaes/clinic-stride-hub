import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, CheckCheck, ArrowLeft, Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  paciente_id: string;
  tipo: string;
  titulo: string;
  texto_preview: string | null;
  urgente: boolean;
  lida: boolean;
  created_at: string;
}

interface DiaryEntry {
  id: string;
  paciente_id: string;
  autor_nome: string;
  humor: string | null;
  categoria: string | null;
  texto: string;
  nivel_dor: number | null;
  created_at: string;
}

interface Reply {
  id: string;
  diario_id: string;
  autor_nome: string;
  autor_tipo: string;
  texto: string;
  created_at: string;
}

interface ConversationSummary {
  paciente_id: string;
  patient_name: string;
  last_message: string;
  last_date: string;
  unread_count: number;
  has_urgent: boolean;
}

const moodEmojis: Record<string, string> = {
  great: "😄", good: "🙂", okay: "😐", bad: "😟", terrible: "😢",
};

const categoryLabels: Record<string, string> = {
  observation: "Observação", milestone: "Marco", worsening: "Piora",
  fall: "Queda", exercise: "Exercício", pain: "Dor", sleep: "Sono",
  medication: "Medicação", question: "Pergunta",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
    "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export const DiaryFloatingButton = memo(function DiaryFloatingButton() {
  const { isPatient, isProfessional, isAdmin, isSecretary, isLoading: roleLoading } = useUserRole();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [hasUrgent, setHasUrgent] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [profName, setProfName] = useState("Profissional");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Get professional name
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("full_name").eq("user_id", data.user.id).maybeSingle()
          .then(({ data: p }) => { if (p?.full_name) setProfName(p.full_name); });
      }
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const { data: notifs } = await (supabase as any)
        .from("portal_notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!notifs || notifs.length === 0) {
        setConversations([]);
        setTotalUnread(0);
        setHasUrgent(false);
        return;
      }

      const patientIds = [...new Set((notifs as Notification[]).map(n => n.paciente_id))];
      let nameMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: patients } = await supabase.from("pacientes").select("id, full_name").in("id", patientIds);
        (patients || []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
      }

      // Group by patient
      const grouped: Record<string, Notification[]> = {};
      (notifs as Notification[]).forEach(n => {
        if (!grouped[n.paciente_id]) grouped[n.paciente_id] = [];
        grouped[n.paciente_id].push(n);
      });

      const convos: ConversationSummary[] = Object.entries(grouped).map(([pid, items]) => {
        const unread = items.filter(i => !i.lida);
        const last = items[0];
        return {
          paciente_id: pid,
          patient_name: nameMap[pid] || "Paciente",
          last_message: last.texto_preview || last.titulo,
          last_date: last.created_at,
          unread_count: unread.length,
          has_urgent: unread.some(i => i.urgente),
        };
      });

      // Sort: unread first, then by date
      convos.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return new Date(b.last_date).getTime() - new Date(a.last_date).getTime();
      });

      setConversations(convos);
      const total = convos.reduce((s, c) => s + c.unread_count, 0);
      setTotalUnread(total);
      setHasUrgent(convos.some(c => c.has_urgent));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    if (totalUnread > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
  }, [totalUnread]);

  const openChat = useCallback(async (patientId: string, patientName: string) => {
    setSelectedPatient({ id: patientId, name: patientName });
    setView("chat");

    // Mark all notifications as read for this patient
    await (supabase as any)
      .from("portal_notificacoes")
      .update({ lida: true })
      .eq("paciente_id", patientId)
      .eq("lida", false);

    // Fetch diary entries
    const { data: diaryData } = await (supabase as any)
      .from("portal_diario")
      .select("*")
      .eq("paciente_id", patientId)
      .order("created_at", { ascending: true });

    const diaryEntries: DiaryEntry[] = diaryData || [];
    setEntries(diaryEntries);

    // Fetch replies for all entries
    if (diaryEntries.length > 0) {
      const entryIds = diaryEntries.map(e => e.id);
      const { data: repliesData } = await (supabase as any)
        .from("portal_respostas")
        .select("*")
        .in("diario_id", entryIds)
        .order("created_at", { ascending: true });
      setReplies(repliesData || []);
    } else {
      setReplies([]);
    }

    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (view === "chat") {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [view, entries, replies]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedPatient || entries.length === 0) return;
    setSending(true);
    try {
      const lastEntry = entries[entries.length - 1];
      await (supabase as any).from("portal_respostas").insert({
        diario_id: lastEntry.id,
        autor_nome: profName,
        autor_tipo: "professional",
        texto: replyText.trim(),
      });

      // Refresh replies
      const entryIds = entries.map(e => e.id);
      const { data: repliesData } = await (supabase as any)
        .from("portal_respostas")
        .select("*")
        .in("diario_id", entryIds)
        .order("created_at", { ascending: true });
      setReplies(repliesData || []);
      setReplyText("");
    } catch {
      toast.error("Erro ao enviar resposta");
    } finally {
      setSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    await (supabase as any)
      .from("portal_notificacoes")
      .update({ lida: true })
      .eq("lida", false);
    fetchConversations();
  };

  const handleClose = () => {
    setOpen(false);
    setView("list");
    setSelectedPatient(null);
  };

  // Build a timeline: merge entries + replies by date
  const buildTimeline = () => {
    const items: Array<{ type: "entry"; data: DiaryEntry } | { type: "reply"; data: Reply }> = [];
    entries.forEach(e => items.push({ type: "entry", data: e }));
    replies.forEach(r => items.push({ type: "reply", data: r }));
    items.sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());
    return items;
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { if (open) handleClose(); else setOpen(true); }}
        className={cn(
          "fixed bottom-6 right-6 z-[90] flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105",
          "bg-gradient-to-br from-blue-800 to-blue-500",
          bounce && "animate-bounce"
        )}
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
        aria-label="Mensagens do diário"
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
              hasUrgent ? "bg-red-600 ring-2 ring-red-300 animate-pulse" : "bg-destructive"
            )}
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-[84px] right-6 z-[95] w-[380px] max-h-[500px] rounded-xl border bg-background shadow-xl flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
        >
          {view === "list" ? (
            <>
              {/* List Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <h3 className="font-semibold text-sm">💬 Mensagens do Diário</h3>
                  {totalUnread > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {totalUnread} não lida{totalUnread !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {totalUnread > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-7 text-xs gap-1">
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar lidas
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Conversation List */}
              <ScrollArea className="flex-1">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Sem mensagens recentes</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((c) => (
                      <button
                        key={c.paciente_id}
                        onClick={() => openChat(c.paciente_id, c.patient_name)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors hover:bg-accent/50 flex items-center gap-3",
                          c.unread_count > 0 && "bg-yellow-50",
                          c.has_urgent && c.unread_count > 0 && "bg-red-50 border-l-2 border-l-destructive"
                        )}
                      >
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getAvatarColor(c.patient_name))}>
                          {getInitials(c.patient_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{c.patient_name}</p>
                            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 ml-2">
                              {formatDistanceToNow(new Date(c.last_date), { addSuffix: true, locale: pt })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
                        </div>
                        {c.unread_count > 0 && (
                          <span className="h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0 px-1">
                            {c.unread_count}
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
              {/* Chat Header */}
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

              {/* Chat Messages */}
              <ScrollArea className="flex-1 px-3 py-2">
                <div className="space-y-2">
                  {buildTimeline().map((item) => {
                    if (item.type === "entry") {
                      const e = item.data as DiaryEntry;
                      const isUrgent = e.categoria === "worsening" || e.categoria === "fall" || (e.nivel_dor != null && e.nivel_dor >= 6);
                      return (
                        <div key={`e-${e.id}`} className="flex justify-start">
                          <div className={cn(
                            "max-w-[85%] rounded-xl rounded-bl-none px-3 py-2 text-sm",
                            isUrgent ? "bg-red-50 border border-red-200" : "bg-muted"
                          )}>
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              {e.humor && <span className="text-base">{moodEmojis[e.humor] || "😐"}</span>}
                              {e.categoria && e.categoria !== "observation" && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1">
                                  {categoryLabels[e.categoria] || e.categoria}
                                </Badge>
                              )}
                              {e.nivel_dor != null && (
                                <Badge variant={e.nivel_dor >= 6 ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                                  Dor: {e.nivel_dor}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{e.texto}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {e.autor_nome} · {format(new Date(e.created_at), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                      );
                    } else {
                      const r = item.data as Reply;
                      const isProfessional = r.autor_tipo === "professional";
                      return (
                        <div key={`r-${r.id}`} className={cn("flex", isProfessional ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                            isProfessional
                              ? "bg-blue-50 border border-blue-200 rounded-br-none"
                              : "bg-muted rounded-bl-none"
                          )}>
                            <p className="text-sm whitespace-pre-wrap">{r.texto}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {r.autor_nome} · {format(new Date(r.created_at), "dd/MM HH:mm")}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  })}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Input */}
              <div className="border-t p-2 flex gap-2 items-end">
                <Textarea
                  placeholder="Responder ao paciente…"
                  className="min-h-[36px] max-h-[80px] text-sm resize-none"
                  rows={1}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  disabled={!replyText.trim() || sending}
                  onClick={handleSendReply}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
});
