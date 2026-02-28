import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CheckCircle2, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import React from "react";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  payment_status?: string;
  paciente?: {
    full_name: string;
    id?: string;
  };
  profissional?: { full_name: string };
  servico?: { name: string; color: string };
}

interface DraggableSessionProps {
  session: Session;
  onClick: (session: Session) => void;
  hasCredits?: boolean;
  displayTime?: string;
  positionStyle?: React.CSSProperties;
}

export function DraggableSession({ session, onClick, hasCredits, displayTime, positionStyle }: DraggableSessionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  });

  const isPendingPayment = session.payment_status === "pending" || hasCredits === false;
  const hasCreditAvailable = hasCredits === true;
  const isFalta = session.status === "falta" || session.status === "Falta" || session.status === "no-show";

  // Compacto apenas se altura muito reduzida
  const isCompact = positionStyle?.height != null && parseFloat(String(positionStyle.height)) < 48;

  // Só o primeiro nome do profissional
  const profissionalPrimeiroNome = session.profissional?.full_name?.split(" ")?.[0] ?? "";

  const internalStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: isFalta ? "#f974161a" : `${session.servico?.color}15`,
    borderLeft: isFalta ? "3px solid #f97316" : `3px solid ${session.servico?.color}`,
    ...positionStyle,
    minHeight: isCompact ? undefined : "72px",
    height: positionStyle?.height ? `max(${positionStyle.height}, ${isCompact ? "24px" : "72px"})` : undefined,
  };

  if (transform) {
    internalStyle.transform = CSS.Translate.toString(transform);
  }

  return (
    <div
      ref={setNodeRef}
      style={internalStyle}
      className={cn(
        "rounded-md text-xs cursor-grab hover:opacity-90 transition-all hover:shadow-md group/session select-none relative",
        isDragging && "opacity-50 shadow-lg z-50 ring-2 ring-primary",
        isFalta && "ring-2 ring-orange-400",
        isPendingPayment && !isFalta && "ring-2 ring-warning/50",
        hasCreditAvailable && !isFalta && "ring-1 ring-success/30",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(session);
      }}
    >
      {/* Ícone canto superior direito */}
      {!isCompact && (
        <div className="absolute -top-1 -right-1 z-10">
          {isFalta ? (
            <div className="bg-orange-500 text-white rounded-full p-0.5">
              <AlertTriangle className="h-3 w-3" />
            </div>
          ) : hasCreditAvailable ? (
            <div className="bg-success text-success-foreground rounded-full p-0.5">
              <CheckCircle2 className="h-3 w-3" />
            </div>
          ) : hasCredits !== undefined ? (
            <div className="bg-warning text-warning-foreground rounded-full p-0.5">
              <AlertTriangle className="h-3 w-3" />
            </div>
          ) : null}
        </div>
      )}

      {isCompact ? (
        /* ── Ultra-compacto ── */
        <div className="flex items-center gap-1 p-1 min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
            <GripVertical className="h-3 w-3 text-muted-foreground opacity-60" />
          </div>
          {displayTime && (
            <span
              className={cn(
                "text-[10px] font-medium flex-shrink-0",
                isFalta ? "text-orange-600" : "text-muted-foreground",
              )}
            >
              {displayTime}
            </span>
          )}
          <p
            className={cn(
              "font-semibold text-[10px] break-words leading-tight flex-1",
              isFalta ? "text-orange-700" : "text-foreground",
            )}
          >
            {session.paciente?.full_name ?? ""}
          </p>
          <StatusBadge status={session.status as any} className="scale-75 flex-shrink-0" />
        </div>
      ) : (
        /* ── Layout normal completo ── */
        <div className="p-2 flex flex-col gap-0.5">
          {/* Linha 1: Hora + Status */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
              >
                <GripVertical
                  className={cn(
                    "h-3 w-3 opacity-60 group-hover/session:opacity-100 transition-opacity",
                    isFalta ? "text-orange-400" : "text-muted-foreground",
                  )}
                />
              </div>
              {displayTime && (
                <span
                  className={cn("text-[10px] font-semibold", isFalta ? "text-orange-600" : "text-muted-foreground")}
                >
                  {displayTime}
                </span>
              )}
            </div>
            <StatusBadge status={session.status as any} className="scale-90 flex-shrink-0" />
          </div>

          {/* Linha 2: Nome completo do paciente */}
          <p
            className={cn(
              "font-semibold text-[11px] leading-tight break-words",
              isFalta ? "text-orange-700" : "text-foreground",
            )}
          >
            {session.paciente?.full_name ?? ""}
          </p>

          {/* Linha 3: Serviço completo */}
          <p
            className={cn(
              "text-[10px] leading-tight break-words",
              isFalta ? "text-orange-500" : "text-muted-foreground",
            )}
          >
            {session.servico?.name ?? ""}
          </p>

          {/* Linha 4: Só o primeiro nome do profissional */}
          {profissionalPrimeiroNome && (
            <p className={cn("text-[10px] leading-tight", isFalta ? "text-orange-400" : "text-muted-foreground/70")}>
              • {profissionalPrimeiroNome}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
