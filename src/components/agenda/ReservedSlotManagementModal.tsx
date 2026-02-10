import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Lock,
  Pencil,
  Trash2,
  Pause,
  Play,
  X,
  Save,
  User,
  Clock,
  Calendar,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReservedSlot, UpdateReservedSlotData } from "@/services/ReservedSlotService";
import { toast } from "sonner";

const DAY_LABELS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface ReservedSlotManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: ReservedSlot | null;
  onUpdate: (id: string, data: UpdateReservedSlotData) => Promise<ReservedSlot>;
  onCancel: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
}

export function ReservedSlotManagementModal({
  isOpen,
  onClose,
  reservation,
  onUpdate,
  onCancel,
  onDelete,
  onPause,
  onActivate,
}: ReservedSlotManagementModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [editDuracao, setEditDuracao] = useState(60);
  const [editDataFim, setEditDataFim] = useState("");

  if (!reservation) return null;

  const startEditing = () => {
    setEditTitle(reservation.titulo);
    setEditColor(reservation.cor || "#FCD34D");
    setEditNotes(reservation.observacoes || "");
    setEditHorario(reservation.horario_inicio.substring(0, 5));
    setEditDuracao(reservation.duracao_minutos);
    setEditDataFim(reservation.data_fim || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(reservation.id, {
        titulo: editTitle,
        cor: editColor,
        observacoes: editNotes || null,
        horario_inicio: editHorario + ":00",
        duracao_minutos: editDuracao,
        data_fim: editDataFim || null,
      });
      setIsEditing(false);
      toast.success("Reserva atualizada!");
    } catch {
      toast.error("Erro ao atualizar reserva");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePauseToggle = async () => {
    try {
      if (reservation.status === "ativo") {
        await onPause(reservation.id);
        toast.success("Reserva pausada");
      } else {
        await onActivate(reservation.id);
        toast.success("Reserva reativada");
      }
      onClose();
    } catch {
      toast.error("Erro ao alterar estado da reserva");
    }
  };

  const handleCancel = async () => {
    try {
      await onCancel(reservation.id);
      toast.success("Reserva cancelada");
      onClose();
    } catch {
      toast.error("Erro ao cancelar reserva");
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(reservation.id);
      toast.success("Reserva excluída permanentemente");
      onClose();
    } catch {
      toast.error("Erro ao excluir reserva");
    }
  };

  const diasSemanaText = reservation.dias_semana
    ?.map((d) => DAY_LABELS[d])
    .join(", ");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" style={{ color: reservation.cor }} />
            Horário Reservado
          </DialogTitle>
        </DialogHeader>

        {isEditing ? (
          /* ===== EDIT MODE ===== */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={editHorario} onChange={(e) => setEditHorario(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" min={15} step={15} value={editDuracao} onChange={(e) => setEditDuracao(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input type="date" value={editDataFim} onChange={(e) => setEditDataFim(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-10 p-1" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelEditing} size="sm">
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </div>
          </div>
        ) : (
          /* ===== VIEW MODE ===== */
          <div className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <Badge
                variant={reservation.status === "ativo" ? "default" : "secondary"}
                className={cn(
                  reservation.status === "pausado" && "bg-warning/20 text-warning-foreground"
                )}
              >
                {reservation.status === "ativo" ? "Ativo" : "Pausado"}
              </Badge>
              <Badge variant="outline">{reservation.tipo === "fixo" ? "Fixo (semanal)" : "Personalizado"}</Badge>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{reservation.titulo}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm">{reservation.patient?.full_name || "—"}</p>
                  {reservation.professional && (
                    <p className="text-xs text-muted-foreground">
                      Profissional: {reservation.professional.full_name}
                    </p>
                  )}
                  {reservation.service && (
                    <p className="text-xs text-muted-foreground">
                      Serviço: {reservation.service.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm">
                    {reservation.horario_inicio.substring(0, 5)} • {reservation.duracao_minutos}min
                  </p>
                  {reservation.tipo === "fixo" && diasSemanaText && (
                    <p className="text-xs text-muted-foreground">
                      Recorrente: {diasSemanaText}
                    </p>
                  )}
                  {reservation.tipo === "personalizado" && reservation.horarios_personalizados && (
                    <div className="text-xs text-muted-foreground">
                      {reservation.horarios_personalizados.map((entry, i) => (
                        <span key={i}>
                          {DAY_LABELS[entry.dia]} {entry.hora.substring(0, 5)}
                          {i < reservation.horarios_personalizados!.length - 1 && " • "}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm">
                    Desde {format(new Date(reservation.data_inicio + "T00:00"), "dd/MM/yyyy")}
                    {reservation.data_fim
                      ? ` até ${format(new Date(reservation.data_fim + "T00:00"), "dd/MM/yyyy")}`
                      : " (sem data fim)"}
                  </p>
                </div>
              </div>

              {reservation.observacoes && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-xs text-muted-foreground">{reservation.observacoes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>

              <Button variant="outline" size="sm" onClick={handlePauseToggle}>
                {reservation.status === "ativo" ? (
                  <><Pause className="h-4 w-4 mr-1" /> Pausar</>
                ) : (
                  <><Play className="h-4 w-4 mr-1" /> Reativar</>
                )}
              </Button>

              {/* Cancel (soft delete) */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <X className="h-4 w-4 mr-1" /> Cancelar Reserva
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A reserva será cancelada mas permanecerá no histórico.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Cancelar Reserva
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Permanent delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A reserva será removida permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir Permanentemente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
