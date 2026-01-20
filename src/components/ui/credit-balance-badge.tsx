import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Coins, AlertCircle, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CreditBalanceBadgeProps {
  balance: number;
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CreditBalanceBadge({ 
  balance, 
  showIcon = true,
  showTooltip = true,
  size = 'md',
  className 
}: CreditBalanceBadgeProps) {
  const isLow = balance > 0 && balance <= 2;
  const isEmpty = balance <= 0;

  const getVariantStyles = () => {
    if (isEmpty) {
      return {
        bg: 'bg-destructive/10',
        text: 'text-destructive',
        icon: AlertCircle,
      };
    }
    if (isLow) {
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        icon: Coins,
      };
    }
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600',
      icon: CheckCircle2,
    };
  };

  const styles = getVariantStyles();
  const Icon = showIcon ? styles.icon : null;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "font-semibold border-0 gap-1",
        styles.bg,
        styles.text,
        sizeClasses[size],
        className
      )}
    >
      {Icon && <Icon className={iconSizes[size]} />}
      {balance} crédito{balance !== 1 ? 's' : ''}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  const tooltipMessage = isEmpty 
    ? 'Sem créditos disponíveis. Adicione créditos para agendar.'
    : isLow
    ? 'Créditos baixos. Considere adicionar mais.'
    : 'Créditos disponíveis para agendamento.';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
