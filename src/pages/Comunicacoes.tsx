import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, MessageSquare, AlertTriangle, Users } from "lucide-react";

type PeriodDays = "7" | "30" | "90";

interface CommunicationRow {
  id: string;
  date: string; // ISO
  patientName: string;
  type: string; // raw key
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "unknown";
  errorMessage?: string | null;
  channel: string;
}

/** Rótulos legíveis para os valores técnicos de canal/trigger. */
function labelForType(value?: string | null): string {
  if (!value) return "Desconhecido";
  const map: Record<string, string> = {
    email: "Lembrete de pagamento 3 horas antes",
    email_metodo_followup: "Seguimento do método de pagamento",
    email_dia_anterior: "Confirmação da véspera",
    email_dia_anterior_2: "Última chamada da véspera",
    alerta_nao_confirmada: "Alerta interno de sessão não confirmada",
    portal_chat_email: "Mensagem do portal",
    lembrete_portal_expiracao: "Lembrete de acesso ao portal",
  };
  if (map[value]) return map[value];
  if (value.startsWith("custom_")) {
    return `Lembrete personalizado — ${value.slice("custom_".length)}`;
  }
  return value;
}

const PAGE_SIZE = 25;

export default function Comunicacoes() {
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodDays>("30");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - Number(period));
      const sinceIso = since.toISOString();

      try {
        const [autoRes, remRes] = await Promise.all([
          (supabase as any)
            .from("automation_logs")
            .select(
              "id, sent_at, trigger_type, channel, recipient_email, subject, status, error_message, paciente_id, sessao_id, pacientes(full_name)"
            )
            .gte("sent_at", sinceIso)
            .order("sent_at", { ascending: false }),
          (supabase as any)
            .from("reminder_logs")
            .select(
              "id, enviado_em, canal, sessao_id, sessoes!reminder_logs_sessao_id_fkey(start_time, pacientes!sessoes_paciente_id_fkey(full_name, email))"
            )
            .gte("enviado_em", sinceIso)
            .order("enviado_em", { ascending: false }),
        ]);

        const list: CommunicationRow[] = [];

        for (const r of autoRes?.data ?? []) {
          const failed = (r.status && r.status !== "sent") || !!r.error_message;
          list.push({
            id: `auto-${r.id}`,
            date: r.sent_at,
            patientName: r.pacientes?.full_name ?? "—",
            type: r.trigger_type || r.channel || "",
            recipient: r.recipient_email ?? "—",
            subject: r.subject ?? "—",
            status: failed ? "failed" : r.status === "sent" ? "sent" : "unknown",
            errorMessage: r.error_message,
            channel: r.channel ?? "",
          });
        }

        for (const r of remRes?.data ?? []) {
          const paciente = r.sessoes?.pacientes;
          list.push({
            id: `rem-${r.id}`,
            date: r.enviado_em,
            patientName: paciente?.full_name ?? "—",
            type: r.canal || "",
            recipient: paciente?.email ?? "—",
            subject: "—",
            status: "sent",
            errorMessage: null,
            channel: r.canal ?? "",
          });
        }

        list.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (!cancelled) {
          setRows(list);
          setVisible(PAGE_SIZE);
        }
      } catch (err) {
        console.error("Erro ao carregar comunicações:", err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const typeOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => set.set(r.type, labelForType(r.type)));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "__all__" && r.type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.patientName.toLowerCase().includes(q) ||
        r.recipient.toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const emails = rows.filter(
      (r) => r.channel === "email" || r.recipient.includes("@")
    ).length;
    const failures = rows.filter((r) => r.status === "failed").length;
    const patients = new Set(
      rows.filter((r) => r.patientName !== "—").map((r) => r.patientName)
    ).size;
    return { total, emails, failures, patients };
  }, [rows]);

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (row: CommunicationRow) => {
    if (row.status === "sent")
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/20">
          Enviado
        </Badge>
      );
    if (row.status === "failed")
      return <Badge variant="destructive">Falha</Badge>;
    return <Badge variant="secondary">Desconhecido</Badge>;
  };

  const summaryCards = [
    { label: "Comunicações", value: stats.total, icon: MessageSquare },
    { label: "Por email", value: stats.emails, icon: Mail },
    { label: "Com falha", value: stats.failures, icon: AlertTriangle },
    { label: "Utentes alcançados", value: stats.patients, icon: Users },
  ];

  return (
    <AppLayout
      title="Comunicações"
      subtitle="Tudo o que sai em nome da clínica"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as PeriodDays)}
          >
            <SelectTrigger className="w-full sm:w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Input
            className="h-9 flex-1"
            placeholder="Procurar por utente ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-64 h-9">
              <SelectValue placeholder="Tipo de comunicação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              {typeOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data e hora</TableHead>
                    <TableHead>Utente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Destinatário</TableHead>
                    <TableHead className="hidden lg:table-cell">Assunto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-10"
                      >
                        Sem comunicações no período escolhido
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(0, visible).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(r.date)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {r.patientName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {labelForType(r.type)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground break-all">
                          {r.recipient}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {r.subject}
                        </TableCell>
                        <TableCell>
                          {statusBadge(r)}
                          {r.errorMessage && (
                            <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                              {r.errorMessage}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && filtered.length > visible && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Carregar mais
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Os lembretes registados antes desta página existirem podem não ter
        destinatário nem assunto guardados. A abertura e o clique dos emails
        ainda não são registados.
      </p>
    </AppLayout>
  );
}
