import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Settings,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TransactionType = "purchase" | "usage" | "adjustment" | "refund";

export interface Transaction {
  id: string;
  amount: number;
  transaction_type: TransactionType;
  description: string | null;
  created_at: string;
  related_session_id?: string | null;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const TRANSACTION_CONFIG: Record<
  TransactionType,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  purchase: {
    label: "Compra",
    icon: ArrowUpCircle,
    colorClass: "text-emerald-600 bg-emerald-500/10",
  },
  usage: {
    label: "Uso",
    icon: ArrowDownCircle,
    colorClass: "text-amber-600 bg-amber-500/10",
  },
  refund: {
    label: "Reembolso",
    icon: RefreshCw,
    colorClass: "text-blue-600 bg-blue-500/10",
  },
  adjustment: {
    label: "Ajuste",
    icon: Settings,
    colorClass: "text-muted-foreground bg-muted",
  },
};

export function TransactionHistory({
  transactions,
  isLoading,
}: TransactionHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma transação registrada</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Compre um pack para começar a usar créditos
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-4">
      <div className="space-y-3">
        {transactions.map((tx) => {
          const config = TRANSACTION_CONFIG[tx.transaction_type];
          const Icon = config.icon;
          const isPositive = tx.amount > 0;

          return (
            <div
              key={tx.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div
                className={cn(
                  "p-2 rounded-full",
                  config.colorClass
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] font-medium border-0", config.colorClass)}
                  >
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <p className="text-sm truncate">
                  {tx.description || "Transação de crédito"}
                </p>
              </div>

              <div
                className={cn(
                  "font-bold text-sm whitespace-nowrap",
                  isPositive ? "text-success" : "text-warning"
                )}
              >
                {isPositive ? "+" : ""}
                {tx.amount}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
