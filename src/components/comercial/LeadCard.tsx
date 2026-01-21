import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Phone, Euro, GripVertical, Trash2, Edit } from "lucide-react";
import { SalesLead } from "@/services/LeadService";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LeadCardProps {
  lead: SalesLead;
  onEdit: (lead: SalesLead) => void;
  onDelete: (id: string) => void;
}

export function LeadCard({ lead, onEdit, onDelete }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const openWhatsApp = () => {
    if (lead.phone) {
      const cleanPhone = lead.phone.replace(/\D/g, "");
      window.open(`https://wa.me/${cleanPhone}`, "_blank");
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-shadow",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-1 text-muted-foreground hover:text-foreground cursor-grab"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm truncate">{lead.name}</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1">
                  <Edit className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(lead)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(lead.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Value */}
          {(lead.estimated_value ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Euro className="h-3 w-3" />
              <span className="font-medium text-foreground">
                {lead.estimated_value?.toLocaleString("pt-PT", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {/* Phone/WhatsApp */}
          {lead.phone && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 mt-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                openWhatsApp();
              }}
            >
              <Phone className="h-3 w-3 mr-1" />
              WhatsApp
            </Button>
          )}

          {/* Source badge */}
          {lead.source && lead.source !== 'manual' && (
            <span className="inline-block mt-2 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {lead.source}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
