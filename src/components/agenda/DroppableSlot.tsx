import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 70;

interface DroppableSlotProps {
  id: string;
  date: Date;
  hour: number;
  isToday: boolean;
  onSlotClick: () => void;
}

export function DroppableSlot({
  id,
  date,
  hour,
  isToday,
  onSlotClick,
}: DroppableSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b last:border-b-0 transition-colors cursor-pointer",
        isToday && "bg-primary/[0.02]",
        isOver && "bg-primary/10 ring-2 ring-primary/50 ring-inset",
        "hover:bg-muted/30"
      )}
      style={{ height: `${HOUR_HEIGHT}px` }}
      onClick={onSlotClick}
    />
  );
}

export { HOUR_HEIGHT };
