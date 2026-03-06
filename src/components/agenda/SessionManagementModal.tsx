import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Trash2, Copy, Loader2, CalendarClock } from "lucide-react";
import { Session } from "@/services/SessionService";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";

interface SessionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  sessions: Session[];
  onUpdateSession: (session: Session) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onDuplicateSession?: (session: Session) => void;
}

export function SessionManagementModal({
  isOpen,
  onClose,
  session,
  sessions,
  onUpdateSession,
  onDeleteSession,
  onDuplicateSession,
}: SessionManagementModalProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!session) return null;

  const startTime = session.start_time instanceof Date ? session.start_time : new Date(session.start_time);
  const endTime = session.end_time instanceof Date ? session.end_time : new Date(session.end_time);

  const statusOptions: { value: string; label: string }[] = [
    { value: "agendado", label: "Agendado" },
    { value: "confirmado", label: "Confirmado" },
    { value: "em_andamento", label: "Em Andamento" },
    { value: "finalizado", label: "Finalizado" },
    { value: "cancelado", label: "Cancelado" },
    { value: "faltou", label: "Faltou" },
  ];

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await onUpdateSession({ ...session, status: newStatus });
      toast.success(`Status atualizado para "${statusOptions.find(s => s.value === newStatus)?.label}"`);
    } catch (error) {
      toast.error("Erro ao atualizar status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    await onDeleteSession(session.id);
    toast.success("Sessão removida com sucesso");
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicateSession?.(session);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Gestão de Sessão
            </DialogTitle>
            <DialogDescription>
              {format(startTime, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Session Info */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{session.paciente?.full_name ?? "Paciente"}</span>
                <StatusBadge status={session.status as any} />
              </div>
              <p className="text-xs text-muted-foreground">
                {session.servico?.name} • {session.profissional?.full_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(startTime, "HH:mm")} – {format(endTime, "HH:mm")}
              </p>
              {session.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {session.notes}
                </p>
              )}
            </div>

            {/* Status Actions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Alterar Status</p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={session.status === opt.value ? "default" : "outline"}
                    disabled={isUpdating || session.status === opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className="text-xs"
                  >
                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Payment Info */}
            {session.payment_status && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pagamento:</span>
                <Badge variant={session.payment_status === "pago" ? "default" : "secondary"}>
                  {session.payment_status}
                </Badge>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              {onDuplicateSession && (
                <Button variant="outline" size="sm" onClick={handleDuplicate} className="flex-1">
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicar
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteOpen(true)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Sessão"
        description="Esta ação não pode ser desfeita."
        entityName={`Sessão de ${session.paciente?.full_name ?? "paciente"}`}
      />
    </>
  );
}
