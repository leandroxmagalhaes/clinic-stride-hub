import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  Banknote,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FinancialService, FinancialKPIs, PurchaseTransaction } from "@/services/FinancialService";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  pix: { label: "PIX", icon: Wallet },
  credit_card: { label: "Cartão", icon: CreditCard },
  cash: { label: "Dinheiro", icon: Banknote },
  transfer: { label: "Transferência", icon: ArrowUpRight },
};

const PAYMENT_STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
};

export default function Financeiro() {
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const startDate = startOfMonth(now);
      const endDate = endOfMonth(now);

      const [kpisData, transactionsData] = await Promise.all([
        FinancialService.getKPIs(startDate, endDate),
        FinancialService.getPurchaseTransactions(startDate, endDate),
      ]);

      setKpis(kpisData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error("Error loading financial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const chartData = kpis
    ? [
        {
          name: "Comparativo",
          "Vendas (Caixa)": kpis.salesRevenue,
          "Executado (Competência)": kpis.executedRevenue,
        },
      ]
    : [];

  const currentMonth = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">
            Reconhecimento de receita e métricas financeiras • {currentMonth}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Faturamento de Vendas (Caixa)"
                value={formatCurrency(kpis?.salesRevenue || 0)}
                subtitle={`${kpis?.salesCount || 0} vendas de packs`}
                icon={DollarSign}
              />
              <StatCard
                title="Receita Executada (Competência)"
                value={formatCurrency(kpis?.executedRevenue || 0)}
                subtitle={`${kpis?.sessionsCompleted || 0} sessões realizadas`}
                icon={TrendingUp}
              />
              <StatCard
                title="Ticket Médio"
                value={formatCurrency(kpis?.averageTicket || 0)}
                subtitle="Por venda de pack"
                icon={Receipt}
              />
            </>
          )}
        </div>

        {/* Chart: Cash vs Accrual */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Caixa vs. Competência</CardTitle>
            <CardDescription>
              Comparação entre dinheiro recebido (vendas) e trabalho realizado (sessões)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="Vendas (Caixa)"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Executado (Competência)"
                    fill="hsl(var(--chart-2))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Últimas Vendas de Packs</CardTitle>
            <CardDescription>Histórico de transações financeiras do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma venda registrada no período</p>
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
                  {transactions.map((tx) => {
                    const paymentMethod = PAYMENT_METHOD_LABELS[tx.payment_method || ""] || {
                      label: tx.payment_method || "-",
                      icon: DollarSign,
                    };
                    const PaymentIcon = paymentMethod.icon;
                    const status = PAYMENT_STATUS_STYLES[tx.payment_status || "pending"];

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">
                          {format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{tx.patient_name || "Paciente"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">+{tx.amount} créditos</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {tx.monetary_value ? formatCurrency(tx.monetary_value) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <PaymentIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{paymentMethod.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
