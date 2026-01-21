import { useState } from "react";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AutomationFlow } from "@/services/AutomationService";
import { FlowCard } from "./FlowCard";
import { NewFlowModal } from "./NewFlowModal";

interface AutomationFlowsListProps {
  flows: AutomationFlow[];
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onSave: (data: Omit<AutomationFlow, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>, existingId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function AutomationFlowsList({ flows, onToggle, onSave, onDelete }: AutomationFlowsListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);

  const handleEdit = (flow: AutomationFlow) => {
    setEditingFlow(flow);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditingFlow(null);
    }
  };

  const handleSave = async (data: Omit<AutomationFlow, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>) => {
    await onSave(data, editingFlow?.id);
  };

  const handleDeleteConfirm = async () => {
    if (deletingFlowId) {
      await onDelete(deletingFlowId);
      setDeletingFlowId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Fluxos de Automação
            </CardTitle>
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Fluxo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum fluxo configurado</p>
              <p className="text-sm">Crie o seu primeiro fluxo de automação para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onToggle={onToggle}
                  onEdit={handleEdit}
                  onDelete={(id) => setDeletingFlowId(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewFlowModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        onSave={handleSave}
        editingFlow={editingFlow}
      />

      <AlertDialog open={!!deletingFlowId} onOpenChange={() => setDeletingFlowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Fluxo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar este fluxo de automação? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
