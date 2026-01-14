import { cn } from "@/lib/utils";

type SessionStatus = 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'cancelado' | 'faltou';

interface StatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  agendado: {
    label: "Agendado",
    className: "bg-info/10 text-info border-info/20",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-success/10 text-success border-success/20",
  },
  em_atendimento: {
    label: "Em Atendimento",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  faltou: {
    label: "Faltou",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
