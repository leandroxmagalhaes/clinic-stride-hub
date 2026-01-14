import { useState } from "react";
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
import { SessionService } from "@/services/SessionService";

// Components
import { AgendaControls } from "@/components/agenda/AgendaControls";
import { AgendaDesktopGrid } from "@/components/agenda/AgendaDesktopGrid";
import { AgendaMobileTimeline } from "@/components/agenda/AgendaMobileTimeline";
import { NewSessionModal } from "@/components/agenda/NewSessionModal";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 to 18:00

export default function Agenda() {
  const { sessions, addSession, patients, professionals, services } = useData();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  
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

  const handleSessionClick = (session: any) => {
    // Future: Open session details/edit modal
    toast.info(`Sessão: ${session.paciente?.full_name} - ${session.servico?.name}`);
  };

  const handleCreateSession = (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    notes: string;
  }) => {
    if (!selectedSlot) {
      toast.error("Selecione um horário");
      return;
    }

    try {
      // Create session using service (includes validation and conflict check)
      const newSession = SessionService.create(
        {
          pacienteId: data.pacienteId,
          profissionalId: data.profissionalId,
          servicoId: data.servicoId,
          date: selectedSlot.date,
          hour: selectedSlot.hour,
          notes: data.notes,
        },
        sessions
      );

      // Add to context (persists to localStorage)
      addSession(newSession);

      toast.success("Sessão agendada com sucesso!");
      setIsModalOpen(false);
      resetForm();
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
          />
        </div>

        {/* Desktop: Weekly/Daily Grid */}
        <AgendaDesktopGrid
          weekDays={weekDays}
          hours={HOURS}
          sessions={sessions}
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
        />

        {/* Mobile: Timeline View */}
        <AgendaMobileTimeline
          currentDate={currentDate}
          hours={HOURS}
          sessions={sessions}
          onSlotClick={handleSlotClick}
          onSessionClick={handleSessionClick}
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
      />
    </AppLayout>
  );
}
