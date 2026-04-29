import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Send,
  Search,
  Users,
  MessageCircle,
  User,
  Plus,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

interface Conversation {
  paciente_id: string;
  paciente_nome: string;
  paciente_email: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  ultima_autor_tipo: string | null;
  nao_lidas: number;
  portal_ativo?: boolean;
}

interface Mensagem {
  id: string;
  paciente_id: string;
  autor_tipo: "professional" | "patient";
  autor_nome: string;
  texto: string;
  lida_em: string | null;
  created_at: string;
}

interface PatientLite {
  id: string;
  full_name: string;
  email: string | null;
  portal_ativo: boolean;
}

export default function Mensagens() {
  const { user } = useAuth();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("clinic_id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setClinicId(data?.clinic_id || null);
      setAuthorName(data?.full_name || user.email || "Profissional");
    })();
  }, [user]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Patient directory (todos os utentes da clínica)
  const [allPatients, setAllPatients] = useState<PatientLite[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  // Broadcast
  const [bcMessage, setBcMessage] = useState("");
  const [bcSelectedIds, setBcSelectedIds] = useState<string[]>([]);
  const [bcSending, setBcSending] = useState(false);
  const [bcIncludeAll, setBcIncludeAll] = useState(false);

  const loadAllPatients = useCallback(async () => {
    if (!clinicId) return;
    const { data: pacs } = await (supabase as any)
      .from("pacientes")
      .select("id, full_name, email")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("full_name");
    const { data: contas } = await (supabase as any)
      .from("portal_contas")
      .select("paciente_id");
    const ativos = new Set<string>((contas || []).map((c: any) => c.paciente_id));
    setAllPatients(
      (pacs || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        portal_ativo: ativos.has(p.id),
      })),
    );
  }, [clinicId]);

  const loadConversations = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("list_portal_conversations", {
      p_clinic_id: clinicId,
    });
    if (error) {
      console.error(error);
      toast.error("Erro a carregar conversas");
      setLoading(false);
      return;
    }
    // marca portal_ativo cruzando com allPatients (ou refaz quick lookup)
    const { data: contas } = await (supabase as any)
      .from("portal_contas")
      .select("paciente_id");
    const ativos = new Set<string>((contas || []).map((c: any) => c.paciente_id));
    setConversations(
      (data || []).map((c: any) => ({ ...c, portal_ativo: ativos.has(c.paciente_id) })),
    );
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    loadConversations();
    loadAllPatients();
  }, [loadConversations, loadAllPatients]);

  // Realtime: refresh on new messages
  useEffect(() => {
    if (!clinicId) return;
    const ch = supabase
      .channel("portal_msgs_pro")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_mensagens" },
        () => {
          loadConversations();
          if (selected) loadMessages(selected.paciente_id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, selected, loadConversations]);

  const loadMessages = async (pacienteId: string) => {
    const { data } = await (supabase as any)
      .from("portal_mensagens")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    await (supabase as any)
      .from("portal_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("paciente_id", pacienteId)
      .eq("autor_tipo", "patient")
      .is("lida_em", null);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
  };

  const handleSelect = (c: Conversation) => {
    setSelected(c);
    loadMessages(c.paciente_id);
  };

  const handleStartChatWith = (p: PatientLite) => {
    // Verifica se já existe na lista de conversas
    const existing = conversations.find((c) => c.paciente_id === p.id);
    const conv: Conversation = existing || {
      paciente_id: p.id,
      paciente_nome: p.full_name,
      paciente_email: p.email,
      ultima_mensagem: null,
      ultima_mensagem_em: null,
      ultima_autor_tipo: null,
      nao_lidas: 0,
      portal_ativo: p.portal_ativo,
    };
    if (!existing) {
      setConversations((prev) => [conv, ...prev]);
    }
    setSelected(conv);
    loadMessages(p.id);
    setShowNewChat(false);
    setNewChatSearch("");
  };

  const sendMessage = async (pacienteId: string, texto: string) => {
    const { error } = await (supabase as any).from("portal_mensagens").insert({
      paciente_id: pacienteId,
      autor_tipo: "professional",
      autor_id: user?.id,
      autor_nome: authorName,
      texto: texto.trim(),
    });
    if (error) throw error;

    supabase.functions
      .invoke("notify-portal-message", {
        body: { paciente_id: pacienteId, autor_nome: authorName },
      })
      .catch((e) => console.warn("notify failed", e));
  };

  const handleSend = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(selected.paciente_id, draft);
      setDraft("");
      await loadMessages(selected.paciente_id);
      await loadConversations();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!selected) return;
    setSendingMagicLink(true);
    try {
      const { error } = await supabase.functions.invoke("generate-portal-magic-link", {
        body: { paciente_id: selected.paciente_id },
      });
      if (error) throw error;
      toast.success("Magic link enviado por email.");
      await loadAllPatients();
      await loadConversations();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar magic link");
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handleBroadcast = async () => {
    if (!bcMessage.trim() || bcSelectedIds.length === 0) {
      toast.error("Escreve a mensagem e seleciona pelo menos um destinatário.");
      return;
    }
    setBcSending(true);
    try {
      let ok = 0;
      for (const pid of bcSelectedIds) {
        try {
          await sendMessage(pid, bcMessage);
          ok++;
        } catch (e) {
          console.error("broadcast send failed for", pid, e);
        }
      }
      toast.success(`Mensagem enviada para ${ok}/${bcSelectedIds.length} utentes.`);
      setBcMessage("");
      setBcSelectedIds([]);
      await loadConversations();
    } finally {
      setBcSending(false);
    }
  };

  const filtered = conversations.filter((c) =>
    c.paciente_nome.toLowerCase().includes(search.toLowerCase()),
  );

  const newChatFiltered = useMemo(() => {
    const q = newChatSearch.toLowerCase().trim();
    const list = q
      ? allPatients.filter(
          (p) =>
            p.full_name.toLowerCase().includes(q) ||
            (p.email || "").toLowerCase().includes(q),
        )
      : allPatients;
    return list.slice(0, 100);
  }, [allPatients, newChatSearch]);

  const broadcastTargets = useMemo(() => {
    if (bcIncludeAll) return allPatients;
    return allPatients.filter((p) => p.portal_ativo);
  }, [bcIncludeAll, allPatients]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-primary" />
          Mensagens
        </h1>
        <p className="text-muted-foreground">Converse com qualquer utente da clínica.</p>
      </header>

      <Tabs defaultValue="conversas">
        <TabsList>
          <TabsTrigger value="conversas">
            <User className="h-4 w-4 mr-1.5" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="broadcast">
            <Users className="h-4 w-4 mr-1.5" />
            Broadcast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="mt-4">
          <div className="grid grid-cols-12 gap-4 h-[70vh]">
            {/* List */}
            <Card className="col-span-4 flex flex-col">
              <div className="p-3 border-b space-y-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setShowNewChat(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Nova conversa
                </Button>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Procurar utente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">
                    Sem conversas. Clica em <strong>Nova conversa</strong> para começar.
                  </p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.paciente_id}
                      onClick={() => handleSelect(c)}
                      className={`w-full text-left p-3 border-b hover:bg-muted/50 transition ${
                        selected?.paciente_id === c.paciente_id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{c.paciente_nome}</p>
                            {c.nao_lidas > 0 && (
                              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                                {c.nao_lidas}
                              </Badge>
                            )}
                            {!c.portal_ativo && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                Sem portal
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.ultima_mensagem || "Sem mensagens"}
                          </p>
                        </div>
                        {c.ultima_mensagem_em && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(c.ultima_mensagem_em), {
                              locale: pt,
                              addSuffix: false,
                            })}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </Card>

            {/* Chat */}
            <Card className="col-span-8 flex flex-col">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Selecione uma conversa ou inicie uma nova
                </div>
              ) : (
                <>
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{selected.paciente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {selected.paciente_email || "Sem email"}
                        </p>
                      </div>
                      {selected.portal_ativo ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Portal ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Sem portal
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!selected.portal_ativo && (
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 text-xs text-amber-900">
                        Este utente ainda não ativou o portal. As mensagens ficarão guardadas
                        e ele poderá lê-las assim que ativar o acesso.
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSendMagicLink}
                        disabled={sendingMagicLink || !selected.paciente_email}
                        title={
                          !selected.paciente_email ? "Utente sem email registado" : ""
                        }
                      >
                        {sendingMagicLink ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Link2 className="h-3 w-3 mr-1" />
                        )}
                        Enviar magic link
                      </Button>
                    </div>
                  )}

                  <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                    <div className="space-y-3">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${
                            m.autor_tipo === "professional" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              m.autor_tipo === "professional"
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
                      {messages.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-8">
                          Inicie a conversa enviando a primeira mensagem.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-3 border-t flex gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Escreva a mensagem..."
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <Card className="p-6 space-y-4">
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={bcMessage}
                onChange={(e) => setBcMessage(e.target.value)}
                rows={4}
                placeholder="Mensagem que será enviada a todos os destinatários selecionados..."
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="bc-include-all"
                checked={bcIncludeAll}
                onCheckedChange={(v) => {
                  setBcIncludeAll(!!v);
                  setBcSelectedIds([]);
                }}
              />
              <Label htmlFor="bc-include-all" className="text-sm cursor-pointer">
                Incluir utentes sem portal ativado
              </Label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>
                  Destinatários ({bcSelectedIds.length} de {broadcastTargets.length}{" "}
                  selecionados)
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBcSelectedIds(broadcastTargets.map((p) => p.id))}
                  >
                    Todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBcSelectedIds([])}>
                    Nenhum
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64 border rounded-md p-2">
                {broadcastTargets.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                  >
                    <Checkbox
                      checked={bcSelectedIds.includes(p.id)}
                      onCheckedChange={(v) => {
                        setBcSelectedIds((prev) =>
                          v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                        );
                      }}
                    />
                    <span className="text-sm">{p.full_name}</span>
                    {!p.portal_ativo && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        Sem portal
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{p.email}</span>
                  </label>
                ))}
                {broadcastTargets.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhum utente disponível.
                  </p>
                )}
              </ScrollArea>
            </div>
            <Button
              onClick={handleBroadcast}
              disabled={bcSending || !bcMessage.trim() || bcSelectedIds.length === 0}
              className="w-full"
            >
              {bcSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> A enviar...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Enviar a {bcSelectedIds.length}{" "}
                  utente(s)
                </>
              )}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Nova conversa */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
            <DialogDescription>
              Escolha qualquer utente da clínica para iniciar uma conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Procurar por nome ou email..."
              value={newChatSearch}
              onChange={(e) => setNewChatSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-80 border rounded-md">
            {newChatFiltered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhum utente encontrado.
              </p>
            ) : (
              newChatFiltered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleStartChatWith(p)}
                  className="w-full text-left p-3 border-b hover:bg-muted/50 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.email || "Sem email"}
                    </p>
                  </div>
                  {p.portal_ativo ? (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Portal ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Sem portal
                    </Badge>
                  )}
                </button>
              ))
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
