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

  const isCompact = positionStyle?.height != null && parseFloat(String(positionStyle.height)) < 40;

  const internalStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: isFalta ? "#f974161a" : `${session.servico?.color}15`,
    borderLeft: isFalta ? "3px solid #f97316" : `3px solid ${session.servico?.color}`,
    ...positionStyle,
  };

  if (transform) {
    internalStyle.transform = CSS.Translate.toString(transform);
  }

  return (
    <div
      ref={setNodeRef}
      style={internalStyle}
      className={cn(
        "rounded-md text-xs cursor-grab hover:opacity-90 transition-all hover:shadow-md group/session select-none relative overflow-hidden",
        isDragging && "opacity-50 shadow-lg z-50 ring-2 ring-primary",
        isFalta && "ring-2 ring-orange-400 bg-orange-50",
        isPendingPayment && !isFalta && "ring-2 ring-warning/50",
        hasCreditAvailable && !isFalta && "ring-1 ring-success/30",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(session);
      }}
    >
      {/* Credit indicator icon */}
      {hasCredits !== undefined && !isCompact && !isFalta && (
        <div className="absolute -top-1 -right-1 z-10">
          {hasCreditAvailable ? (
            <div className="bg-success text-success-foreground rounded-full p-0.5">
              <CheckCircle2 className="h-3 w-3" />
            </div>
          ) : (
            <div className="bg-warning text-warning-foreground rounded-full p-0.5">
              <AlertTriangle className="h-3 w-3" />
            </div>
          )}
        </div>
      )}

      {/* Falta indicator icon */}
      {isFalta && !isCompact && (
        <div className="absolute -top-1 -right-1 z-10">
          <div className="bg-orange-500 text-white rounded-full p-0.5">
            <AlertTriangle className="h-3 w-3" />
          </div>
        </div>
      )}

      {isCompact ? (
        /* Compact single-line layout for short sessions */
        <div className="flex items-center gap-1 p-1 min-w-0 overflow-hidden">
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
          <p className={cn("font-medium truncate min-w-0", isFalta && "text-orange-700")}>
            {session.paciente?.full_name?.split(" ")?.[0] ?? ""}
          </p>
          <StatusBadge status={session.status as any} className="scale-75 flex-shrink-0" />
        </div>
      ) : (
        /* Normal layout */
        <div className="p-2">
          <div className="flex items-center justify-between gap-1 mb-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
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
              <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
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
                <p className={cn("font-medium truncate min-w-0", isFalta && "text-orange-700")}>
                  {session.paciente?.full_name?.split(" ")?.[0] ?? ""}
                </p>
              </div>
            </div>
            <StatusBadge status={session.status as any} className="scale-90 flex-shrink-0" />
          </div>
          <p className={cn("truncate text-[10px] w-full", isFalta ? "text-orange-500" : "text-muted-foreground")}>
            {session.servico?.name} • {session.profissional?.full_name?.split(" ")?.[0] ?? ""}
          </p>
        </div>
      )}
    </div>
  );
}
