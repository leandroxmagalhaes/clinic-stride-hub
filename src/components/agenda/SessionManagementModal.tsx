// SessionManagementModal v4 — edição completa de todos os campos
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
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
  FileText,
  Edit3,
  Trash2,
  Copy,
  Pencil,
  Save,
  CircleDollarSign,
  Hourglass,
  Package,
} from "lucide-react";
import { Session, SessionService } from "@/services/SessionService";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { PreSessionBriefingCard } from "@/components/agenda/PreSessionBriefingCard";
import { DiaryBriefingSection } from "@/components/prontuarios/DiaryBriefingSection";
import { usePreSessionBriefing } from "@/hooks/usePreSessionBriefing";
import { useData } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { checkPostConsultationTrigger } from "@/services/AutomationEngine";

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

const METHOD_MAP: Record<string, string> = {
  numerario: "cash",
  mbway: "mbway",
  multibanco: "multibanco",
  transferencia: "transfer",
  cartao: "credit_card",
  cash: "cash",
  credit_card: "credit_card",
  transfer: "transfer",
  pix: "pix",
};
const PAYMENT_METHOD_OPTIONS = [
  { value: "numerario", label: "💵 Numerário" },
  { value: "mbway", label: "📱 MB Way" },
  { value: "multibanco", label: "🏧 Multibanco" },
  { value: "transferencia", label: "🔁 Transferência" },
  { value: "cartao", label: "💳 Cartão" },
];

interface SessionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  sessions: Session[];
  onUpdateSession: (id: string, data: Partial<Session>) => Promise<void>;
  onDeleteSession?: (sessionId: string, reason?: string) => Promise<void>;
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
  onUpdateSession,
  onDeleteSession,
  onDuplicateSession,
}: SessionManagementModalProps) {
  const navigate = useNavigate();
  const { patients, professionals, services, packs, getActivePack, incrementPackUsage, decrementPackUsage } = useData();

  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNoShowDialog, setShowNoShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEvolutionPrompt, setShowEvolutionPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Dialog Finalizar
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalizePayment, setFinalizePayment] = useState<PaymentStatus>("pago");
  const [finalizeMethod, setFinalizeMethod] = useState("numerario");

  // Dialog Receber pagamento pendente
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receiveMethod, setReceiveMethod] = useState("numerario");

  // Remarcar / Duplicar
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newHour, setNewHour] = useState<number | undefined>();
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [dupDate, setDupDate] = useState<Date | undefined>();
  const [dupHour, setDupHour] = useState<number | undefined>();
  const [dupMinute, setDupMinute] = useState(0);

  // Edição completa
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editStartHour, setEditStartHour] = useState("");
  const [editStartMinute, setEditStartMinute] = useState("0");
  const [editEndHour, setEditEndHour] = useState("");
  const [editEndMinute, setEditEndMinute] = useState("0");
  const [editProfissional, setEditProfissional] = useState("");
  const [editServico, setEditServico] = useState("");
  const [editStatus, setEditStatus] = useState<SessionStatus>("agendado");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPaciente, setEditPaciente] = useState("");
  const [editTipoAgendamento, setEditTipoAgendamento] = useState<"avulso" | "pack">("avulso");
  const [editPackId, setEditPackId] = useState<string>("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("pendente");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editSemCobranca, setEditSemCobranca] = useState(false);
  const [editMotivoSemCobranca, setEditMotivoSemCobranca] = useState<string>("Cortesia");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");

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
    if (!session) return;
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    setIsRescheduling(false);
    setIsDuplicating(false);
    setIsEditing(false);
    setNewDate(start);
    setNewHour(start.getHours());
    setDupDate(undefined);
    setDupHour(undefined);
    setDupMinute(0);
    setCancelReason("");
    setShowEvolutionPrompt(false);
    setShowFinalizeDialog(false);
    setShowReceiveDialog(false);
    setFinalizePayment("pago");
    setFinalizeMethod("numerario");
    setReceiveMethod("numerario");
    setEditDate(start);
    setEditStartHour(String(start.getHours()));
    setEditStartMinute(String(start.getMinutes()));
    setEditEndHour(String(end.getHours()));
    setEditEndMinute(String(end.getMinutes()));
    setEditProfissional(session.profissional_id || "");
    setEditServico(session.servico_id || "");
    setEditStatus((session.status as SessionStatus) || "agendado");
    setEditPrice(String((session as any).price || ""));
    setEditNotes(session.notes || "");
    setEditPaciente(session.paciente_id || "");
    setEditTipoAgendamento((session as any).tipo_agendamento || "avulso");
    setEditPackId(((session as any).pack_id || (session as any).package_id) || "");
    setEditPaymentStatus((session as any).pagamento_estado || "pendente");
    setEditPaymentMethod((session as any).pagamento_metodo || "");
    setEditPaymentDate((session as any).pagamento_data || "");
    setEditSemCobranca(!!(session as any).sem_cobranca);
    setEditMotivoSemCobranca((session as any).motivo_sem_cobranca || "Cortesia");
  }, [session?.id]);

  if (!session) return null;

  // Dados derivados
  const currentStatus = session.status as SessionStatus;
  const patientName = session.paciente?.full_name || "Paciente";
  const serviceName = session.servico?.name || "Serviço";
  const professionalName = session.profissional?.full_name || "Profissional";
  const sessionDateTime = format(new Date(session.start_time), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  const sessionDateISO = format(new Date(session.start_time), "yyyy-MM-dd");
  const sessionPrice: number = (session as any).price || (session.servico as any)?.price || 0;
  const currentPaymentStatus = (session as any).payment_status;

  // Pack activo do paciente
  const activePack = getActivePack(session.paciente_id);
  const sessionPackId = (session as any).pack_id ?? (session as any).package_id;
  const sessionPack = sessionPackId ? packs.find((p) => p.id === sessionPackId) : null;
  const cobertoPorPackPago = !!sessionPack && sessionPack.payment_status === "pago";
  const isPago = currentStatus === "realizado" && (currentPaymentStatus === "pago" || cobertoPorPackPago);
  const isPendente = currentStatus === "realizado" && currentPaymentStatus === "pendente" && !cobertoPorPackPago;
  const isTerminalStatus = ["realizado", "cancelado", "falta"].includes(currentStatus);

  const trySetPaymentMethod = async (sessionId: string, method: string) => {
    const dbMethod = METHOD_MAP[method] ?? null;
    if (!dbMethod) return;
    await supabase
      .from("sessoes")
      .update({ payment_method: dbMethod })
      .eq("id", sessionId)
      .then(({ error: e }) => {
        if (e) console.warn("payment_method ignorado:", e.message);
      });
  };

  // Handlers
  const handleSaveEdit = async () => {
    if (!editDate || !editStartHour) {
      toast.error("Selecione data e hora");
      return;
    }
    setIsLoading(true);
    try {
      const startTime = new Date(editDate);
      startTime.setHours(parseInt(editStartHour), parseInt(editStartMinute), 0, 0);
      const endTime = new Date(editDate);
      if (editEndHour) endTime.setHours(parseInt(editEndHour), parseInt(editEndMinute), 0, 0);
      else {
        const svc = services.find((s) => s.id === editServico);
        endTime.setTime(startTime.getTime() + (svc?.duration_minutes || 60) * 60000);
      }
      await onUpdateSession(session.id, {
        start_time: startTime,
        end_time: endTime,
        paciente_id: editPaciente,
        profissional_id: editProfissional,
        servico_id: editServico,
        status: editStatus,
        price: editSemCobranca ? 0 : (parseFloat(editPrice) || 0),
        notes: editNotes,
        payment_status: editSemCobranca ? "pago" : editPaymentStatus,
      } as any);
      // Update extended fields directly via supabase
      await (supabase as any).from("sessoes").update({
        tipo_agendamento: editTipoAgendamento,
        pack_id: editTipoAgendamento === "pack" && editPackId ? editPackId : null,
        pagamento_estado: editSemCobranca ? "pago" : editPaymentStatus,
        pagamento_metodo: !editSemCobranca && editPaymentStatus !== "pendente" && editPaymentMethod ? editPaymentMethod : null,
        pagamento_data: !editSemCobranca && editPaymentStatus !== "pendente" && editPaymentDate ? editPaymentDate : null,
        sem_cobranca: editSemCobranca,
        motivo_sem_cobranca: editSemCobranca ? editMotivoSemCobranca : null,
      }).eq("id", session.id);
      toast.success("Sessão actualizada!");
      setIsEditing(false);
      onClose();
    } catch {
      toast.error("Erro ao guardar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onUpdateSession(session.id, { status: "confirmado" });
      toast.success("Sessão confirmada!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClickFinalize = () => {
    const finalPack = sessionPack || activePack;
    const packPago = !!finalPack && finalPack.payment_status === "pago";
    if (packPago) {
      // Pack já pago: finalizar sem perguntar método/valor
      setFinalizePayment("pago");
      handleConfirmFinalize();
    } else {
      setFinalizePayment("pago");
      setFinalizeMethod("numerario");
      setShowFinalizeDialog(true);
    }
  };

  const handleConfirmFinalize = async () => {
    setIsLoading(true);
    setShowFinalizeDialog(false);
    const finalPack = sessionPack || activePack;
    const packPago = !!finalPack && finalPack.payment_status === "pago";
    const effectivePaymentStatus = packPago ? "pago" : finalizePayment;
    try {
      await onUpdateSession(session.id, { status: "realizado", payment_status: effectivePaymentStatus });
      if (!packPago) {
        await trySetPaymentMethod(session.id, finalizeMethod);
      }
      // Incrementar pack se sessão está associada
      if (sessionPackId) await incrementPackUsage(sessionPackId);
      else if (activePack) {
        // Associar ao pack activo automaticamente
        await supabase
          .from("sessoes")
          .update({ pack_id: activePack.id } as any)
          .eq("id", session.id);
        await incrementPackUsage(activePack.id);
      }
      if (packPago) {
        toast.success(`Sessão finalizada · coberta pelo Pack ${finalPack!.numero_pack} pago`);
      } else if (effectivePaymentStatus === "pago") {
        toast.success(sessionPrice > 0 ? `Pago · ${sessionPrice.toFixed(2)}€` : "Sessão finalizada e paga!");
      } else {
        toast.warning("Sessão finalizada · Pagamento pendente → Contas a Receber");
      }
      // Alerta de pack a acabar
      const packToCheck = sessionPackId ? packs.find((p) => p.id === sessionPackId) : activePack;
      if (packToCheck) {
        const restantes = packToCheck.quantidade_sessoes - (packToCheck.sessoes_usadas + 1);
        if (restantes <= 0) toast.warning(`⚠️ Pack ${packToCheck.numero_pack} esgotado! Considere criar um novo pack.`);
        else if (restantes === 1) toast.warning(`⚠️ Última sessão do Pack ${packToCheck.numero_pack}!`);
        else if (restantes === 2) toast.info(`Pack ${packToCheck.numero_pack}: restam 2 sessões.`);
      }
      // Fire post-consultation automation trigger (non-blocking)
      if (session.paciente_id && session.clinic_id) {
        checkPostConsultationTrigger(session.id, session.paciente_id, session.clinic_id)
          .catch(err => console.error('Post-consultation automation error:', err));
      }
      setShowEvolutionPrompt(true);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Tente novamente"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceivePayment = async () => {
    setIsLoading(true);
    setShowReceiveDialog(false);
    try {
      const { error } = await supabase.from("sessoes").update({ payment_status: "pago" }).eq("id", session.id);
      if (error) throw error;
      await trySetPaymentMethod(session.id, receiveMethod);
      await onUpdateSession(session.id, { payment_status: "pago" } as any);
      toast.success(`Pagamento recebido${sessionPrice > 0 ? " · " + sessionPrice.toFixed(2) + "€" : ""}!`);
      onClose();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Tente novamente"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error("Selecione um motivo");
      return;
    }
    setIsLoading(true);
    try {
      // Reverter pack se estava associado
      if (sessionPackId && currentStatus === "realizado") await decrementPackUsage(sessionPackId);
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
        toast.error(result.error || "Erro ao remarcar");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!dupDate || dupHour === undefined || !onDuplicateSession) {
      toast.error("Selecione data e hora");
      return;
    }
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
      toast.error(e instanceof Error ? e.message : "Erro ao duplicar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!onDeleteSession) return;
    await onDeleteSession(session.id);
    toast.success("Sessão apagada");
    onClose();
  };

  const handleGoToEvolution = () => {
    onClose();
    navigate(`/prontuarios?paciente=${session.paciente_id}&sessao_data=${sessionDateISO}&auto_evolucao=1`);
  };

  return (
    <>
      {/* ══ MODAL PRINCIPAL ══════════════════════════════════════════════════ */}
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
            {/* Resumo */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-lg font-semibold">{patientName}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {cobertoPorPackPago && (
                    <Badge className="bg-green-600 text-white text-xs gap-1">
                      <Package className="h-3 w-3" />
                      Incluído no pack
                    </Badge>
                  )}
                  {isPago && !cobertoPorPackPago && (
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
                  <Badge className={cn("text-white", STATUS_CONFIG[currentStatus]?.color)}>
                    {STATUS_CONFIG[currentStatus]?.icon}
                    <span className="ml-1">{STATUS_CONFIG[currentStatus]?.label}</span>
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span className="capitalize">{sessionDateTime}</span>
              </div>

              {/* Info do pack */}
              {sessionPack && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg text-sm border",
                    sessionPack.alert_status === "ultima_sessao"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : sessionPack.alert_status === "penultima_sessao"
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : "bg-blue-50 border-blue-200 text-blue-700",
                  )}
                >
                  <Package className="h-4 w-4 flex-shrink-0" />
                  <span>
                    <strong>Pack {sessionPack.numero_pack}</strong>
                    {" · "}
                    {sessionPack.sessoes_usadas}/{sessionPack.quantidade_sessoes} sessões
                    {sessionPack.alert_status === "ultima_sessao" && " · ⚠️ Última sessão!"}
                    {sessionPack.alert_status === "penultima_sessao" && " · ⚠️ Penúltima sessão!"}
                  </span>
                </div>
              )}
              {!sessionPack && activePack && !isTerminalStatus && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg text-sm bg-blue-50 border border-blue-200 text-blue-700">
                  <Package className="h-4 w-4 flex-shrink-0" />
                  <span>Pack {activePack.numero_pack} activo · será associado ao finalizar</span>
                </div>
              )}

              {/* Pendente a receber */}
              {isPendente && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
                  <div className="flex items-center gap-2">
                    <Hourglass className="h-4 w-4 shrink-0" />
                    <span>
                      Pagamento pendente ·{" "}
                      <strong>{sessionPrice > 0 ? `${sessionPrice.toFixed(2)}€` : "valor a confirmar"}</strong>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-green-600 hover:bg-green-700 gap-1 text-xs h-8"
                    onClick={() => {
                      onClose();
                      setTimeout(() => {
                        window.dispatchEvent(
                          new CustomEvent("open-payment-modal", {
                            detail: {
                              sessionId: session.id,
                              patientId: session.paciente_id,
                              patientName: patientName,
                              amount: sessionPrice,
                            },
                          }),
                        );
                      }, 50);
                    }}
                  >
                    <CircleDollarSign className="h-3.5 w-3.5" />
                    💶 Pagamento
                  </Button>
                </div>
              )}

              {/* Coberto pelo pack */}
              {cobertoPorPackPago && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                  <Package className="h-4 w-4 shrink-0" />
                  <span>
                    Valor coberto pelo <strong>Pack {sessionPack!.numero_pack}</strong> pago · sem cobrança individual
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {(isUpcoming || briefing) && (
              <PreSessionBriefingCard briefing={briefing!} isLoading={briefingLoading} onRefresh={refreshBriefing} />
            )}

            {/* Diary Briefing */}
            <DiaryBriefingSection
              pacienteId={session.paciente_id}
              lastSessionDate={null}
            />

            {/* Edição completa */}
            {isEditing ? (
              <div className="space-y-4 p-4 border-2 border-primary/20 rounded-xl bg-primary/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Pencil className="h-4 w-4" />
                  Editar Sessão Completa
                </div>

                {/* Patient — searchable combobox */}
                <div className="space-y-1">
                  <Label className="text-xs">Utente</Label>
                  <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal min-h-[40px]">
                        <User className="mr-2 h-4 w-4" />
                        {editPaciente
                          ? patients.find((p) => p.id === editPaciente)?.full_name || "Selecionar utente"
                          : "Selecionar utente"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Pesquisar utente..."
                          value={patientSearchQuery}
                          onValueChange={setPatientSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum utente encontrado</CommandEmpty>
                          <CommandGroup>
                            {patients
                              .filter((p) =>
                                p.full_name.toLowerCase().includes(patientSearchQuery.toLowerCase()),
                              )
                              .slice(0, 50)
                              .map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.full_name}
                                  onSelect={() => {
                                    setEditPaciente(p.id);
                                    setPatientSearchOpen(false);
                                    setPatientSearchQuery("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      editPaciente === p.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {p.full_name}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date */}
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

                {/* Start/End time */}
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

                {/* Professional */}
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

                {/* Service */}
                <div className="space-y-1">
                  <Label className="text-xs">Serviço</Label>
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

                {/* Session type toggle */}
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Agendamento</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={editTipoAgendamento === "avulso" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => {
                        setEditTipoAgendamento("avulso");
                        setEditPackId("");
                      }}
                    >
                      Avulso
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={editTipoAgendamento === "pack" ? "default" : "outline"}
                      className="flex-1 gap-1"
                      onClick={() => setEditTipoAgendamento("pack")}
                    >
                      <Package className="h-3.5 w-3.5" />
                      Pack
                    </Button>
                  </div>
                </div>

                {/* Pack selector — only when type=pack */}
                {editTipoAgendamento === "pack" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Pack</Label>
                    <Select value={editPackId || "__none__"} onValueChange={(v) => setEditPackId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="min-h-[40px]">
                        <SelectValue placeholder="Selecione pack..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem pack</SelectItem>
                        {packs
                          .filter((p) => p.paciente_id === editPaciente && p.status === "ativo")
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              Pack #{p.numero_pack} · {p.sessoes_usadas}/{p.total_sessoes}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Status & Price */}
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
                      value={editSemCobranca ? "0" : editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="min-h-[40px]"
                      placeholder="0,00"
                      disabled={editSemCobranca}
                    />
                  </div>
                </div>

                {/* Sem cobrança */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch id="edit-sem-cobranca" checked={editSemCobranca} onCheckedChange={setEditSemCobranca} />
                    <Label htmlFor="edit-sem-cobranca" className="text-xs cursor-pointer">Sem cobrança</Label>
                  </div>
                  {editSemCobranca && (
                    <Select value={editMotivoSemCobranca} onValueChange={setEditMotivoSemCobranca}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cortesia">Cortesia</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="Ação social">Ação social</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Payment status */}
                <div className="space-y-1">
                  <Label className="text-xs">Estado de Pagamento</Label>
                  <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                    <SelectTrigger className="min-h-[40px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment method & date — visible when pago/parcial */}
                {(editPaymentStatus === "pago" || editPaymentStatus === "parcial") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Método</Label>
                      <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                        <SelectTrigger className="min-h-[40px]">
                          <SelectValue placeholder="Método..." />
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
                    <div className="space-y-1">
                      <Label className="text-xs">Data pagamento</Label>
                      <Input
                        type="date"
                        value={editPaymentDate}
                        onChange={(e) => setEditPaymentDate(e.target.value)}
                        className="min-h-[40px]"
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
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
                  <>
                    <Button
                      variant="outline"
                      className="w-full border-primary/40 text-primary gap-2 hover:bg-primary/5"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar Sessão Completa
                    </Button>
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
                  </>
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
                ) : isDuplicating ? (
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
                ) : null}

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
                      <Button variant="default" onClick={handleClickFinalize} disabled={isLoading}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Finalizar
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

      {/* ══ DIALOG FINALIZAR ═════════════════════════════════════════════════ */}
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
              {(sessionPack || activePack) && (
                <span className="block text-xs mt-1 text-blue-600">
                  Pack {(sessionPack || activePack)!.numero_pack} · {(sessionPack || activePack)!.sessoes_usadas}/
                  {(sessionPack || activePack)!.quantidade_sessoes} sessões
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                <RadioGroupItem value="pago" id="fin-pago" />
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">Pago agora</p>
                    <p className="text-xs text-muted-foreground">Entra imediatamente nas receitas</p>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  finalizePayment === "pendente" ? "border-orange-400 bg-orange-50" : "border-border hover:bg-muted/50",
                )}
                onClick={() => setFinalizePayment("pendente")}
              >
                <RadioGroupItem value="pendente" id="fin-pendente" />
                <div className="flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium text-orange-700">Pagamento pendente</p>
                    <p className="text-xs text-muted-foreground">Vai para Contas a Receber</p>
                  </div>
                </div>
              </div>
            </RadioGroup>
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

      {/* ══ DIALOG RECEBER PAGAMENTO ═════════════════════════════════════════ */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-green-600" />
              Receber Pagamento
            </DialogTitle>
            <DialogDescription>
              {patientName} · {sessionPrice > 0 && `${sessionPrice.toFixed(2)}€`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <CircleDollarSign className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">
                  {sessionPrice > 0 ? `${sessionPrice.toFixed(2)}€` : "Valor a confirmar"}
                </p>
                <p className="text-xs text-green-600">
                  {format(new Date(session.start_time), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Método de pagamento</Label>
              <Select value={receiveMethod} onValueChange={setReceiveMethod}>
                <SelectTrigger className="min-h-[44px]">
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
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowReceiveDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleReceivePayment}
              disabled={isLoading}
            >
              <CircleDollarSign className="h-4 w-4" />
              {isLoading ? "A registar..." : "Confirmar Recebimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOGS SECUNDÁRIOS ══════════════════════════════════════════════ */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Sessão</AlertDialogTitle>
            <AlertDialogDescription>Selecione o motivo:</AlertDialogDescription>
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

      <AlertDialog open={showNoShowDialog} onOpenChange={setShowNoShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registar Falta</AlertDialogTitle>
            <AlertDialogDescription>O utente não compareceu à sessão.</AlertDialogDescription>
          </AlertDialogHeader>
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

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteSession}
        title="Apagar Sessão"
        description="A sessão será removida permanentemente."
        entityName={`${patientName} - ${format(new Date(session.start_time), "dd/MM HH:mm")}`}
        warnings={[]}
      />
    </>
  );
}
