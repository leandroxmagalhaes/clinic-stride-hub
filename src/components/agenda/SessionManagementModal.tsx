// SessionManagementModal - Lifecycle completo + escolha Pago/Pendente ao finalizar
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Trash2,
  Coins,
  Copy,
  Pencil,
  Save,
  Banknote,
  CircleDollarSign,
  Hourglass,
} from "lucide-react";
import { Session, SessionService } from "@/services/SessionService";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { AddCreditsModal, CreditPurchaseData } from "@/components/patients/AddCreditsModal";
import { PreSessionBriefingCard } from "@/components/agenda/PreSessionBriefingCard";
import { usePreSessionBriefing } from "@/hooks/usePreSessionBriefing";
import { useData } from "@/contexts/DataContext";

export type SessionStatus = "agendado" | "confirmado" | "realizado" | "cancelado" | "falta";
export type PaymentStatus = "pago" | "pendente";

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  agendado: { label: "Agendado", color: "bg-blue-500", icon: <Clock className="h-4 w-4" /> },
  confirmado: { label: "Confirmado", color: "bg-green-500", icon: <Check className="h-4 w-4" /> },
  realizado: { label: "Realizado", color: "bg-muted", icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelado: { label: "Cancelado", color: "bg-destructive", icon: <X className="h-4 w-4" /> },
  falta: { label: "Falta", color: "bg-warning", icon: <AlertTriangle className="h-4 w-4" /> },
};

const ALL_STATUSES: SessionStatus[] = ["agendado", "confirmado", "realizado", "cancelado", "falta"];
const CANCELLATION_REASONS = ["Utente desmarcou", "Clínica desmarcou", "Doença do utente", "Outro motivo"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const MINUTES = [0, 15, 30, 45];

const PAYMENT_METHOD_OPTIONS = [
  { value: "numerario", label: "Numerário" },
  { value: "mbway", label: "MB Way" },
  { value: "multibanco", label: "Multibanco" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao", label: "Cartão" },
];

interface SessionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  sessions: Session[];
  getCreditBalance: (patientId: string) => number;
  onUpdateSession: (id: string, data: Partial<Session>) => Promise<void>;
  onDeleteSession?: (sessionId: string, reason?: string) => Promise<void>;
  onRefundCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
  onUseCredit: (
    patientId: string,
    sessionId: string,
  ) => Promise<{ success: boolean; error?: string; alreadyDeducted?: boolean }>;
  wasCreditUsedForSession: (sessionId: string) => boolean;
  onAddCredits?: (patientId: string, data: CreditPurchaseData) => Promise<void>;
  onDuplicateSession?: (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    date: Date;
    hour: number;
    minute: number;
    notes: string;
  }) => Promise<void>;
}

export function SessionManagementModal({
  isOpen,
  onClose,
  session,
  sessions,
  getCreditBalance,
  onUpdateSession,
  onDeleteSession,
  onRefundCredit,
  onUseCredit,
  wasCreditUsedForSession,
  onAddCredits,
  onDuplicateSession,
}: SessionManagementModalProps) {
  const navigate = useNavigate();
  const { professionals, services } = useData();

  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNoShowDialog, setShowNoShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [noShowRefund, setNoShowRefund] = useState(false);
  const [showEvolutionPrompt, setShowEvolutionPrompt] = useState(false);

  // ── Dialog Finalizar (Pago / Pendente) ─────────────────────────────────────
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalizePayment, setFinalizePayment] = useState<PaymentStatus>("pago");
  const [finalizeMethod, setFinalizeMethod] = useState("numerario");
  // ─────────────────────────────────────────────────────────────────────────

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newHour, setNewHour] = useState<number | undefined>(undefined);

  const [isDuplicating, setIsDuplicating] = useState(false);
  const [dupDate, setDupDate] = useState<Date | undefined>(undefined);
  const [dupHour, setDupHour] = useState<number | undefined>(undefined);
  const [dupMinute, setDupMinute] = useState<number>(0);

  // ── Edição completa ────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editStartHour, setEditStartHour] = useState<string>("");
  const [editStartMinute, setEditStartMinute] = useState<string>("0");
  const [editEndHour, setEditEndHour] = useState<string>("");
  const [editEndMinute, setEditEndMinute] = useState<string>("0");
  const [editProfissional, setEditProfissional] = useState<string>("");
  const [editServico, setEditServico] = useState<string>("");
  const [editStatus, setEditStatus] = useState<SessionStatus>("agendado");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  // ─────────────────────────────────────────────────────────────────────────

  const {
    briefing,
    isLoading: briefingLoading,
    refresh: refreshBriefing,
  } = usePreSessionBriefing(session?.id || null, session?.paciente_id || null);

  const isUpcoming = session
    ? new Date(session.start_time).getTime() - Date.now() < 30 * 60 * 1000 &&
      new Date(session.start_time).getTime() > Date.now()
    : false;

  useEffect(() => {
    if (session) {
      const start = new Date(session.start_time);
      const end = new Date(session.end_time);
      setNewDate(start);
      setNewHour(start.getHours());
      setIsRescheduling(false);
      setIsDuplicating(false);
      setIsEditing(false);
      setDupDate(undefined);
      setDupHour(undefined);
      setDupMinute(0);
      setCancelReason("");
      setNoShowRefund(false);
      setShowEvolutionPrompt(false);
      setShowFinalizeDialog(false);
      setFinalizePayment("pago");
      setFinalizeMethod("numerario");
      setEditDate(start);
      setEditStartHour(String(start.getHours()));
      setEditStartMinute(String(start.getMinutes()));
      setEditEndHour(String(end.getHours()));
      setEditEndMinute(String(end.getMinutes()));
      setEditProfissional(session.profissional_id || "");
      setEditServico(session.servico_id || "");
      setEditStatus((session.status as SessionStatus) || "agendado");
      setEditPrice(String(session.price || ""));
      setEditNotes(session.notes || "");
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
  const sessionDateISO = format(new Date(session.start_time), "yyyy-MM-dd");

  // ── Lógica avulso ─────────────────────────────────────────────────────────
  const sessionPrice = (session as any).price || 0;
  const isAvulsoSession = sessionPrice > 0 && (session as any).avulso === true;
  const canFinalize = isAvulsoSession || creditWasUsed || creditBalance > 0;
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editDate) {
      toast.error("Selecione uma data");
      return;
    }
    if (!editStartHour) {
      toast.error("Selecione a hora de início");
      return;
    }
    setIsLoading(true);
    try {
      const startTime = new Date(editDate);
      startTime.setHours(parseInt(editStartHour), parseInt(editStartMinute), 0, 0);
      const endTime = new Date(editDate);
      if (editEndHour) {
        endTime.setHours(parseInt(editEndHour), parseInt(editEndMinute), 0, 0);
      } else {
        const svc = services.find((s) => s.id === editServico);
        endTime.setTime(startTime.getTime() + (svc?.duration_minutes || 60) * 60000);
      }
      await onUpdateSession(session.id, {
        start_time: startTime,
        end_time: endTime,
        profissional_id: editProfissional,
        servico_id: editServico,
        status: editStatus,
        price: parseFloat(editPrice) || 0,
        notes: editNotes,
      });
      toast.success("Sessão actualizada!");
      setIsEditing(false);
      onClose();
    } catch {
      toast.error("Erro ao guardar alterações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onUpdateSession(session.id, { status: "confirmado" });
      toast.success("Sessão confirmada!");
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  // ── Abre o dialog de escolha de pagamento ─────────────────────────────────
  const handleClickFinalize = () => {
    if (!canFinalize && !isAvulsoSession) {
      toast.error("Não é possível finalizar: o utente não possui créditos.");
      return;
    }
    setShowFinalizeDialog(true);
  };

  // ── Confirma a finalização com a escolha do utilizador ───────────────────
  const handleConfirmFinalize = async () => {
    setIsLoading(true);
    setShowFinalizeDialog(false);
    try {
      if (isAvulsoSession) {
        // Avulso — nunca consome créditos
        await onUpdateSession(session.id, {
          status: "realizado",
          payment_status: finalizePayment,
          ...(finalizePayment === "pago" ? { payment_method: finalizeMethod } : {}),
        });
        if (finalizePayment === "pago") {
          toast.success(`Sessão avulsa finalizada e paga · ${sessionPrice.toFixed(2)}€`);
        } else {
          toast.warning(`Sessão finalizada · Pagamento de ${sessionPrice.toFixed(2)}€ pendente`);
        }
      } else {
        // Lógica normal com créditos
        if (!creditWasUsed) {
          const result = await onUseCredit(session.paciente_id, session.id);
          if (!result.success) {
            toast.error(result.error || "Erro ao descontar crédito");
            return;
          }
          if (result.alreadyDeducted) toast.info("Crédito já havia sido descontado");
          else toast.success("Crédito descontado!");
        }
        await onUpdateSession(session.id, {
          status: "realizado",
          payment_status: finalizePayment,
          ...(finalizePayment === "pago" ? { payment_method: finalizeMethod } : {}),
        });
        if (finalizePayment === "pago") {
          toast.success("Sessão finalizada e paga!");
        } else {
          toast.warning("Sessão finalizada · Pagamento pendente — aparecerá em Contas a Receber");
        }
      }
      setShowEvolutionPrompt(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error("Selecione um motivo para o cancelamento");
      return;
    }
    setIsLoading(true);
    try {
      if (creditWasUsed) {
        const r = await onRefundCredit(session.paciente_id, session.id);
        if (r.success) toast.info("Crédito estornado ao utente");
        else toast.error(r.error || "Erro ao estornar crédito");
      }
      await onUpdateSession(session.id, {
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

  const handleNoShow = async () => {
    setIsLoading(true);
    try {
      if (noShowRefund && creditWasUsed) {
        const r = await onRefundCredit(session.paciente_id, session.id);
        if (r.success) toast.info("Crédito estornado (política da clínica)");
      } else if (creditWasUsed) {
        toast.info("Crédito mantido (política da clínica)");
      }
      await onUpdateSession(session.id, {
        status: "falta",
        notes: `${session.notes || ""}\n[FALTA] Utente não compareceu`.trim(),
      });
      toast.success("Falta registada");
      setShowNoShowDialog(false);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate || newHour === undefined) {
      toast.error("Selecione data e hora");
      return;
    }
    setIsLoading(true);
    try {
      const result = SessionService.reschedule(session, newDate, newHour, sessions);
      if (result.success && result.updatedSession) {
        await onUpdateSession(session.id, {
          start_time: result.updatedSession.start_time,
          end_time: result.updatedSession.end_time,
        });
        toast.success("Sessão remarcada!");
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
    navigate(`/prontuarios?paciente=${session.paciente_id}&sessao_data=${sessionDateISO}&auto_evolucao=1`);
  };

  const handleDeleteSession = async () => {
    if (!onDeleteSession) return;
    await onDeleteSession(session.id, "Sessão apagada pelo utilizador");
    toast.success("Sessão apagada");
    onClose();
  };

  const handleDuplicate = async () => {
    if (!dupDate || dupHour === undefined) {
      toast.error("Selecione data e hora para a nova sessão");
      return;
    }
    if (!onDuplicateSession) return;
    setIsLoading(true);
    try {
      await onDuplicateSession({
        pacienteId: session.paciente_id,
        profissionalId: session.profissional_id,
        servicoId: session.servico_id || "",
        date: dupDate,
        hour: dupHour,
        minute: dupMinute,
        notes: session.notes || "",
      });
      toast.success("Sessão duplicada!");
      setIsDuplicating(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao duplicar sessão");
    } finally {
      setIsLoading(false);
    }
  };

  const isTerminalStatus = currentStatus === "realizado" || currentStatus === "cancelado" || currentStatus === "falta";
  const currentPaymentStatus = (session as any).payment_status;
  const isPago = currentPaymentStatus === "pago";
  const isPendente = currentStatus === "realizado" && currentPaymentStatus === "pendente";

  return (
    <>
      <Dialog open={isOpen && !showEvolutionPrompt} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
            {/* ── Resumo da sessão ────────────────────────────────────────── */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-lg font-semibold">{patientName}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAvulsoSession && (
                    <Badge className="bg-amber-500 text-white text-xs gap-1">
                      <Banknote className="h-3 w-3" />
                      Avulso · {sessionPrice.toFixed(2)}€
                    </Badge>
                  )}
                  {isPago && currentStatus === "realizado" && (
                    <Badge className="bg-green-600 text-white text-xs gap-1">
                      <CircleDollarSign className="h-3 w-3" />
                      Pago
                    </Badge>
                  )}
                  {isPendente && (
                    <Badge className="bg-orange-500 text-white text-xs gap-1">
                      <Hourglass className="h-3 w-3" />A Receber
                    </Badge>
                  )}
                  <Badge className={cn("text-white", STATUS_CONFIG[currentStatus]?.color || "bg-muted")}>
                    {STATUS_CONFIG[currentStatus]?.icon}
                    <span className="ml-1">{STATUS_CONFIG[currentStatus]?.label}</span>
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span className="capitalize">{sessionDateTime}</span>
              </div>

              {/* Créditos — só mostra se NÃO for avulso */}
              {!isAvulsoSession && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Saldo de créditos:</span>
                  <Badge variant={creditBalance > 0 ? "default" : "destructive"}>
                    {creditBalance} crédito{creditBalance !== 1 ? "s" : ""}
                  </Badge>
                  {creditWasUsed && (
                    <Badge variant="outline" className="text-xs">
                      ✓ Descontado
                    </Badge>
                  )}
                </div>
              )}

              {/* Sem créditos (não avulso) */}
              {!isAvulsoSession && !canFinalize && !isTerminalStatus && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Utente sem créditos. Adicione antes de finalizar.</span>
                  </div>
                  {onAddCredits && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-primary text-primary hover:bg-primary/10"
                      onClick={() => setShowAddCreditsModal(true)}
                    >
                      <Coins className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  )}
                </div>
              )}

              {/* Avulso info */}
              {isAvulsoSession && !isTerminalStatus && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <Banknote className="h-4 w-4 shrink-0" />
                  <span>
                    Sessão avulsa · <strong>{sessionPrice.toFixed(2)}€</strong> · sem créditos
                  </span>
                </div>
              )}

              {/* Pendente a receber */}
              {isPendente && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
                  <Hourglass className="h-4 w-4 shrink-0" />
                  <span>
                    Pagamento pendente ·{" "}
                    <strong>{sessionPrice > 0 ? `${sessionPrice.toFixed(2)}€` : "valor a confirmar"}</strong> ·
                    registado em Contas a Receber
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {(isUpcoming || briefing) && (
              <PreSessionBriefingCard briefing={briefing!} isLoading={briefingLoading} onRefresh={refreshBriefing} />
            )}

            {/* ── Painel edição completa ───────────────────────────────────── */}
            {isEditing ? (
              <div className="space-y-4 p-4 border-2 border-primary/20 rounded-xl bg-primary/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Pencil className="h-4 w-4" />
                  Editar Sessão Completa
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal min-h-[40px]">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDate ? format(editDate, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={setEditDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hora início</Label>
                    <div className="flex gap-1">
                      <Select value={editStartHour} onValueChange={setEditStartHour}>
                        <SelectTrigger className="min-h-[40px]">
                          <SelectValue placeholder="HH" />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={editStartMinute} onValueChange={setEditStartMinute}>
                        <SelectTrigger className="min-h-[40px] w-20">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {MINUTES.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {String(m).padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hora fim</Label>
                    <div className="flex gap-1">
                      <Select value={editEndHour} onValueChange={setEditEndHour}>
                        <SelectTrigger className="min-h-[40px]">
                          <SelectValue placeholder="HH" />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, "0")}h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={editEndMinute} onValueChange={setEditEndMinute}>
                        <SelectTrigger className="min-h-[40px] w-20">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {MINUTES.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {String(m).padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Profissional</Label>
                  <Select value={editProfissional} onValueChange={setEditProfissional}>
                    <SelectTrigger className="min-h-[40px]">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Serviço / Especialidade</Label>
                  <Select value={editServico} onValueChange={setEditServico}>
                    <SelectTrigger className="min-h-[40px]">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: (s as any).color || "#10B981" }}
                            />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as SessionStatus)}>
                      <SelectTrigger className="min-h-[40px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_CONFIG[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="min-h-[40px]"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notas</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsEditing(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" className="flex-1 gap-1" onClick={handleSaveEdit} disabled={isLoading}>
                    <Save className="h-3.5 w-3.5" />
                    {isLoading ? "A guardar..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {isTerminalStatus && !isRescheduling && !isDuplicating && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Esta sessão já tem status final. Pode alterar se necessário.</span>
                  </div>
                )}

                {!isRescheduling && !isDuplicating && (
                  <Button
                    variant="outline"
                    className="w-full border-primary/40 text-primary gap-2 hover:bg-primary/5"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar Sessão Completa
                  </Button>
                )}

                {!isRescheduling && !isDuplicating && (
                  <Button
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/10 gap-2"
                    onClick={handleGoToEvolution}
                  >
                    <FileText className="h-4 w-4" />
                    Evolução
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(session.start_time), "dd/MM/yyyy")}
                    </span>
                  </Button>
                )}

                {!isRescheduling && !isDuplicating ? (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setIsRescheduling(true)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Remarcar
                    </Button>
                    {onDuplicateSession && (
                      <Button variant="outline" className="flex-1" onClick={() => setIsDuplicating(true)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </Button>
                    )}
                  </div>
                ) : isRescheduling ? (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Edit3 className="h-4 w-4" />
                      Remarcar Sessão
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nova Data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start font-normal">
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
                      <div className="space-y-1">
                        <Label className="text-xs">Novo Horário</Label>
                        <Select value={newHour?.toString()} onValueChange={(v) => setNewHour(parseInt(v))}>
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
                      <Button variant="outline" size="sm" onClick={() => setIsRescheduling(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleReschedule} disabled={isLoading}>
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isDuplicating && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Copy className="h-4 w-4" />
                      Duplicar Sessão
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dupDate ? format(dupDate, "dd/MM/yyyy") : "Data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dupDate}
                              onSelect={setDupDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hora</Label>
                        <Select value={dupHour?.toString()} onValueChange={(v) => setDupHour(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue placeholder="HH" />
                          </SelectTrigger>
                          <SelectContent>
                            {HOURS.map((h) => (
                              <SelectItem key={h} value={h.toString()}>
                                {h.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min</Label>
                        <Select value={dupMinute.toString()} onValueChange={(v) => setDupMinute(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 15, 30, 45].map((m) => (
                              <SelectItem key={m} value={m.toString()}>
                                {m.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsDuplicating(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleDuplicate} disabled={isLoading}>
                        Confirmar
                      </Button>
                    </div>
                  </div>
                )}

                {!isRescheduling && !isDuplicating && (
                  <div className="grid grid-cols-2 gap-2">
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
                    {!isTerminalStatus && (
                      <Button
                        variant="default"
                        onClick={handleClickFinalize}
                        disabled={isLoading || (!canFinalize && !isAvulsoSession)}
                        className={isAvulsoSession ? "bg-amber-500 hover:bg-amber-600" : ""}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {isAvulsoSession ? `Finalizar · ${sessionPrice.toFixed(2)}€` : "Finalizar"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => setShowCancelDialog(true)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      variant="outline"
                      className="border-warning text-warning hover:bg-warning/10"
                      onClick={() => setShowNoShowDialog(true)}
                      disabled={isLoading}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Falta
                    </Button>
                    {onDeleteSession && (
                      <Button
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Apagar
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG FINALIZAR — PAGO / PENDENTE ═══════════════════════════════ */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-primary" />
              Finalizar Sessão
            </DialogTitle>
            <DialogDescription>
              {patientName} · {serviceName}
              {sessionPrice > 0 && <span className="font-semibold text-foreground"> · {sessionPrice.toFixed(2)}€</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado do pagamento</Label>
              <RadioGroup
                value={finalizePayment}
                onValueChange={(v) => setFinalizePayment(v as PaymentStatus)}
                className="space-y-2"
              >
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    finalizePayment === "pago" ? "border-green-500 bg-green-50" : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => setFinalizePayment("pago")}
                >
                  <RadioGroupItem value="pago" id="pago" />
                  <div className="flex items-center gap-2 flex-1">
                    <CircleDollarSign className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-700">Pago agora</p>
                      <p className="text-xs text-muted-foreground">Entra imediatamente nas receitas do financeiro</p>
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    finalizePayment === "pendente"
                      ? "border-orange-400 bg-orange-50"
                      : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => setFinalizePayment("pendente")}
                >
                  <RadioGroupItem value="pendente" id="pendente" />
                  <div className="flex items-center gap-2 flex-1">
                    <Hourglass className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-orange-700">Pagamento pendente</p>
                      <p className="text-xs text-muted-foreground">Vai para Contas a Receber no financeiro</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {finalizePayment === "pago" && (
              <div className="space-y-1">
                <Label className="text-xs">Método de pagamento</Label>
                <Select value={finalizeMethod} onValueChange={setFinalizeMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowFinalizeDialog(false)}>
              Cancelar
            </Button>
            <Button
              className={cn(
                "flex-1 gap-2",
                finalizePayment === "pago" ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600",
              )}
              onClick={handleConfirmFinalize}
              disabled={isLoading}
            >
              {finalizePayment === "pago" ? (
                <>
                  <CircleDollarSign className="h-4 w-4" />
                  Confirmar Pago
                </>
              ) : (
                <>
                  <Hourglass className="h-4 w-4" />
                  Confirmar Pendente
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Sessão</AlertDialogTitle>
            <AlertDialogDescription>
              {creditWasUsed && (
                <span className="block mb-2 text-green-600">✓ O crédito será automaticamente estornado.</span>
              )}
              Selecione o motivo do cancelamento:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={cancelReason} onValueChange={setCancelReason}>
            <SelectTrigger>
              <SelectValue placeholder="Motivo do cancelamento" />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
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

      {/* No-Show Dialog */}
      <AlertDialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registar Falta (No-Show)</AlertDialogTitle>
            <AlertDialogDescription>
              O utente não compareceu.
              {creditWasUsed && <span className="block mt-2">Crédito já descontado. Deseja estornar?</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {creditWasUsed && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <input
                type="checkbox"
                id="refund-cb"
                checked={noShowRefund}
                onChange={(e) => setNoShowRefund(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="refund-cb" className="text-sm">
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
              Registar Falta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Evolution Prompt */}
      <AlertDialog open={showEvolutionPrompt} onOpenChange={setShowEvolutionPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Sessão Finalizada!
            </AlertDialogTitle>
            <AlertDialogDescription>Deseja registar a evolução clínica agora?</AlertDialogDescription>
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

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteSession}
        title="Apagar Sessão"
        description="A sessão será removida permanentemente."
        entityName={`${patientName} - ${format(new Date(session.start_time), "dd/MM HH:mm")}`}
        warnings={creditWasUsed ? ["O crédito já foi descontado desta sessão"] : []}
      />

      {onAddCredits && (
        <AddCreditsModal
          isOpen={showAddCreditsModal}
          onClose={() => setShowAddCreditsModal(false)}
          patientName={patientName}
          patientId={session.paciente_id}
          onAddCredits={async (data) => {
            await onAddCredits(session.paciente_id, data);
            setShowAddCreditsModal(false);
          }}
        />
      )}
    </>
  );
}
