import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, subMonths,
  startOfYear, endOfYear, startOfQuarter, endOfQuarter,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign, TrendingUp, Receipt, CreditCard, Banknote, Wallet,
  ArrowUpRight, ArrowDownLeft, Plus, Trash2, RefreshCw, TrendingDown,
  Scale, Hourglass, CircleDollarSign, CheckCircle2, AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { FinancialService, FinancialKPIs, PurchaseTransaction } from "@/services/FinancialService";
import {
  FinancialTransactionService, LocalTransaction, CreateLocalTransactionData,
  CATEGORY_LABELS, ENTRY_CATEGORIES, EXIT_CATEGORIES, TransactionKind,
} from "@/services/FinancialTransactionService";
import { TransactionMobileCards } from "@/components/financeiro/TransactionMobileCards";
import { AIFinancialInsightsCard } from "@/components/financeiro/AIFinancialInsightsCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Line, ComposedChart,
} from "recharts";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type PeriodType = "mes" | "trimestre" | "ano";

interface Period {
  type: PeriodType;
  start: Date;
  end: Date;
  label: string;
}

function buildPeriod(type: PeriodType, ref: Date = new Date()): Period {
  switch (type) {
    case "mes":
      return { type, start: startOfMonth(ref), end: endOfMonth(ref), label: format(ref, "MMMM 'de' yyyy", { locale: ptBR }) };
    case "trimestre":
      return { type, start: startOfQuarter(ref), end: endOfQuarter(ref), label: `T${Math.ceil((ref.getMonth() + 1) / 3)} ${ref.getFullYear()}` };
    case "ano":
      return { type, start: startOfYear(ref), end: endOfYear(ref), label: String(ref.getFullYear()) };
  }
}

// Sessão realizada vinda do Supabase (para receitas e pendências)
interface SessionRevenue {
  id: string;
  start_time: string;
  patient_name: string;
  service_name: string;
  price: number;
  payment_status: "pago" | "pendente";
  payment_method?: string;
  avulso?: boolean;
}
// ──────────────────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  pix: { label: "PIX", icon: Wallet },
  mbway: { label: "MB Way", icon: Wallet },
  multibanco: { label: "Multibanco", icon: CreditCard },
  transferencia: { label: "Transferência", icon: ArrowUpRight },
  numerario: { label: "Numerário", icon: Banknote },
  cartao: { label: "Cartão", icon: CreditCard },
  credit_card: { label: "Cartão", icon: CreditCard },
  cash: { label: "Dinheiro", icon: Banknote },
  transfer: { label: "Transferência", icon: ArrowUpRight },
};

const PAYMENT_METHODS_OPTIONS = [
  { value: "mbway", label: "MB Way" },
  { value: "multibanco", label: "Multibanco" },
  { value: "transferencia", label: "Transferência" },
  { value: "numerario", label: "Numerário" },
  { value: "cartao", label: "Cartão" },
];

const EMPTY_FORM: CreateLocalTransactionData = {
  kind: "saida", category: "renda", description: "",
  amount: 0, date: format(new Date(), "yyyy-MM-dd"),
  payment_method: "numerario", recorrente: false, recorrente_dia: new Date().getDate(),
};

export default function Financeiro() {
  const isMobile = useIsMobile();

  const [periodType, setPeriodType] = useState<PeriodType>("mes");
  const [periodRef, setPeriodRef] = useState(new Date());
  const period = useMemo(() => buildPeriod(periodType, periodRef), [periodType, periodRef]);

  const goToPrev = () => {
    if (periodType === "mes") setPeriodRef(subMonths(periodRef, 1));
    else if (periodType === "trimestre") setPeriodRef(new Date(periodRef.getFullYear(), periodRef.getMonth() - 3, 1));
    else setPeriodRef(new Date(periodRef.getFullYear() - 1, 0, 1));
  };
  const goToNext = () => {
    if (periodType === "mes") setPeriodRef(new Date(periodRef.getFullYear(), periodRef.getMonth() + 1, 1));
    else if (periodType === "trimestre") setPeriodRef(new Date(periodRef.getFullYear(), periodRef.getMonth() + 3, 1));
    else setPeriodRef(new Date(periodRef.getFullYear() + 1, 0, 1));
  };

  // Dados Supabase
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [packTransactions, setPackTransactions] = useState<PurchaseTransaction[]>([]);
  const [isLoadingSupabase, setIsLoadingSupabase] = useState(true);

  // ── Sessões realizadas (receitas de sessões) ──────────────────────────────
  const [sessionRevenues, setSessionRevenues] = useState<SessionRevenue[]>([]);

  const loadSessionRevenues = async () => {
    try {
      const { data, error } = await supabase
        .from("sessoes")
        .select(`id, start_time, price, payment_status, payment_method, paciente:paciente_id(full_name), servico:servico_id(name)`)
        .eq("status", "realizado")
        .gte("start_time", period.start.toISOString())
        .lte("start_time", period.end.toISOString())
        .order("start_time", { ascending: false });

      if (error) throw error;

      const rows = (data || []).filter(
        (s: any) => (s.price && s.price > 0) || s.payment_status === "pago" || s.payment_status === "pendente"
      );

      setSessionRevenues(
        rows.map((s: any) => ({
          id: s.id,
          start_time: s.start_time,
          patient_name: s.paciente?.full_name || "Paciente",
          service_name: s.servico?.name || "Serviço",
          price: s.price || 0,
          payment_status: s.payment_status === "pago" ? "pago" : "pendente",
          payment_method: s.payment_method,
          avulso: false,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar receitas de sessões:", err);
    }
  };

  // Marca sessão pendente como paga
  const markSessionAsPaid = async (sessionId: string, method: string) => {
    try {
      const { error } = await supabase
        .from("sessoes")
        .update({ payment_status: "pago", payment_method: method })
        .eq("id", sessionId);
      if (error) throw error;
      toast.success("Pagamento registado!");
      await loadSessionRevenues();
    } catch {
      toast.error("Erro ao actualizar pagamento");
    }
  };

  // Dados locais
  const [localTransactions, setLocalTransactions] = useState<LocalTransaction[]>([]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CreateLocalTransactionData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Modal "Receber pagamento"
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveSession, setReceiveSession] = useState<SessionRevenue | null>(null);
  const [receiveMethod, setReceiveMethod] = useState("numerario");

  useEffect(() => { loadAll(); }, [period.start.getTime(), period.end.getTime()]);

  const loadAll = async () => {
    setIsLoadingSupabase(true);
    try {
      const [kpisData, transactionsData] = await Promise.all([
        FinancialService.getKPIs(period.start, period.end),
        FinancialService.getPurchaseTransactions(period.start, period.end),
      ]);
      setKpis(kpisData);
      setPackTransactions(transactionsData);
      await loadSessionRevenues();
    } catch {
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setIsLoadingSupabase(false);
    }
  };

  useEffect(() => {
    const txs = FinancialTransactionService.getForPeriod(period.start, period.end);
    setLocalTransactions(txs);
  }, [period.start.getTime(), period.end.getTime(), isModalOpen, deleteId]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);

  // ── Cálculos financeiros combinados ───────────────────────────────────────
  const packRevenue = kpis?.salesRevenue || 0;

  const sessionPaidRevenue = useMemo(
    () => sessionRevenues.filter((s) => s.payment_status === "pago").reduce((sum, s) => sum + s.price, 0),
    [sessionRevenues]
  );
  const pendingRevenue = useMemo(
    () => sessionRevenues.filter((s) => s.payment_status === "pendente").reduce((sum, s) => sum + s.price, 0),
    [sessionRevenues]
  );
  const pendingSessions = useMemo(
    () => sessionRevenues.filter((s) => s.payment_status === "pendente"),
    [sessionRevenues]
  );

  const stats = useMemo(() => {
    const base = FinancialTransactionService.getStats(period.start, period.end, packRevenue);
    return {
      ...base,
      totalEntradas: base.totalEntradas + sessionPaidRevenue,
      saldo: base.totalEntradas + sessionPaidRevenue - base.saidas,
    };
  }, [localTransactions, packRevenue, sessionPaidRevenue, period.start.getTime(), period.end.getTime()]);

  // Gráfico 12 meses
  const [chartData12m, setChartData12m] = useState<any[]>([]);
  useEffect(() => {
    const packByMonth: Record<string, number> = {};
    const key = format(new Date(), "yyyy-MM");
    packByMonth[key] = packRevenue;
    const data = FinancialTransactionService.getMonthlyChartData(12, packByMonth);
    setChartData12m(data);
  }, [localTransactions, packRevenue]);

  // Modal entrada/saída
  const openModal = (kind: TransactionKind) => {
    setForm({ ...EMPTY_FORM, kind, category: kind === "entrada" ? "consulta_avulsa" : "renda" });
    setIsModalOpen(true);
  };

  const handleSaveTransaction = () => {
    if (!form.description.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (!form.amount || form.amount <= 0) { toast.error("Valor deve ser positivo"); return; }
    FinancialTransactionService.create(form);
    toast.success(`${form.kind === "entrada" ? "Entrada" : "Saída"} registada!`);
    setIsModalOpen(false);
    setLocalTransactions(FinancialTransactionService.getForPeriod(period.start, period.end));
  };

  const handleDelete = (id: string) => {
    const parts = id.split("_");
    const baseId = parts.slice(0, 3).join("_");
    FinancialTransactionService.delete(baseId);
    toast.success("Transacção eliminada");
    setDeleteId(null);
    setLocalTransactions(FinancialTransactionService.getForPeriod(period.start, period.end));
  };

  // Todas as transacções (locais + packs + sessões pagas)
  const allTransactions = useMemo(() => {
    const local = localTransactions.map((t) => ({
      id: t.id, date: t.date, description: t.description,
      category: CATEGORY_LABELS[t.category] || t.category,
      kind: t.kind as TransactionKind, amount: t.amount,
      payment_method: t.payment_method || "", recorrente: t.recorrente,
      source: "local" as const,
    }));
    const packs = packTransactions.map((t) => ({
      id: t.id, date: format(new Date(t.created_at), "yyyy-MM-dd"),
      description: `Pack — ${t.patient_name || "Paciente"}`,
      category: "Pack de créditos", kind: "entrada" as TransactionKind,
      amount: t.monetary_value || 0, payment_method: t.payment_method || "",
      recorrente: false, source: "pack" as const,
    }));
    const sessions = sessionRevenues
      .filter((s) => s.payment_status === "pago")
      .map((s) => ({
        id: s.id, date: format(new Date(s.start_time), "yyyy-MM-dd"),
        description: `Sessão — ${s.patient_name} · ${s.service_name}`,
        category: s.avulso ? "Sessão avulsa" : "Sessão realizada",
        kind: "entrada" as TransactionKind, amount: s.price,
        payment_method: s.payment_method || "", recorrente: false,
        source: "session" as const,
      }));
    return [...local, ...packs, ...sessions].sort((a, b) => b.date.localeCompare(a.date));
  }, [localTransactions, packTransactions, sessionRevenues]);

  const isLoading = isLoadingSupabase;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Financeiro</h1>
            <p className="text-muted-foreground text-sm">Receitas, despesas e saldo • {period.label}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrev}>‹</Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNext}>›</Button>
            <Button variant="outline" size="sm" className="h-9 gap-1" onClick={loadAll}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-9 gap-1 bg-green-600 hover:bg-green-700" onClick={() => openModal("entrada")}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              Entrada
            </Button>
            <Button size="sm" variant="destructive" className="h-9 gap-1" onClick={() => openModal("saida")}>
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Despesa
            </Button>
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <StatCard title="Total Entradas" value={formatCurrency(stats.totalEntradas)} subtitle="Packs + sessões + avulsas" icon={TrendingUp} />
              <StatCard title="Total Saídas" value={formatCurrency(stats.saidas)} subtitle="Despesas do período" icon={TrendingDown} />
              <StatCard
                title="Saldo Líquido"
                value={formatCurrency(stats.saldo)}
                subtitle={stats.saldo >= 0 ? "Positivo ✓" : "Negativo ⚠"}
                icon={Scale}
              />
              <StatCard
                title="Contas a Receber"
                value={formatCurrency(pendingRevenue)}
                subtitle={`${pendingSessions.length} sessão(ões) pendente(s)`}
                icon={Hourglass}
                className={pendingRevenue > 0 ? "border-orange-300 bg-orange-50/50" : ""}
              />
            </>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="transacoes">Transacções</TabsTrigger>
            <TabsTrigger value="pendencias" className="gap-1.5">
              Contas a Receber
              {pendingSessions.length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                  {pendingSessions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="packs">Vendas de Packs</TabsTrigger>
          </TabsList>

          {/* ── VISÃO GERAL ────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Evolução Mensal (12 meses)</CardTitle>
                <CardDescription>Entradas, saídas e saldo líquido mês a mês</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData12m} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}€`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(142,76%,36%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                    <Line dataKey="saldo" name="Saldo" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Caixa vs. Competência</CardTitle>
                <CardDescription>Dinheiro recebido em packs vs. sessões realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48 w-full" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[{ name: period.label, "Vendas (Caixa)": kpis?.salesRevenue || 0, "Executado (Competência)": kpis?.executedRevenue || 0 }]}
                      margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                      <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}€`} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Legend />
                      <Bar dataKey="Vendas (Caixa)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Executado (Competência)" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <AIFinancialInsightsCard kpis={kpis} />
          </TabsContent>

          {/* ── TRANSACÇÕES ───────────────────────────────────────────── */}
          <TabsContent value="transacoes">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">Todas as Transacções</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-600 hover:bg-green-50" onClick={() => openModal("entrada")}>
                      <Plus className="h-3.5 w-3.5" />
                      Entrada
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive hover:bg-destructive/10" onClick={() => openModal("saida")}>
                      <Plus className="h-3.5 w-3.5" />
                      Despesa
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {allTransactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma transacção no período</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(tx.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm">
                              {tx.description}
                              {tx.recorrente && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  <RefreshCw className="h-2.5 w-2.5 mr-1" />
                                  recorrente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{tx.category}</TableCell>
                            <TableCell>
                              <Badge variant={tx.kind === "entrada" ? "default" : "destructive"} className={tx.kind === "entrada" ? "bg-green-600" : ""}>
                                {tx.kind === "entrada" ? "Entrada" : "Saída"}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${tx.kind === "entrada" ? "text-green-600" : "text-destructive"}`}>
                              {tx.kind === "entrada" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell>
                              {(tx as any).source === "local" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(tx.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PENDÊNCIAS / CONTAS A RECEBER ──────────────────────────── */}
          <TabsContent value="pendencias">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <Hourglass className="h-5 w-5 text-orange-500" />
                      Contas a Receber
                    </CardTitle>
                    <CardDescription>
                      Sessões realizadas com pagamento pendente · Total: {formatCurrency(pendingRevenue)}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={loadAll}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : pendingSessions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-60" />
                    <p className="font-medium">Sem pendências!</p>
                    <p className="text-xs mt-1">Todos os pagamentos do período estão regularizados.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Resumo */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                      <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">
                          {pendingSessions.length} sessão(ões) por cobrar · {formatCurrency(pendingRevenue)}
                        </p>
                        <p className="text-xs text-orange-600 mt-0.5">
                          Clique em "Receber" para registar o pagamento e mover para receitas.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data da Sessão</TableHead>
                            <TableHead>Paciente</TableHead>
                            <TableHead>Serviço</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingSessions.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-sm whitespace-nowrap">
                                {format(new Date(s.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm font-medium">{s.patient_name}</TableCell>
                              <TableCell className="text-sm">
                                {s.service_name}
                                {s.avulso && <Badge variant="outline" className="ml-2 text-[10px]">Avulso</Badge>}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-orange-600">
                                {formatCurrency(s.price)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  className="gap-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => { setReceiveSession(s); setReceiveMethod("numerario"); setShowReceiveModal(true); }}
                                >
                                  <CircleDollarSign className="h-3.5 w-3.5" />
                                  Receber
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PACKS ─────────────────────────────────────────────────── */}
          <TabsContent value="packs">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Vendas de Packs</CardTitle>
                <CardDescription>Histórico de compras de créditos do período</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : isMobile ? (
                  <TransactionMobileCards transactions={packTransactions} formatCurrency={formatCurrency} />
                ) : packTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma venda de pack no período</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packTransactions.map((tx) => {
                        const pm = PAYMENT_METHOD_LABELS[tx.payment_method || ""] || { label: tx.payment_method || "-", icon: DollarSign };
                        const PMIcon = pm.icon;
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="font-medium">
                              {format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{tx.patient_name || "Paciente"}</TableCell>
                            <TableCell><Badge variant="outline">+{tx.amount} créditos</Badge></TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {tx.monetary_value ? formatCurrency(tx.monetary_value) : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <PMIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{pm.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.payment_status === "paid" ? "default" : "secondary"}>
                                {tx.payment_status === "paid" ? "Pago" : "Pendente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal nova transacção ──────────────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.kind === "entrada"
                ? <><ArrowUpRight className="h-5 w-5 text-green-600" />Nova Entrada</>
                : <><ArrowDownLeft className="h-5 w-5 text-destructive" />Nova Despesa</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button size="sm" variant={form.kind === "entrada" ? "default" : "outline"} className={form.kind === "entrada" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => setForm({ ...form, kind: "entrada", category: "consulta_avulsa" })}>Entrada</Button>
              <Button size="sm" variant={form.kind === "saida" ? "destructive" : "outline"} onClick={() => setForm({ ...form, kind: "saida", category: "renda" })}>Despesa</Button>
            </div>

            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(form.kind === "entrada" ? ENTRY_CATEGORIES : EXIT_CATEGORIES).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Input placeholder={form.kind === "entrada" ? "Ex: Consulta Dr. Silva" : "Ex: Renda do mês"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (€) *</Label>
                <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Despesa recorrente</p>
                <p className="text-xs text-muted-foreground">Repete todos os meses</p>
              </div>
              <Switch checked={form.recorrente} onCheckedChange={(v) => setForm({ ...form, recorrente: v })} />
            </div>

            {form.recorrente && (
              <div className="space-y-1">
                <Label>Dia do mês</Label>
                <Input type="number" min="1" max="28" value={form.recorrente_dia || 1} onChange={(e) => setForm({ ...form, recorrente_dia: parseInt(e.target.value) || 1 })} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTransaction} className={form.kind === "entrada" ? "bg-green-600 hover:bg-green-700" : ""}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal receber pagamento pendente ───────────────────────────────── */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-green-600" />
              Registar Recebimento
            </DialogTitle>
          </DialogHeader>
          {receiveSession && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="font-medium text-sm">{receiveSession.patient_name}</p>
                <p className="text-xs text-muted-foreground">{receiveSession.service_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(receiveSession.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(receiveSession.price)}</p>
              </div>
              <div className="space-y-1">
                <Label>Método de pagamento</Label>
                <Select value={receiveMethod} onValueChange={setReceiveMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceiveModal(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (receiveSession) {
                  await markSessionAsPaid(receiveSession.id, receiveMethod);
                  setShowReceiveModal(false);
                  setReceiveSession(null);
                }
              }}
            >
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar eliminação ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar transacção?</AlertDialogTitle>
            <AlertDialogDescription>Esta acção não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
