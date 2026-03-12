import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Lock, FileSpreadsheet } from "lucide-react";
import { startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { toast } from "sonner";

import { useData } from "@/contexts/DataContext";
import { SessionService, Session } from "@/services/SessionService";
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
          <Button onClick={() => { setSelectedSlot(null); setIsModalOpen(true); }} className="gap-2 min-h-[44px]">
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
    </AppLayout>
  );
}
