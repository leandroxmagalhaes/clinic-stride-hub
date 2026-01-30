import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { Plus, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/comercial/KanbanColumn";
import { LeadCard } from "@/components/comercial/LeadCard";
import { NewLeadModal } from "@/components/comercial/NewLeadModal";
import { ConvertToPatientModal } from "@/components/comercial/ConvertToPatientModal";
import { CRMDashboard } from "@/components/comercial/CRMDashboard";
import { LeadService, SalesLead, LeadStatus, CreateLeadData } from "@/services/LeadService";
import { KanbanSkeleton } from "@/components/skeletons/PageSkeletons";

const COLUMNS: { id: LeadStatus; title: string; color: string }[] = [
  { id: "novo", title: "Novos Contatos", color: "bg-blue-500" },
  { id: "agendado", title: "Agendou Avaliação", color: "bg-yellow-500" },
  { id: "proposta", title: "Em Negociação", color: "bg-purple-500" },
  { id: "ganho", title: "Fechado/Ganho", color: "bg-green-500" },
  { id: "perdido", title: "Arquivado/Perdido", color: "bg-gray-400" },
];

export default function Comercial() {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<SalesLead | null>(null);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [pendingConvertLead, setPendingConvertLead] = useState<SalesLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const data = await LeadService.fetchAll();
      setLeads(data);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, SalesLead[]> = {
      novo: [],
      agendado: [],
      proposta: [],
      ganho: [],
      perdido: [],
    };
    leads.forEach((lead) => {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      }
    });
    return grouped;
  }, [leads]);

  const activeLead = useMemo(
    () => leads.find((l) => l.id === activeId) || null,
    [leads, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);

    if (!lead || lead.status === newStatus) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    try {
      await LeadService.updateStatus(leadId, newStatus);

      // If moved to "ganho", ask to convert to patient
      if (newStatus === "ganho") {
        setPendingConvertLead({ ...lead, status: newStatus });
        setConvertModalOpen(true);
      } else {
        toast.success(`Lead movido para "${COLUMNS.find((c) => c.id === newStatus)?.title}"`);
      }
    } catch (error) {
      // Revert on error
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l))
      );
      console.error("Error updating lead status:", error);
      toast.error("Erro ao mover lead");
    }
  };

  const handleCreateLead = async (data: CreateLeadData) => {
    try {
      if (editingLead) {
        await LeadService.update(editingLead.id, data);
        toast.success("Lead atualizado com sucesso");
      } else {
        await LeadService.create(data);
        toast.success("Lead criado com sucesso");
      }
      setEditingLead(null);
      await fetchLeads();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Erro ao salvar lead");
      throw error;
    }
  };

  const handleEditLead = (lead: SalesLead) => {
    setEditingLead(lead);
    setNewLeadModalOpen(true);
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;

    try {
      await LeadService.delete(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success("Lead excluído");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Erro ao excluir lead");
    }
  };

  const handleConvertConfirm = () => {
    setConvertModalOpen(false);
    toast.success("Lead convertido! Redirecionando para cadastro...");
  };

  const handleConvertSkip = () => {
    setConvertModalOpen(false);
    toast.success("Lead marcado como ganho");
  };

  // Show skeleton while loading
  if (isLoading && leads.length === 0) {
    return (
      <AppLayout 
        title="Comercial (CRM)" 
        subtitle="Gerencie seus leads e funil de vendas"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button disabled>
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        }
      >
        <KanbanSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Comercial (CRM)" 
      subtitle="Gerencie seus leads e funil de vendas"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchLeads} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => {
            setEditingLead(null);
            setNewLeadModalOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Dashboard Stats */}
        <CRMDashboard leads={leads} />

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                color={column.color}
                leads={leadsByStatus[column.id]}
                onEditLead={handleEditLead}
                onDeleteLead={handleDeleteLead}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead && (
              <LeadCard
                lead={activeLead}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      <NewLeadModal
        open={newLeadModalOpen}
        onOpenChange={(open) => {
          setNewLeadModalOpen(open);
          if (!open) setEditingLead(null);
        }}
        onSubmit={handleCreateLead}
        editingLead={editingLead}
      />

      <ConvertToPatientModal
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        lead={pendingConvertLead}
        onConfirm={handleConvertConfirm}
        onSkip={handleConvertSkip}
      />
      </div>
    </AppLayout>
  );
}
