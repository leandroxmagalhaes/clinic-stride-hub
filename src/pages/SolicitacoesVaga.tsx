import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  Mail,
  Phone,
  User,
  Clock,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

type Estado = "nova" | "em_analise" | "contactada" | "agendada" | "sem_vaga";
type TipoCaso = "respiratorio" | "motora" | "neurodesenvolvimento" | "vestibular";

interface Solicitacao {
  id: string;
  clinic_id: string;
  created_at: string;
  nome_paciente: string;
  data_nascimento: string;
  faixa_etaria: string | null;
  nome_responsavel: string | null;
  telefone: string;
  email: string;
  tipo_caso: TipoCaso;
  urgente: boolean;
  motivo_urgencia: string | null;
  observacoes: string | null;
  estado: Estado;
  estado_em: string | null;
  nif: string | null;
  paciente_id: string | null;
  origem: "novo" | "ativo" | "inativo" | null;
  possivel_homonimo: boolean | null;
}

type OrigemFilter = "todas" | "novo" | "ativo" | "inativo";

const ORIGEM_LABEL: Record<"novo" | "ativo" | "inativo", string> = {
  ativo: "Paciente ativo",
  inativo: "Paciente inativo",
  novo: "Novo contacto",
};

const ORIGEM_BADGE: Record<"novo" | "ativo" | "inativo", string> = {
  ativo: "bg-success/15 text-success border border-success/30",
  inativo: "bg-warning/15 text-warning border border-warning/30",
  novo: "bg-info/15 text-info border border-info/30",
};

const ESTADO_LABELS: Record<Estado, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  contactada: "Contactada",
  agendada: "Agendada",
  sem_vaga: "Sem vaga",
};

const ESTADO_BADGE: Record<Estado, string> = {
  nova: "bg-primary text-primary-foreground",
  em_analise: "bg-warning/15 text-warning border border-warning/30",
  contactada: "bg-info/15 text-info border border-info/30",
  agendada: "bg-success/15 text-success border border-success/30",
  sem_vaga: "bg-muted text-muted-foreground border border-border",
};

const TIPO_LABELS: Record<TipoCaso, string> = {
  respiratorio: "Fisioterapia respiratória",
  motora: "Fisioterapia motora",
  neurodesenvolvimento: "Neurodesenvolvimento",
  vestibular: "Reabilitação vestibular",
};

function calcIdade(dataNasc: string): { anos: number; meses: number; texto: string } {
  const nasc = new Date(dataNasc);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  let meses = hoje.getMonth() - nasc.getMonth();
  if (hoje.getDate() < nasc.getDate()) meses--;
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  const texto =
    anos < 1
      ? `${Math.max(0, meses)} meses`
      : anos === 1
      ? "1 ano"
      : `${anos} anos`;
  return { anos, meses, texto };
}

export default function SolicitacoesVaga() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Solicitacao[]>([]);
  const [filterEstado, setFilterEstado] = useState<string>("ativas");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [soUrgentes, setSoUrgentes] = useState(false);
  const [ordem, setOrdem] = useState<"recentes" | "antigas">("recentes");
  const [filterOrigem, setFilterOrigem] = useState<OrigemFilter>("todas");

  const load = async () => {
    try {
      setLoading(true);
      const { clinicId } = await getAuthContext();
      const { data, error } = await (supabase as any)
        .from("solicitacoes_vaga")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data as Solicitacao[]) || []);
    } catch (e: any) {
      toast.error("Erro ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleEstadoChange = async (id: string, novo: Estado) => {
    const prev = items;
    setItems((cur) =>
      cur.map((s) => (s.id === id ? { ...s, estado: novo, estado_em: new Date().toISOString() } : s)),
    );
    const { error } = await (supabase as any)
      .from("solicitacoes_vaga")
      .update({ estado: novo, estado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("Não foi possível atualizar", { description: error.message });
    } else {
      toast.success(`Estado atualizado para ${ESTADO_LABELS[novo]}`);
    }
  };

  const filtered = useMemo(() => {
    let list = [...items];

    if (filterEstado === "ativas") {
      list = list.filter((s) => ["nova", "em_analise", "contactada"].includes(s.estado));
    } else if (filterEstado !== "todas") {
      list = list.filter((s) => s.estado === filterEstado);
    }

    if (filterTipo !== "todos") {
      list = list.filter((s) => s.tipo_caso === filterTipo);
    }

    if (soUrgentes) {
      list = list.filter((s) => s.urgente);
    }

    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return ordem === "recentes" ? db - da : da - db;
    });

    if (ordem !== "antigas") {
      list.sort((a, b) => Number(b.urgente) - Number(a.urgente));
    }

    return list;
  }, [items, filterEstado, filterTipo, soUrgentes, ordem]);

  const counts = useMemo(
    () => ({
      novas: items.filter((s) => s.estado === "nova").length,
      analise: items.filter((s) => s.estado === "em_analise").length,
      urgentes: items.filter(
        (s) => s.urgente && ["nova", "em_analise", "contactada"].includes(s.estado),
      ).length,
    }),
    [items],
  );

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Solicitações de Vaga</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos públicos recebidos através do formulário online
          </p>
        </div>
      </header>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Novas</div>
          <div className="text-2xl font-bold font-display text-primary">{counts.novas}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Em análise</div>
          <div className="text-2xl font-bold font-display text-warning">{counts.analise}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Urgentes ativas</div>
          <div className="text-2xl font-bold font-display text-destructive">{counts.urgentes}</div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativas">Ativas (Nova, Em análise, Contactada)</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="nova">Nova</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="contactada">Contactada</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="sem_vaga">Sem vaga</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de caso</Label>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="respiratorio">Fisioterapia respiratória</SelectItem>
                <SelectItem value="motora">Fisioterapia motora</SelectItem>
                <SelectItem value="neurodesenvolvimento">Neurodesenvolvimento</SelectItem>
                <SelectItem value="vestibular">Reabilitação vestibular</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordenação</Label>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigas">Mais antigas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border">
              <Switch id="urg" checked={soUrgentes} onCheckedChange={setSoUrgentes} />
              <Label htmlFor="urg" className="text-sm cursor-pointer">
                Só urgentes
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Não há pedidos a mostrar com os filtros escolhidos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const idade = calcIdade(s.data_nascimento);
            return (
              <Card
                key={s.id}
                className={
                  s.urgente
                    ? "border-destructive/50 bg-destructive/5"
                    : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{s.nome_paciente}</CardTitle>
                        {s.urgente && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            URGENTE
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <span>{idade.texto}</span>
                        {s.faixa_etaria && (
                          <>
                            <span>•</span>
                            <span>{s.faixa_etaria}</span>
                          </>
                        )}
                        <span>•</span>
                        <Badge variant="outline">{TIPO_LABELS[s.tipo_caso]}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ESTADO_BADGE[s.estado]}`}
                      >
                        {ESTADO_LABELS[s.estado]}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {s.nome_responsavel && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Responsável:</span>
                      <span>{s.nome_responsavel}</span>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a
                      href={`tel:${s.telefone}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4 shrink-0" />
                      {s.telefone}
                    </a>
                    <a
                      href={`mailto:${s.email}`}
                      className="flex items-center gap-2 text-primary hover:underline break-all"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                      {s.email}
                    </a>
                  </div>

                  {s.urgente && s.motivo_urgencia && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                      <div className="flex items-center gap-2 text-destructive font-medium text-xs mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Motivo da urgência
                      </div>
                      <p className="text-sm">{s.motivo_urgencia}</p>
                    </div>
                  )}

                  {s.observacoes && (
                    <div className="flex gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground whitespace-pre-wrap">{s.observacoes}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Recebido{" "}
                      {formatDistanceToNow(new Date(s.created_at), {
                        addSuffix: true,
                        locale: pt,
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Estado:</Label>
                      <Select
                        value={s.estado}
                        onValueChange={(v) => handleEstadoChange(s.id, v as Estado)}
                      >
                        <SelectTrigger className="h-8 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ESTADO_LABELS) as Estado[]).map((e) => (
                            <SelectItem key={e} value={e}>
                              {ESTADO_LABELS[e]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
