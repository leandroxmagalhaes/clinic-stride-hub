import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  start_time: Date;
  end_time: Date;
  status: string;
  paciente?: { full_name: string };
  profissional?: { full_name: string };
  servico?: { name: string; color: string };
}

interface DraggableSessionProps {
  session: Session;
  onClick: (session: Session) => void;
}

export function DraggableSession({ session, onClick }: DraggableSessionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  });

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
        "p-2 rounded-md text-xs mb-1 cursor-grab hover:opacity-90 transition-all hover:shadow-md group/session select-none",
        isDragging && "opacity-50 shadow-lg z-50 ring-2 ring-primary"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(session);
      }}
    >
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
