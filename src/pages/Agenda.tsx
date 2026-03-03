import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Lock, FileSpreadsheet } from "lucide-react";
import { startOfWeek, addDays, addWeeks, subWeeks, setHours, setMinutes, addMinutes } from "date-fns";
import { toast } from "sonner";
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

import { useData } from "@/contexts/DataContext";
import { SessionService, Session } from "@/services/SessionService";
import { Patient } from "@/services/PatientService";
import { checkAppointmentCreatedTrigger, AutomationTriggerResult } from "@/services/AutomationEngine";
import { CreditPurchaseData } from "@/components/patients/AddCreditsModal";
import { CreditService } from "@/services/CreditService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useReservedSlots } from "@/hooks/useReservedSlots";
import { CreateReservedSlotData, ReservedSlot, ReservedSlotService } from "@/services/ReservedSlotService";

import { AgendaControls } from "@/components/agenda/AgendaControls";
import { AgendaDesktopGrid } from "@/components/agenda/AgendaDesktopGrid";
import { AgendaMobileTimeline } from "@/components/agenda/AgendaMobileTimeline";
import { NewSessionModal } from "@/components/agenda/NewSessionModal";
import { NewReservedSlotModal } from "@/components/agenda/NewReservedSlotModal";
import { SessionManagementModal } from "@/components/agenda/SessionManagementModal";
import { ReservedSlotManagementModal } from "@/components/agenda/ReservedSlotManagementModal";
import { AutomationTriggerToast } from "@/components/agenda/AutomationTriggerToast";
import { BatchSchedulingModal } from "@/components/agenda/BatchSchedulingModal";

const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

interface AgendaPrefs {
  hourFilter: { start: number; end: number };
  viewMode: "week" | "day";
}

const PREFS_DEFAULT: AgendaPrefs = {
  hourFilter: { start: 7, end: 19 },
  viewMode: "week",
};

function loadPrefs(userId: string): AgendaPrefs {
  try {
    const raw = localStorage.getItem(`physione_agenda_prefs_${userId}`);
    if (!raw) return PREFS_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<AgendaPrefs>;
    return {
      hourFilter: parsed.hourFilter ?? PREFS_DEFAULT.hourFilter,
      viewMode: parsed.viewMode ?? PREFS_DEFAULT.viewMode,
    };
  } catch {
    return PREFS_DEFAULT;
  }
}

function savePrefs(userId: string, prefs: AgendaPrefs) {
  try {
    localStorage.setItem(`physione_agenda_prefs_${userId}`, JSON.stringify(prefs));
  } catch {}
}

// ── Dados pendentes quando há conflito ───────────────────────────────────────
interface PendingSessionData {
  pacienteId: string;
  profissionalId: string;
  servicoId: string;
  notes: string;
  date: Date;
  hour: number;
  minute: number;
  endHour?: number;
  endMinute?: number;
  price?: number;
  avulso?: boolean;
  packageData?: import("@/components/agenda/NewSessionModal").PackageSubmitData;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Agenda() {
  const {
    sessions,
    addSession,
    updateSession,
    deleteSession,
    patients,
    professionals,
    services,
    getCreditBalance,
    refundCredit,
    useCredit,
    wasCreditUsedForSession,
    addCredits,
    refreshCreditBalances,
    refreshSessions,
  } = useData();
  const { user } = useAuth();
  const {
    reservedSlots,
    createReservedSlot,
    updateReservedSlot,
    cancelReservedSlot,
    getOccurrencesForWeek,
    getOccurrencesForDate,
    isSlotReserved,
    fetchReservedSlots,
    isLoading: reservedSlotsLoading,
  } = useReservedSlots();

  const [clinicId, setClinicId] = useState<string | null>(null);
  const [isReservedSlotModalOpen, setIsReservedSlotModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservedSlot | null>(null);
  const [isReservationManageOpen, setIsReservationManageOpen] = useState(false);
  const [localPatients, setLocalPatients] = useState(patients);

  useEffect(() => {
    setLocalPatients(patients);
  }, [patients]);

  const [prefs, setPrefs] = useState<AgendaPrefs>(PREFS_DEFAULT);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    async function fetchClinicId() {
      if (!user) return;
      const { data, error } = await supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle();
      if (error) {
        console.error("Error fetching clinic_id:", error);
        return;
      }
      if (data?.clinic_id) setClinicId(data.clinic_id);
      const saved = loadPrefs(user.id);
      setPrefs(saved);
      setPrefsLoaded(true);
    }
    fetchClinicId();
  }, [user]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const viewMode = prefs.viewMode;
  const hourFilter = prefs.hourFilter;

  const setViewMode = (mode: "week" | "day") => {
    const next = { ...prefs, viewMode: mode };
    setPrefs(next);
    if (user) savePrefs(user.id, next);
  };

  const setHourFilter = (filter: { start: number; end: number }) => {
    const next = { ...prefs, hourFilter: filter };
    setPrefs(next);
    if (user) savePrefs(user.id, next);
  };

  const displayedHours = ALL_HOURS.filter((h) => h >= hourFilter.start && h <= hourFilter.end);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [automationTrigger, setAutomationTrigger] = useState<AutomationTriggerResult | null>(null);

  // ── Estado do popup de conflito ───────────────────────────────────────────
  const [conflictDialog, setConflictDialog] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const [pendingSession, setPendingSession] = useState<PendingSessionData | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [notes, setNotes] = useState("");

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: viewMode === "week" ? 7 : 1 }, (_, i) =>
    viewMode === "week" ? addDays(weekStart, i) : currentDate,
  );

  const goToPrevious = () =>
    viewMode === "week" ? setCurrentDate(subWeeks(currentDate, 1)) : setCurrentDate(addDays(currentDate, -1));
  const goToNext = () =>
    viewMode === "week" ? setCurrentDate(addWeeks(currentDate, 1)) : setCurrentDate(addDays(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());
  const goToPreviousMobile = () => setCurrentDate(addDays(currentDate, -1));
  const goToNextMobile = () => setCurrentDate(addDays(currentDate, 1));

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlot({ date, hour });
    setIsModalOpen(true);
  };
  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };
  const handleReservedSlotClick = (reservation: ReservedSlot) => {
    setSelectedReservation(reservation);
    setIsReservationManageOpen(true);
  };
  const handleReservationManageClose = () => {
    setIsReservationManageOpen(false);
    setSelectedReservation(null);
    fetchReservedSlots();
  };
  const handleSessionModalClose = () => {
    setIsSessionModalOpen(false);
    setSelectedSession(null);
  };

  const handleSessionReschedule = useCallback(
    async (sessionId: string, newDate: Date, newHour: number) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const result = SessionService.reschedule(session, newDate, newHour, sessions);
      if (result.success && result.updatedSession) {
        try {
          await updateSession(sessionId, {
            start_time: result.updatedSession.start_time,
            end_time: result.updatedSession.end_time,
          });
          toast.success("Sessão remarcada com sucesso!");
        } catch {
          toast.error("Erro ao guardar remarcação");
        }
      } else {
        toast.error(result.error || "Erro ao remarcar sessão");
      }
    },
    [sessions, updateSession],
  );

  // ── Função que efectivamente cria a sessão (após conflito resolvido) ──────
  const doCreateSession = async (data: PendingSessionData, skipConflict: boolean) => {
    const { date: finalDate, hour: finalHour, minute: finalMinute } = data;

    const selectedPatient = localPatients.find((p) => p.id === data.pacienteId);
    const selectedProfessional = professionals.find((p) => p.id === data.profissionalId);
    const selectedService = services.find((s) => s.id === data.servicoId);

    const balance = getCreditBalance(data.pacienteId);
    const serviceConsumesCredit = selectedService?.consumes_credit ?? true;
    const paymentStatus = serviceConsumesCredit && balance > 0 ? "reservado" : "pendente";

    // Pacote
    if (data.packageData && data.packageData.generatedDates.length > 0) {
      const { packageData } = data;
      const { getAuthContext } = await import("@/lib/auth-helpers");
      const { userId: currentUserId, clinicId: userClinicId } = await getAuthContext();

      const { data: pkg, error: pkgError } = await supabase
        .from("scheduling_packages")
        .insert({
          clinic_id: userClinicId,
          paciente_id: data.pacienteId,
          profissional_id: data.profissionalId,
          servico_id: data.servicoId,
          modality: packageData.modality,
          frequency: packageData.frequency || null,
          fixed_days: packageData.fixedDays,
          flexible: packageData.flexible,
          total_sessions: packageData.totalSessions,
          sessions_created: packageData.generatedDates.length,
          status: "ativo",
          start_date: finalDate.toISOString().split("T")[0],
          notes: data.notes || null,
          created_by: currentUserId,
        })
        .select("id")
        .single();

      if (pkgError) throw pkgError;

      const sessionInserts = packageData.generatedDates.map((gd) => {
        const startTime = new Date(gd.date);
        startTime.setHours(gd.hour, gd.minute, 0, 0);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + (selectedService?.duration_minutes || 60));
        return {
          clinic_id: userClinicId,
          paciente_id: data.pacienteId,
          profissional_id: data.profissionalId,
          servico_id: data.servicoId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: startTime < new Date() ? "realizado" : "agendado",
          notes: data.notes,
          price: selectedService ? Number(selectedService.price) : 0,
          payment_status: paymentStatus,
          package_id: pkg.id,
        };
      });

      const { error: batchError } = await supabase.from("sessoes").insert(sessionInserts);
      if (batchError) throw batchError;

      setIsModalOpen(false);
      resetForm();
      await refreshSessions();
      toast.success(`${packageData.generatedDates.length} sessões agendadas com sucesso!`);
      return;
    }

    // Sessão avulsa
    const newSession = SessionService.create(
      {
        pacienteId: data.pacienteId,
        profissionalId: data.profissionalId,
        servicoId: data.servicoId,
        date: finalDate,
        hour: finalHour,
        minute: finalMinute,
        endHour: data.endHour,
        endMinute: data.endMinute,
        notes: data.notes,
      },
      sessions,
      "clinic-id",
      {
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color || "#10B981",
          duration_minutes: s.duration_minutes,
          price: Number(s.price),
          consumes_credit: s.consumes_credit,
        })),
        patients: localPatients.map((p) => ({ id: p.id, full_name: p.full_name })),
        professionals: professionals.map((p) => ({ id: p.id, full_name: p.full_name })),
      },
      skipConflict, // ← passa flag
    );

    newSession.payment_status = paymentStatus;
    if (new Date(newSession.start_time) < new Date()) newSession.status = "realizado";
    // Aplica preço personalizado e flag avulso
    if (data.price !== undefined && data.price > 0) (newSession as any).price = data.price;
    if (data.avulso) (newSession as any).avulso = true;
    await addSession(newSession);

    setIsModalOpen(false);
    resetForm();

    const triggerResult = await checkAppointmentCreatedTrigger({
      patientName: selectedPatient?.full_name || "",
      patientPhone: selectedPatient?.phone || undefined,
      professionalName: selectedProfessional?.full_name || "",
      serviceName: selectedService?.name,
      date: finalDate,
      hour: finalHour,
    });

    if (triggerResult.shouldTrigger) {
      setAutomationTrigger(triggerResult);
    } else {
      toast.success(
        paymentStatus === "pendente" ? "Sessão agendada com pagamento pendente" : "Sessão agendada com sucesso!",
      );
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateSession = async (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    notes: string;
    date?: Date;
    hour?: number;
    minute?: number;
    endHour?: number;
    endMinute?: number;
    price?: number;
    avulso?: boolean;
    packageData?: import("@/components/agenda/NewSessionModal").PackageSubmitData;
  }) => {
    const finalDate = data.date || selectedSlot?.date;
    const finalHour = data.hour ?? selectedSlot?.hour;
    const finalMinute = data.minute ?? 0;

    if (!finalDate || finalHour === undefined) {
      toast.error("Selecione um horário");
      return;
    }

    const pending: PendingSessionData = {
      pacienteId: data.pacienteId,
      profissionalId: data.profissionalId,
      servicoId: data.servicoId,
      notes: data.notes,
      date: finalDate,
      hour: finalHour,
      minute: finalMinute,
      endHour: data.endHour,
      endMinute: data.endMinute,
      price: data.price,
      avulso: data.avulso,
      packageData: data.packageData,
    };

    // ── Verificar conflito ANTES de criar ─────────────────────────────────
    if (!data.packageData) {
      const selectedService = services.find((s) => s.id === data.servicoId);
      const durationMinutes = selectedService?.duration_minutes || 60;

      const conflict = SessionService.checkConflict(
        sessions,
        data.profissionalId,
        finalDate,
        finalHour,
        finalMinute,
        durationMinutes,
        data.endHour,
        data.endMinute,
      );

      if (conflict.hasConflict) {
        // Guarda dados pendentes e mostra popup
        setPendingSession(pending);
        setConflictMessage(conflict.message || "Conflito de horário detectado.");
        setConflictDialog(true);
        return; // não prossegue — aguarda decisão do utilizador
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    try {
      await doCreateSession(pending, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao agendar sessão");
    }
  };

  // ── Utilizador decide ignorar conflito e agendar na mesma ────────────────
  const handleIgnoreConflict = async () => {
    setConflictDialog(false);
    if (!pendingSession) return;
    try {
      await doCreateSession(pendingSession, true); // skipConflict = true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao agendar sessão");
    } finally {
      setPendingSession(null);
    }
  };

  const handleCancelConflict = () => {
    setConflictDialog(false);
    setPendingSession(null);
    // Modal de agendamento fica aberto para o utilizador ajustar
  };
  // ─────────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedPaciente("");
    setSelectedProfissional("");
    setSelectedServico("");
    setNotes("");
    setSelectedSlot(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleAddCredits = async (patientId: string, data: CreditPurchaseData) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
      const msg = `patient_id inválido: ${patientId}`;
      toast.error(msg);
      throw new Error(msg);
    }
    if (!clinicId) {
      const msg = "Clínica não identificada. Faça login novamente.";
      toast.error(msg);
      throw new Error(msg);
    }
    const result = await CreditService.purchaseCredits(clinicId, patientId, data.amount, {
      description: data.description,
      monetaryValue: data.monetaryValue,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
    });
    if (!result.success) {
      const msg = result.error || "Erro ao adicionar créditos";
      toast.error(msg);
      throw new Error(msg);
    }
    await addCredits(patientId, data.amount);
    await refreshCreditBalances();
  };

  const handleDuplicateSession = async (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    date: Date;
    hour: number;
    minute: number;
    notes: string;
  }) => {
    await handleCreateSession({ ...data });
  };

  const handleCreateReservedSlot = async (data: CreateReservedSlotData) => {
    await createReservedSlot(data);
  };

  if (!prefsLoaded) return null;

  return (
    <AppLayout
      title="Agenda"
      subtitle="Gerencie os agendamentos da clínica"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBatchModalOpen(true)} className="gap-2 min-h-[44px]">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Lote</span>
          </Button>
          <Button variant="outline" onClick={() => setIsReservedSlotModalOpen(true)} className="gap-2 min-h-[44px]">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Reservar</span>
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 min-h-[44px]">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Sessão</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4 animate-fade-in">
        <div className="hidden md:block">
          <AgendaControls
            currentDate={currentDate}
            viewMode={viewMode}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onToday={goToToday}
            onViewModeChange={setViewMode}
            hourFilter={hourFilter}
            onHourFilterChange={setHourFilter}
          />
        </div>
        <div className="md:hidden">
          <AgendaControls
            currentDate={currentDate}
            viewMode="day"
            onPrevious={goToPreviousMobile}
            onNext={goToNextMobile}
            onToday={goToToday}
            onViewModeChange={() => {}}
            hourFilter={hourFilter}
            onHourFilterChange={setHourFilter}
          />
        </div>

        <AgendaDesktopGrid
          weekDays={weekDays}
          hours={displayedHours}
          sessions={sessions}
          reservedSlotOccurrences={getOccurrencesForWeek(weekStart)}
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
          onSessionReschedule={handleSessionReschedule}
          onReservedSlotClick={handleReservedSlotClick}
          getCreditBalance={getCreditBalance}
        />
        <AgendaMobileTimeline
          currentDate={currentDate}
          hours={displayedHours}
          sessions={sessions}
          reservedSlotOccurrences={getOccurrencesForDate(currentDate)}
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
          onReservedSlotClick={handleReservedSlotClick}
          getCreditBalance={getCreditBalance}
        />
      </div>

      <NewSessionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        selectedSlot={selectedSlot}
        patients={localPatients}
        professionals={professionals}
        services={services}
        onSubmit={handleCreateSession}
        selectedPaciente={selectedPaciente}
        setSelectedPaciente={setSelectedPaciente}
        selectedProfissional={selectedProfissional}
        setSelectedProfissional={setSelectedProfissional}
        selectedServico={selectedServico}
        setSelectedServico={setSelectedServico}
        notes={notes}
        setNotes={setNotes}
        getCreditBalance={getCreditBalance}
        onPatientCreated={(newPatient) => {
          setLocalPatients((prev) =>
            [...prev, newPatient as any].sort((a, b) => a.full_name.localeCompare(b.full_name)),
          );
        }}
      />

      {clinicId && (
        <NewReservedSlotModal
          isOpen={isReservedSlotModalOpen}
          onClose={() => setIsReservedSlotModalOpen(false)}
          patients={patients}
          professionals={professionals}
          services={services}
          clinicId={clinicId}
          onSubmit={handleCreateReservedSlot}
        />
      )}

      <SessionManagementModal
        isOpen={isSessionModalOpen}
        onClose={handleSessionModalClose}
        session={selectedSession}
        sessions={sessions}
        getCreditBalance={getCreditBalance}
        onUpdateSession={updateSession}
        onDeleteSession={deleteSession}
        onRefundCredit={refundCredit}
        onUseCredit={useCredit}
        wasCreditUsedForSession={wasCreditUsedForSession}
        onAddCredits={handleAddCredits}
        onDuplicateSession={handleDuplicateSession}
      />

      <ReservedSlotManagementModal
        isOpen={isReservationManageOpen}
        onClose={handleReservationManageClose}
        reservation={selectedReservation}
        onUpdate={updateReservedSlot}
        onCancel={cancelReservedSlot}
        onDelete={async (id) => {
          await ReservedSlotService.delete(id);
        }}
        onPause={async (id) => {
          await ReservedSlotService.pause(id);
        }}
        onActivate={async (id) => {
          await ReservedSlotService.activate(id);
        }}
      />

      <AutomationTriggerToast triggerResult={automationTrigger} onDismiss={() => setAutomationTrigger(null)} />

      {clinicId && (
        <BatchSchedulingModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          patients={patients}
          professionals={professionals}
          services={services}
          clinicId={clinicId}
          onSessionsCreated={refreshSessions}
        />
      )}

      {/* ── Popup de conflito de horário ─────────────────────────────────── */}
      <AlertDialog open={conflictDialog} onOpenChange={setConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">⚠️ Conflito de Horário</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{conflictMessage}</span>
              <span className="block text-sm text-muted-foreground">
                Pode ignorar e agendar na mesma, ou voltar para ajustar o horário.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelConflict} className="w-full sm:w-auto">
              Verificar horário
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleIgnoreConflict}
              className="w-full sm:w-auto bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Ignorar e Agendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ─────────────────────────────────────────────────────────────────── */}
    </AppLayout>
  );
}
