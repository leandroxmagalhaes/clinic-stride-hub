import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  isSameDay,
  setHours,
  setMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { mockSessoes, mockPacientes, mockProfissionais, mockServicos } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 to 18:00

export default function Agenda() {
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

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlot({ date, hour });
    setIsModalOpen(true);
  };

  const handleCreateSession = () => {
    if (!selectedPaciente || !selectedProfissional || !selectedServico) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Check for conflicts
    const slotStart = setMinutes(setHours(selectedSlot!.date, selectedSlot!.hour), 0);
    const hasConflict = mockSessoes.some(
      (s) =>
        s.profissional_id === selectedProfissional &&
        isSameDay(s.start_time, slotStart) &&
        s.start_time.getHours() === slotStart.getHours()
    );

    if (hasConflict) {
      toast.error("Já existe um agendamento para este profissional neste horário");
      return;
    }

    toast.success("Sessão agendada com sucesso!");
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedPaciente("");
    setSelectedProfissional("");
    setSelectedServico("");
    setNotes("");
    setSelectedSlot(null);
  };

  const getSessionsForSlot = (date: Date, hour: number) => {
    return mockSessoes.filter(
      (s) => isSameDay(s.start_time, date) && s.start_time.getHours() === hour
    );
  };

  return (
    <AppLayout 
      title="Agenda" 
      subtitle="Gerencie os agendamentos da clínica"
      actions={
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Sessão
        </Button>
      }
    >
      <div className="space-y-4 animate-fade-in">
        {/* Calendar Controls */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={goToToday} className="text-primary">
                  Hoje
                </Button>
                <h2 className="font-display font-semibold text-lg ml-2">
                  {viewMode === 'week' 
                    ? `${format(weekStart, "d MMM", { locale: ptBR })} - ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: ptBR })}`
                    : format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
                  }
                </h2>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={viewMode === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                >
                  Dia
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card className="shadow-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <div className="min-w-[800px]">
                {/* Header */}
                <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}>
                  <div className="p-3 border-r" />
                  {weekDays.map((day, index) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={index}
                        className={cn(
                          "p-3 text-center border-r last:border-r-0",
                          isToday && "bg-primary/5"
                        )}
                      >
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: ptBR })}
                        </p>
                        <p className={cn(
                          "text-lg font-semibold mt-1",
                          isToday && "text-primary"
                        )}>
                          {format(day, "d")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Time Grid */}
                <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                  {HOURS.map((hour) => (
                    <div 
                      key={hour} 
                      className="grid border-b last:border-b-0"
                      style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}
                    >
                      <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r bg-muted/20">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      {weekDays.map((day, dayIndex) => {
                        const sessions = getSessionsForSlot(day, hour);
                        const isToday = isSameDay(day, new Date());
                        
                        return (
                          <div
                            key={dayIndex}
                            className={cn(
                              "min-h-[60px] p-1 border-r last:border-r-0 hover:bg-muted/30 cursor-pointer transition-colors",
                              isToday && "bg-primary/[0.02]"
                            )}
                            onClick={() => sessions.length === 0 && handleSlotClick(day, hour)}
                          >
                            {sessions.map((session) => (
                              <div
                                key={session.id}
                                className="p-2 rounded-md text-xs mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ 
                                  backgroundColor: `${session.servico?.color}15`,
                                  borderLeft: `3px solid ${session.servico?.color}`,
                                }}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <p className="font-medium truncate">
                                    {session.paciente?.full_name.split(' ')[0]}
                                  </p>
                                  <StatusBadge status={session.status as any} className="scale-90" />
                                </div>
                                <p className="text-muted-foreground truncate text-[10px]">
                                  {session.servico?.name} • {session.profissional?.full_name.split(' ')[0]}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Session Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Novo Agendamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedSlot && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">
                  {format(selectedSlot.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-muted-foreground">
                  {String(selectedSlot.hour).padStart(2, '0')}:00
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={selectedPaciente} onValueChange={setSelectedPaciente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {mockPacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Profissional *</Label>
              <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {mockProfissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Serviço *</Label>
              <Select value={selectedServico} onValueChange={setSelectedServico}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {mockServicos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name} ({s.duration_minutes}min)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre a sessão..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSession}>
              Agendar Sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
