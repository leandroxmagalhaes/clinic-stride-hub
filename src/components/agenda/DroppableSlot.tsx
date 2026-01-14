import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { isSameDay } from "date-fns";
import { ReactNode } from "react";

interface DroppableSlotProps {
  id: string;
  date: Date;
  hour: number;
  isToday: boolean;
  children: ReactNode;
  onSlotClick: () => void;
  hasSession: boolean;
}

export function DroppableSlot({
  id,
  date,
  hour,
  isToday,
  children,
  onSlotClick,
  hasSession,
}: DroppableSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[70px] p-1 border-r last:border-r-0 transition-colors",
        isToday && "bg-primary/[0.02]",
        isOver && "bg-primary/10 ring-2 ring-primary/50 ring-inset",
        !hasSession && "hover:bg-muted/30 cursor-pointer"
      )}
      onClick={() => !hasSession && onSlotClick()}
    >
      {children}
    </div>
  );
}
