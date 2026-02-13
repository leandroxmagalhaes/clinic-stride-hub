import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Lock } from "lucide-react";
import { 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
} from "date-fns";
import { toast } from "sonner";

// Services and Context (SRP Architecture)
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

// Components
import { AgendaControls } from "@/components/agenda/AgendaControls";
import { AgendaDesktopGrid } from "@/components/agenda/AgendaDesktopGrid";
import { AgendaMobileTimeline } from "@/components/agenda/AgendaMobileTimeline";
import { NewSessionModal } from "@/components/agenda/NewSessionModal";
import { NewReservedSlotModal } from "@/components/agenda/NewReservedSlotModal";
import { SessionManagementModal } from "@/components/agenda/SessionManagementModal";
import { ReservedSlotManagementModal } from "@/components/agenda/ReservedSlotManagementModal";
import { AutomationTriggerToast } from "@/components/agenda/AutomationTriggerToast";
import { AgendaSkeleton } from "@/components/skeletons/PageSkeletons";

// Full range of available hours (06:00 to 23:00)
const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export default function Agenda() {
  const { sessions, addSession, updateSession, deleteSession, patients, professionals, services, getCreditBalance, refundCredit, useCredit, wasCreditUsedForSession, addCredits, refreshCreditBalances, refreshSessions, isLoading } = useData();
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
    isLoading: reservedSlotsLoading 
  } = useReservedSlots();
  
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [isReservedSlotModalOpen, setIsReservedSlotModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservedSlot | null>(null);
  const [isReservationManageOpen, setIsReservationManageOpen] = useState(false);
  
  // Fetch clinic_id for the current user
  useEffect(() => {
    async function fetchClinicId() {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching clinic_id:", error);
        return;
      }

      if (data?.clinic_id) {
        setClinicId(data.clinic_id);
      }
    }
    fetchClinicId();
  }, [user]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  
  // Hour filter for visualization (default: 07:00 to 19:00)
  const [hourFilter, setHourFilter] = useState({ start: 7, end: 19 });
  const displayedHours = ALL_HOURS.filter(h => h >= hourFilter.start && h <= hourFilter.end);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  
  // Automation trigger state
  const [automationTrigger, setAutomationTrigger] = useState<AutomationTriggerResult | null>(null);
  
  // Form state
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [notes, setNotes] = useState("");

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: viewMode === 'week' ? 7 : 1 }, (_, i) => 
    viewMode === 'week' ? addDays(weekStart, i) : currentDate
  );

  const goToPrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Mobile always navigates by day
  const goToPreviousMobile = () => {
    setCurrentDate(addDays(currentDate, -1));
  };

  const goToNextMobile = () => {
    setCurrentDate(addDays(currentDate, 1));
  };

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
    fetchReservedSlots(); // Refresh after changes
  };

  const handleSessionModalClose = () => {
    setIsSessionModalOpen(false);
    setSelectedSession(null);
  };

  const handleSessionReschedule = useCallback(async (sessionId: string, newDate: Date, newHour: number) => {
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
      } catch (error) {
        toast.error("Erro ao guardar remarcação");
      }
    } else {
      toast.error(result.error || "Erro ao remarcar sessão");
    }
  }, [sessions, updateSession]);

  const handleCreateSession = async (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    notes: string;
    date?: Date;
    hour?: number;
    minute?: number;
    packageData?: import("@/components/agenda/NewSessionModal").PackageSubmitData;
  }) => {
    // Use provided date/hour or fall back to selectedSlot
    const finalDate = data.date || selectedSlot?.date;
    const finalHour = data.hour ?? selectedSlot?.hour;
    const finalMinute = data.minute ?? 0;

    if (!finalDate || finalHour === undefined) {
      toast.error("Selecione um horário");
      return;
    }

    try {
      const selectedPatient = patients.find(p => p.id === data.pacienteId);
      const selectedProfessional = professionals.find(p => p.id === data.profissionalId);
      const selectedService = services.find(s => s.id === data.servicoId);

      const balance = getCreditBalance(data.pacienteId);
      const serviceConsumesCredit = selectedService?.consumes_credit ?? true;
      const paymentStatus = (serviceConsumesCredit && balance > 0) ? "reservado" : "pendente";

      // ── Package / Recurring mode ──
      if (data.packageData && data.packageData.generatedDates.length > 0) {
        const { packageData } = data;

        // 1. Create scheduling_packages record
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Não autenticado");
        const { data: profile } = await supabase
          .from("profiles")
          .select("clinic_id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (!profile?.clinic_id) throw new Error("Clínica não encontrada");

        const { data: pkg, error: pkgError } = await supabase
          .from("scheduling_packages")
          .insert({
            clinic_id: profile.clinic_id,
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
            created_by: userData.user.id,
          })
          .select("id")
          .single();

        if (pkgError) throw pkgError;

        // 2. Create all sessions in batch
        const sessionInserts = packageData.generatedDates.map((gd) => {
          const startTime = new Date(gd.date);
          startTime.setHours(gd.hour, gd.minute, 0, 0);
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + (selectedService?.duration_minutes || 60));

          const isRetroactive = startTime < new Date();
          return {
            clinic_id: profile.clinic_id,
            paciente_id: data.pacienteId,
            profissional_id: data.profissionalId,
            servico_id: data.servicoId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: isRetroactive ? "realizado" : "agendado",
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

      // ── Single session mode (avulso) ──
      const newSession = SessionService.create(
        {
          pacienteId: data.pacienteId,
          profissionalId: data.profissionalId,
          servicoId: data.servicoId,
          date: finalDate,
          hour: finalHour,
          minute: finalMinute,
          notes: data.notes,
        },
        sessions,
        'clinic-id',
        {
          services: services.map(s => ({
            id: s.id,
            name: s.name,
            color: s.color || '#10B981',
            duration_minutes: s.duration_minutes,
            price: Number(s.price),
            consumes_credit: s.consumes_credit,
          })),
          patients: patients.map(p => ({ id: p.id, full_name: p.full_name })),
          professionals: professionals.map(p => ({ id: p.id, full_name: p.full_name })),
        }
      );

      newSession.payment_status = paymentStatus;
      // Mark retroactive sessions as "realizado"
      const sessionStart = new Date(newSession.start_time);
      if (sessionStart < new Date()) {
        newSession.status = "realizado";
      }
      await addSession(newSession);

      setIsModalOpen(false);
      resetForm();

      const triggerResult = await checkAppointmentCreatedTrigger({
        patientName: selectedPatient?.full_name || '',
        patientPhone: selectedPatient?.phone || undefined,
        professionalName: selectedProfessional?.full_name || '',
        serviceName: selectedService?.name,
        date: finalDate,
        hour: finalHour,
      });

      if (triggerResult.shouldTrigger) {
        setAutomationTrigger(triggerResult);
      } else {
        toast.success(
          paymentStatus === "pendente"
            ? "Sessão agendada com pagamento pendente"
            : "Sessão agendada com sucesso!"
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : (error as any)?.message || "Erro ao agendar sessão";
      toast.error(msg);
    }
  };

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

  // Add credits from session modal
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

    // Update local state for immediate UI feedback
    await addCredits(patientId, data.amount);
    await refreshCreditBalances();
  };

  // Show skeleton while loading
  if (isLoading) {
    return (
      <AppLayout 
        title="Agenda" 
        subtitle="Gerencie os agendamentos da clínica"
        actions={
          <Button disabled className="gap-2 min-h-[44px]">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Sessão</span>
          </Button>
        }
      >
        <AgendaSkeleton />
      </AppLayout>
    );
  }

  // Handle create reserved slot
  const handleCreateReservedSlot = async (data: CreateReservedSlotData) => {
    await createReservedSlot(data);
  };

  return (
    <AppLayout 
      title="Agenda" 
      subtitle="Gerencie os agendamentos da clínica"
      actions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsReservedSlotModalOpen(true)} 
            className="gap-2 min-h-[44px]"
          >
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
        {/* Desktop Controls */}
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

        {/* Mobile Controls - simplified, always day navigation */}
        <div className="md:hidden">
          <AgendaControls
            currentDate={currentDate}
            viewMode="day"
            onPrevious={goToPreviousMobile}
            onNext={goToNextMobile}
            onToday={goToToday}
            onViewModeChange={() => {}} // No-op on mobile
            hourFilter={hourFilter}
            onHourFilterChange={setHourFilter}
          />
        </div>

        {/* Desktop: Weekly/Daily Grid */}
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

        {/* Mobile: Timeline View */}
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

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        selectedSlot={selectedSlot}
        patients={patients}
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
      />

      {/* New Reserved Slot Modal */}
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

      {/* Session Management Modal */}
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
      />

      {/* Reserved Slot Management Modal */}
      <ReservedSlotManagementModal
        isOpen={isReservationManageOpen}
        onClose={handleReservationManageClose}
        reservation={selectedReservation}
        onUpdate={updateReservedSlot}
        onCancel={cancelReservedSlot}
        onDelete={async (id) => { await ReservedSlotService.delete(id); }}
        onPause={async (id) => { await ReservedSlotService.pause(id); }}
        onActivate={async (id) => { await ReservedSlotService.activate(id); }}
      />

      {/* Automation Trigger Toast/Modal */}
      <AutomationTriggerToast
        triggerResult={automationTrigger}
        onDismiss={() => setAutomationTrigger(null)}
      />
    </AppLayout>
  );
}
