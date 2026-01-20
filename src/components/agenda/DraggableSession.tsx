import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CheckCircle2, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

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
  hasCredits?: boolean; // true = crédito disponível, false = sem créditos
}

export function DraggableSession({ session, onClick, hasCredits }: DraggableSessionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  });

  // Determine credit/payment status for visual styling
  const isPendingPayment = session.payment_status === 'pending' || hasCredits === false;
  const hasCreditAvailable = hasCredits === true;

  const style = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: `${session.servico?.color}15`,
    borderLeft: `3px solid ${session.servico?.color}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-md text-xs mb-1 cursor-grab hover:opacity-90 transition-all hover:shadow-md group/session select-none relative",
        isDragging && "opacity-50 shadow-lg z-50 ring-2 ring-primary",
        // Credit status borders
        isPendingPayment && "ring-2 ring-warning/50",
        hasCreditAvailable && "ring-1 ring-success/30"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(session);
      }}
    >
      {/* Credit indicator icon */}
      {hasCredits !== undefined && (
        <div className="absolute -top-1 -right-1">
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
      
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground opacity-60 group-hover/session:opacity-100 transition-opacity" />
          </div>
          <p className="font-medium truncate">
            {session.paciente?.full_name.split(' ')[0]}
          </p>
        </div>
        <StatusBadge status={session.status as any} className="scale-90" />
      </div>
      <p className="text-muted-foreground truncate text-[10px]">
        {session.servico?.name} • {session.profissional?.full_name.split(' ')[0]}
      </p>
    </div>
  );
}
