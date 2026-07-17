import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Lock, FileSpreadsheet, Search } from "lucide-react";
import { startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { toast } from "sonner";
import { useClinicInfo } from "@/hooks/useClinicInfo";

import { useData } from "@/contexts/DataContext";
import { SessionService, Session } from "@/services/SessionService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useReservedSlots } from "@/hooks/useReservedSlots";
import { CreateReservedSlotData, ReservedSlot, ReservedSlotService } from "@/services/ReservedSlotService";
import { QuickPanel } from "@/components/agenda/quick-panel/QuickPanel";
import { useQuickPanelData } from "@/hooks/useQuickPanelData";
import { useFixedClients } from "@/hooks/useFixedClients";
import { AgendaControls } from "@/components/agenda/AgendaControls";
import { AgendaDesktopGrid } from "@/components/agenda/AgendaDesktopGrid";
import { AgendaMobileTimeline } from "@/components/agenda/AgendaMobileTimeline";
import { NewSessionModal } from "@/components/agenda/NewSessionModal";
import { NewReservedSlotModal } from "@/components/agenda/NewReservedSlotModal";
import { SessionManagementModal } from "@/components/agenda/SessionManagementModal";
import { ReservedSlotManagementModal } from "@/components/agenda/ReservedSlotManagementModal";
import { BatchSchedulingModal } from "@/components/agenda/BatchSchedulingModal";
import { AgendaSearchPanel } from "@/components/agenda/AgendaSearchPanel";
import { PaymentModal } from "@/components/PaymentModal";

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

export default function Agenda() {
  const { sessions, updateSession, deleteSession, patients, professionals, services, refreshSessions } = useData();
  const { user } = useAuth();
  const {
    createReservedSlot,
    updateReservedSlot,
    cancelReservedSlot,
    getOccurrencesForWeek,
    getOccurrencesForDate,
    fetchReservedSlots,
  } = useReservedSlots();

  const [clinicId, setClinicId] = useState<string | null>(null);
  const [isReservedSlotModalOpen, setIsReservedSlotModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: clinicInfo } = useClinicInfo();
  const [selectedReservation, setSelectedReservation] = useState<ReservedSlot | null>(null);
  const [isReservationManageOpen, setIsReservationManageOpen] = useState(false);
  const [localPatients, setLocalPatients] = useState(patients);
  const [paymentModal, setPaymentModal] = useState<{ sessionId: string; patientId: string; patientName?: string; amount: number; phone?: string } | null>(null);

  // Listener global para abrir PaymentModal a partir do badge "Pendente"
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.sessionId) return;
      const sess = sessions.find((s) => s.id === d.sessionId);
      const amount =
        d.amount ||
        (sess as any)?.price ||
        (sess as any)?.servico?.price ||
        0;
      const patient = patients.find((p) => p.id === (d.patientId || sess?.paciente_id));
      setPaymentModal({
        sessionId: d.sessionId,
        patientId: patient?.id || d.patientId || sess?.paciente_id,
        patientName: d.patientName || patient?.full_name,
        amount: Number(amount) || 0,
        phone: patient?.phone || undefined,
      });
    };
    window.addEventListener("open-payment-modal", handler);
    return () => window.removeEventListener("open-payment-modal", handler);
  }, [sessions, patients]);

  // Quick Panel state
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const {
    waitingPatients,
    quickNotes,
    addPatient,
    editPatient,
    removePatient,
    addNote,
    editNote,
    removeNote,
    toggleNote,
  } = useQuickPanelData(clinicId, quickPanelOpen);

  const {
    fixedClients,
    fixedClientSessions,
    totalMissingSessions,
    fetchFixedClients,
    addFixedClient,
    editFixedClient,
    removeFixedClient,
  } = useFixedClients(clinicId);

  // Fetch fixed clients when panel opens
  useEffect(() => {
    if (quickPanelOpen && clinicId) fetchFixedClients();
  }, [quickPanelOpen, clinicId, fetchFixedClients]);

  // Initial fetch
  useEffect(() => {
    if (clinicId) fetchFixedClients();
  }, [clinicId, fetchFixedClients]);

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

  const handleDuplicateSession = async (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    date: Date;
    hour: number;
    minute: number;
    notes: string;
  }) => {
    // Open the wizard with pre-selected slot for duplicate
    setSelectedSlot({ date: data.date, hour: data.hour });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSlot(null);
  };

  const handleCreateReservedSlot = async (data: CreateReservedSlotData) => {
    await createReservedSlot(data);
  };

  if (!prefsLoaded) return null;

  return (
    <div className="relative -mt-2 lg:-mt-4" style={{ marginRight: quickPanelOpen ? 380 : 0, transition: "margin-right 0.3s ease" }}>

    <AppLayout
      title="Agenda"
      subtitle="Gerencie os agendamentos da clínica"
      actions={
        <div className="flex gap-2 items-center">
          <div className="relative hidden md:block">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Pesquisar..."
              className="pl-8 h-10 w-[200px] lg:w-[240px]"
            />
          </div>
          <Button variant="outline" size="icon" className="md:hidden h-10 w-10" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setIsBatchModalOpen(true)} className="gap-2 min-h-[44px]">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Lote</span>
          </Button>
          <Button variant="outline" onClick={() => setIsReservedSlotModalOpen(true)} className="gap-2 min-h-[44px]">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Reservar</span>
          </Button>
          <Button onClick={() => { setSelectedSlot(null); setIsModalOpen(true); }} className="gap-2 min-h-[44px]">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Sessão</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-1 animate-fade-in pt-2">
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
        />
        <AgendaMobileTimeline
          currentDate={currentDate}
          hours={displayedHours}
          sessions={sessions}
          reservedSlotOccurrences={getOccurrencesForDate(currentDate)}
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
          onReservedSlotClick={handleReservedSlotClick}
        />
      </div>

      <NewSessionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        selectedSlot={selectedSlot}
        patients={localPatients}
        professionals={professionals}
        services={services}
        onPatientCreated={(newPatient) => {
          setLocalPatients((prev) =>
            [...prev, newPatient as any].sort((a, b) => a.full_name.localeCompare(b.full_name)),
          );
        }}
        onSessionsCreated={refreshSessions}
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
        onUpdateSession={updateSession}
        onDeleteSession={deleteSession}
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

      <AgendaSearchPanel
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={searchQuery}
        sessions={sessions}
        professionals={professionals.map((p) => ({ id: p.id, full_name: p.full_name }))}
        services={services.map((s) => ({ id: s.id, name: s.name, color: (s as any).color }))}
        clinicName={clinicInfo?.name ?? "Agenda"}
        onEditSession={(s) => { setSelectedSession(s); setIsSessionModalOpen(true); }}
        onDuplicateSession={(s) => {
          setSelectedSlot({ date: new Date(s.start_time), hour: new Date(s.start_time).getHours() });
          setIsModalOpen(true);
        }}
        onDeleteSession={async (id) => { await deleteSession(id); }}
        onUpdateStatus={async (id, status) => {
          await updateSession(id, { status } as any);
          toast.success("Status atualizado");
        }}
        onGoToDate={(d) => { setCurrentDate(d); }}
      />

      <PaymentModal
        isOpen={!!paymentModal}
        onClose={() => setPaymentModal(null)}
        sessionId={paymentModal?.sessionId || null}
        patientId={paymentModal?.patientId || null}
        patientName={paymentModal?.patientName}
        patientPhone={paymentModal?.phone}
        amount={paymentModal?.amount || 0}
        onPaid={refreshSessions}
      />
    </AppLayout>

      <QuickPanel
        isOpen={quickPanelOpen}
        onToggle={() => setQuickPanelOpen((v) => !v)}
        patients={waitingPatients}
        notes={quickNotes}
        onAddPatient={addPatient}
        onEditPatient={editPatient}
        onRemovePatient={removePatient}
        onAddNote={addNote}
        onEditNote={editNote}
        onRemoveNote={removeNote}
        onToggleNote={toggleNote}
        fixedClients={fixedClients}
        fixedClientSessions={fixedClientSessions}
        totalMissingSessions={totalMissingSessions}
        onAddFixedClient={addFixedClient}
        onEditFixedClient={editFixedClient}
        onRemoveFixedClient={removeFixedClient}
        onScheduleFixedClient={(patientId) => {
          const patient = patients.find(p => p.id === patientId);
          if (patient) {
            setSelectedSlot(null);
            setIsModalOpen(true);
          }
        }}
        allPatients={patients.map(p => ({ id: p.id, full_name: p.full_name }))}
      />
    </div>
  );
}
