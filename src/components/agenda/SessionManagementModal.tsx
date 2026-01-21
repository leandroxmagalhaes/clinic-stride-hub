// SessionManagementModal - Full session lifecycle management with credit logic
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, setHours, setMinutes, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  CreditCard,
  FileText,
  Edit3,
} from "lucide-react";
import { Session, SessionService } from "@/services/SessionService";

// Session status types matching business rules
export type SessionStatus = "agendado" | "confirmado" | "realizado" | "cancelado" | "falta";

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  agendado: { label: "Agendado", color: "bg-blue-500", icon: <Clock className="h-4 w-4" /> },
  confirmado: { label: "Confirmado", color: "bg-green-500", icon: <Check className="h-4 w-4" /> },
  realizado: { label: "Realizado", color: "bg-muted", icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelado: { label: "Cancelado", color: "bg-destructive", icon: <X className="h-4 w-4" /> },
  falta: { label: "Falta", color: "bg-warning", icon: <AlertTriangle className="h-4 w-4" /> },
};

const CANCELLATION_REASONS = [
  "Utente desmarcou",
  "Clínica desmarcou",
  "Doença do utente",
  "Outro motivo",
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 to 18:00

interface SessionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  sessions: Session[];
  getCreditBalance: (patientId: string) => number;
  onUpdateSession: (id: string, data: Partial<Session>) => void;
  onRefundCredit: (patientId: string) => void;
  onUseCredit: (patientId: string, sessionId: string) => { success: boolean; error?: string };
  wasCreditUsedForSession: (sessionId: string) => boolean;
}

export function SessionManagementModal({
  isOpen,
  onClose,
  session,
  sessions,
  getCreditBalance,
  onUpdateSession,
  onRefundCredit,
  onUseCredit,
  wasCreditUsedForSession,
}: SessionManagementModalProps) {
  const navigate = useNavigate();
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNoShowDialog, setShowNoShowDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [noShowRefund, setNoShowRefund] = useState(false);
  const [showEvolutionPrompt, setShowEvolutionPrompt] = useState(false);
  
  // Reschedule state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newHour, setNewHour] = useState<number | undefined>(undefined);

  // Reset state when session changes
  useEffect(() => {
    if (session) {
      setNewDate(new Date(session.start_time));
      setNewHour(new Date(session.start_time).getHours());
      setIsRescheduling(false);
      setCancelReason("");
      setNoShowRefund(false);
      setShowEvolutionPrompt(false);
    }
  }, [session?.id]);

  if (!session) return null;

  const currentStatus = session.status as SessionStatus;
  const creditBalance = getCreditBalance(session.paciente_id);
  const creditWasUsed = wasCreditUsedForSession(session.id);
  const patientName = session.paciente?.full_name || "Paciente";
  const serviceName = session.servico?.name || "Serviço";
  const professionalName = session.profissional?.full_name || "Profissional";
  const sessionDateTime = format(new Date(session.start_time), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  // ========== ACTION HANDLERS ==========

  const handleConfirm = () => {
    setIsLoading(true);
    try {
      onUpdateSession(session.id, { status: "confirmado" });
      toast.success("Sessão confirmada!");
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (!cancelReason) {
      toast.error("Selecione um motivo para o cancelamento");
      return;
    }

    setIsLoading(true);
    try {
      // If credit was used, refund it
      if (creditWasUsed) {
        onRefundCredit(session.paciente_id);
        toast.info("Crédito estornado ao utente");
      }

      onUpdateSession(session.id, {
        status: "cancelado",
        notes: `${session.notes || ""}\n[CANCELADO] ${cancelReason}`.trim(),
      });
      toast.success("Sessão cancelada");
      setShowCancelDialog(false);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    setIsLoading(true);
    try {
      // Check if credit was already deducted
      if (!creditWasUsed) {
        // Try to deduct credit now
        const result = onUseCredit(session.paciente_id, session.id);
        if (!result.success) {
          toast.warning("Sessão finalizada sem crédito (pagamento pendente)");
          onUpdateSession(session.id, { status: "realizado", payment_status: "pendente" });
        } else {
          toast.success("Sessão finalizada e crédito descontado!");
          onUpdateSession(session.id, { status: "realizado", payment_status: "pago" });
        }
      } else {
        onUpdateSession(session.id, { status: "realizado" });
        toast.success("Sessão finalizada!");
      }

      // Show evolution prompt
      setShowEvolutionPrompt(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoShow = () => {
    setIsLoading(true);
    try {
      // Optionally refund based on clinic policy
      if (noShowRefund && creditWasUsed) {
        onRefundCredit(session.paciente_id);
        toast.info("Crédito estornado (política da clínica)");
      } else if (creditWasUsed) {
        toast.info("Crédito mantido (política da clínica)");
      }

      onUpdateSession(session.id, {
        status: "falta",
        notes: `${session.notes || ""}\n[FALTA] Utente não compareceu`.trim(),
      });
      toast.success("Falta registrada");
      setShowNoShowDialog(false);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleReschedule = () => {
    if (!newDate || newHour === undefined) {
      toast.error("Selecione data e hora");
      return;
    }

    setIsLoading(true);
    try {
      const result = SessionService.reschedule(session, newDate, newHour, sessions);
      
      if (result.success && result.updatedSession) {
        onUpdateSession(session.id, {
          start_time: result.updatedSession.start_time,
          end_time: result.updatedSession.end_time,
        });
        toast.success("Sessão remarcada com sucesso!");
        setIsRescheduling(false);
        onClose();
      } else {
        toast.error(result.error || "Erro ao remarcar sessão");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToEvolution = () => {
    onClose();
    // Navigate to prontuarios with patient context
    navigate(`/prontuarios?paciente=${session.paciente_id}`);
  };

  const isTerminalStatus = currentStatus === "realizado" || currentStatus === "cancelado" || currentStatus === "falta";

  return (
    <>
      <Dialog open={isOpen && !showEvolutionPrompt} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Gestão de Sessão
            </DialogTitle>
            <DialogDescription>
              {serviceName} com {professionalName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Session Summary */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{patientName}</span>
                <Badge
                  className={cn(
                    "text-white",
                    STATUS_CONFIG[currentStatus]?.color || "bg-muted"
                  )}
                >
                  {STATUS_CONFIG[currentStatus]?.icon}
                  <span className="ml-1">{STATUS_CONFIG[currentStatus]?.label}</span>
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span className="capitalize">{sessionDateTime}</span>
              </div>

              {/* Credit Balance Indicator */}
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Saldo de créditos:</span>
                <Badge variant={creditBalance > 0 ? "default" : "destructive"}>
                  {creditBalance} crédito{creditBalance !== 1 ? "s" : ""}
                </Badge>
                {creditWasUsed && (
                  <Badge variant="outline" className="text-xs">
                    ✓ Crédito já descontado
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Reschedule Section */}
            {!isTerminalStatus && (
              <>
                {isRescheduling ? (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Edit3 className="h-4 w-4" />
                      Remarcar Sessão
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Date Picker */}
                      <div className="space-y-1">
                        <Label className="text-xs">Nova Data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newDate ? format(newDate, "dd/MM/yyyy") : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={newDate}
                              onSelect={setNewDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Hour Picker */}
                      <div className="space-y-1">
                        <Label className="text-xs">Novo Horário</Label>
                        <Select
                          value={newHour?.toString()}
                          onValueChange={(v) => setNewHour(parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Hora" />
                          </SelectTrigger>
                          <SelectContent>
                            {HOURS.map((h) => (
                              <SelectItem key={h} value={h.toString()}>
                                {h.toString().padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRescheduling(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleReschedule}
                        disabled={isLoading}
                      >
                        {isLoading ? "Salvando..." : "Confirmar Remarcação"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsRescheduling(true)}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Remarcar Sessão
                  </Button>
                )}
              </>
            )}

            {/* Status Actions */}
            {!isTerminalStatus && !isRescheduling && (
              <div className="grid grid-cols-2 gap-2">
                {/* Confirm */}
                {currentStatus === "agendado" && (
                  <Button
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                    onClick={handleConfirm}
                    disabled={isLoading}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar
                  </Button>
                )}

                {/* Complete */}
                <Button
                  variant="default"
                  className="bg-primary"
                  onClick={handleComplete}
                  disabled={isLoading}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>

                {/* Cancel */}
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>

                {/* No-Show */}
                <Button
                  variant="outline"
                  className="border-warning text-warning hover:bg-warning/10"
                  onClick={() => setShowNoShowDialog(true)}
                  disabled={isLoading}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Falta
                </Button>
              </div>
            )}

            {/* Terminal Status Message */}
            {isTerminalStatus && (
              <div className="text-center text-muted-foreground text-sm py-2">
                Esta sessão está com status final e não pode ser alterada.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Sessão</AlertDialogTitle>
            <AlertDialogDescription>
              {creditWasUsed && (
                <span className="block mb-2 text-green-600">
                  ✓ O crédito será automaticamente estornado ao utente.
                </span>
              )}
              Selecione o motivo do cancelamento:
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <Select value={cancelReason} onValueChange={setCancelReason}>
            <SelectTrigger>
              <SelectValue placeholder="Motivo do cancelamento" />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {reason}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No-Show Confirmation Dialog */}
      <AlertDialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar Falta (No-Show)</AlertDialogTitle>
            <AlertDialogDescription>
              O utente não compareceu à sessão.
              {creditWasUsed && (
                <span className="block mt-2">
                  O crédito já foi descontado. Deseja estornar?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {creditWasUsed && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <input
                type="checkbox"
                id="refund-checkbox"
                checked={noShowRefund}
                onChange={(e) => setNoShowRefund(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="refund-checkbox" className="text-sm">
                Estornar crédito (política da clínica)
              </label>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleNoShow}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Registrar Falta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Evolution Prompt Dialog */}
      <AlertDialog open={showEvolutionPrompt} onOpenChange={setShowEvolutionPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Sessão Finalizada!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja registrar a evolução clínica do utente agora?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Mais Tarde</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoToEvolution}>
              <FileText className="h-4 w-4 mr-2" />
              Preencher Evolução Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
