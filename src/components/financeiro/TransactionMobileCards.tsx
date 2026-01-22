import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, CreditCard, Banknote, Wallet, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PurchaseTransaction } from "@/services/FinancialService";

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

interface TransactionMobileCardsProps {
  transactions: PurchaseTransaction[];
  formatCurrency: (value: number) => string;
}

export function TransactionMobileCards({ transactions, formatCurrency }: TransactionMobileCardsProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhuma venda registrada no período</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const paymentMethod = PAYMENT_METHOD_LABELS[tx.payment_method || ""] || {
          label: tx.payment_method || "-",
          icon: DollarSign,
        };
        const PaymentIcon = paymentMethod.icon;
        const status = PAYMENT_STATUS_STYLES[tx.payment_status || "pending"];

        return (
          <Card key={tx.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                {/* Left: Patient & Date */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {tx.patient_name || "Paciente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>

                {/* Right: Value */}
                <div className="text-right shrink-0">
                  <p className="font-semibold text-primary">
                    {tx.monetary_value ? formatCurrency(tx.monetary_value) : "-"}
                  </p>
                </div>
              </div>

              {/* Bottom row: Credits, Payment Method, Status */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    +{tx.amount} créditos
                  </Badge>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <PaymentIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">{paymentMethod.label}</span>
                  </div>
                </div>
                <Badge variant={status.variant} className="text-xs">
                  {status.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
