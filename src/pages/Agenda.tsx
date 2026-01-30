import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

// Components
import { AgendaControls } from "@/components/agenda/AgendaControls";
import { AgendaDesktopGrid } from "@/components/agenda/AgendaDesktopGrid";
import { AgendaMobileTimeline } from "@/components/agenda/AgendaMobileTimeline";
import { NewSessionModal } from "@/components/agenda/NewSessionModal";
import { SessionManagementModal } from "@/components/agenda/SessionManagementModal";
import { AutomationTriggerToast } from "@/components/agenda/AutomationTriggerToast";

// Full range of available hours (06:00 to 23:00)
const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export default function Agenda() {
  const { sessions, addSession, updateSession, deleteSession, patients, professionals, services, getCreditBalance, refundCredit, useCredit, wasCreditUsedForSession } = useData();
  
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
      // Get lookup data for session creation
      const selectedPatient = patients.find(p => p.id === data.pacienteId);
      const selectedProfessional = professionals.find(p => p.id === data.profissionalId);
      const selectedService = services.find(s => s.id === data.servicoId);

      // Determine payment_status BEFORE creating session (no credit consumption on scheduling)
      const balance = getCreditBalance(data.pacienteId);
      const serviceConsumesCredit = selectedService?.consumes_credit ?? true;
      // If service consumes credit and patient has credits, mark as "reservado"
      // Otherwise mark as "pendente"
      const paymentStatus = (serviceConsumesCredit && balance > 0) ? "reservado" : "pendente";

      // Create session using service (includes validation and conflict check)
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
        'clinic-id', // Will be set properly by backend
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

      // Set the payment_status before insert (NO credit deduction on scheduling)
      newSession.payment_status = paymentStatus;

      // Add to context (persists to Supabase database)
      await addSession(newSession);

      setIsModalOpen(false);
      resetForm();

      // Check for automation triggers AFTER successful session creation
      const triggerResult = await checkAppointmentCreatedTrigger({
        patientName: selectedPatient?.full_name || '',
        patientPhone: selectedPatient?.phone || undefined,
        professionalName: selectedProfessional?.full_name || '',
        serviceName: selectedService?.name,
        date: finalDate,
        hour: finalHour,
      });

      if (triggerResult.shouldTrigger) {
        // Show automation prompt
        setAutomationTrigger(triggerResult);
      } else {
        // Show success toast
        toast.success(
          paymentStatus === "pendente"
            ? "Sessão agendada com pagamento pendente"
            : "Sessão agendada com sucesso!"
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao agendar sessão");
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

  return (
    <AppLayout 
      title="Agenda" 
      subtitle="Gerencie os agendamentos da clínica"
      actions={
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 min-h-[44px]">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Sessão</span>
          <span className="sm:hidden">Novo</span>
        </Button>
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
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
          onSessionReschedule={handleSessionReschedule}
          getCreditBalance={getCreditBalance}
        />

        {/* Mobile: Timeline View */}
        <AgendaMobileTimeline
          currentDate={currentDate}
          hours={displayedHours}
          sessions={sessions}
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
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
      />

      {/* Automation Trigger Toast/Modal */}
      <AutomationTriggerToast
        triggerResult={automationTrigger}
        onDismiss={() => setAutomationTrigger(null)}
      />
    </AppLayout>
  );
}
