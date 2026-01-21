import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SalesLead, LeadStatus } from "@/services/LeadService";
import { LeadCard } from "./LeadCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: LeadStatus;
  title: string;
  leads: SalesLead[];
  color: string;
  onEditLead: (lead: SalesLead) => void;
  onDeleteLead: (id: string) => void;
}

export function KanbanColumn({
  id,
  title,
  leads,
  color,
  onEditLead,
  onDeleteLead,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/30 rounded-xl min-w-[280px] w-[280px] max-h-[calc(100vh-280px)]",
        isOver && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Header */}
      <div className="p-3 border-b bg-card rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", color)} />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="ml-auto bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            € {totalValue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto"
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEdit={onEditLead}
              onDelete={onDeleteLead}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum lead
          </div>
        )}
      </div>
    </div>
  );
}
