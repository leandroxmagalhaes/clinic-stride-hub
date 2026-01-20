import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, CalendarIcon } from "lucide-react";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { CreditBalanceBadge } from "@/components/ui/credit-balance-badge";
import { ScheduleWarningAlert } from "@/components/agenda/ScheduleWarningAlert";
import { HealthTagService, HealthTag } from "@/services/HealthTagService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Patient {
  id: string;
  full_name: string;
  health_tags?: HealthTag[];
}

interface Professional {
  id: string;
  full_name: string;
}

interface Service {
  id: string;
  name: string;
  color: string;
  duration_minutes: number;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlot: { date: Date; hour: number } | null;
  patients: Patient[];
  professionals: Professional[];
  services: Service[];
  onSubmit: (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    notes: string;
    date?: Date;
    hour?: number;
  }) => void;
  selectedPaciente: string;
  setSelectedPaciente: (value: string) => void;
  selectedProfissional: string;
  setSelectedProfissional: (value: string) => void;
  selectedServico: string;
  setSelectedServico: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  getCreditBalance?: (patientId: string) => number;
}

// Generate hours array for time picker (7:00 to 18:00)
const AVAILABLE_HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

export function NewSessionModal({
  isOpen,
  onClose,
  selectedSlot,
  patients,
  professionals,
  services,
  onSubmit,
  selectedPaciente,
  setSelectedPaciente,
  selectedProfissional,
  setSelectedProfissional,
  selectedServico,
  setSelectedServico,
  notes,
  setNotes,
  getCreditBalance,
}: NewSessionModalProps) {
  // Local state for date/time when no slot is pre-selected
  const [manualDate, setManualDate] = useState<Date | undefined>(undefined);
  const [manualHour, setManualHour] = useState<string>("");

  // Reset manual selections when modal opens/closes or slot changes
  useEffect(() => {
    if (isOpen && selectedSlot) {
      // Slot was pre-selected (clicked on calendar)
      setManualDate(selectedSlot.date);
      setManualHour(String(selectedSlot.hour));
    } else if (isOpen && !selectedSlot) {
      // Opened from global button - reset
      setManualDate(undefined);
      setManualHour("");
    }
  }, [isOpen, selectedSlot]);

  // Determine if we're in "manual selection" mode (no pre-selected slot)
  const isManualMode = !selectedSlot;

  // Final date/time to use
  const finalDate = selectedSlot?.date ?? manualDate;
  const finalHour = selectedSlot?.hour ?? (manualHour ? parseInt(manualHour, 10) : undefined);

  const handleSubmit = () => {
    if (!finalDate || finalHour === undefined) {
      toast.error("Selecione data e horário");
      return;
    }

    onSubmit({
      pacienteId: selectedPaciente,
      profissionalId: selectedProfissional,
      servicoId: selectedServico,
      notes,
      date: finalDate,
      hour: finalHour,
    });
  };

  // Get selected patient data
  const selectedPatientData = useMemo(() => {
    return patients.find(p => p.id === selectedPaciente);
  }, [patients, selectedPaciente]);

  // Get health tags for selected patient
  const patientHealthTags = useMemo(() => {
    return HealthTagService.parseTags(selectedPatientData?.health_tags as string[] | undefined);
  }, [selectedPatientData]);

  // Get schedule warnings based on health tags and selected time
  const scheduleWarnings = useMemo(() => {
    if (finalHour === undefined || patientHealthTags.length === 0) return [];
    return HealthTagService.validateScheduling(patientHealthTags, finalHour);
  }, [patientHealthTags, finalHour]);

  // Show toast warnings for health tag conflicts
  useEffect(() => {
    if (scheduleWarnings.length > 0 && selectedPaciente && finalHour !== undefined) {
      scheduleWarnings.forEach(warning => {
        toast.warning(warning.message, {
          description: "Você pode prosseguir, mas considere a preferência do paciente.",
          duration: 5000,
        });
      });
    }
  }, [scheduleWarnings, selectedPaciente, finalHour]);

  // Get credit balance for selected patient
  const patientBalance = useMemo(() => {
    if (!selectedPaciente || !getCreditBalance) return null;
    return getCreditBalance(selectedPaciente);
  }, [selectedPaciente, getCreditBalance]);

  const hasInsufficientCredits = patientBalance !== null && patientBalance <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date/Time Selection - Always visible but editable only in manual mode */}
          {!isManualMode && finalDate && finalHour !== undefined ? (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium">
                {format(finalDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-muted-foreground">
                {String(finalHour).padStart(2, '0')}:00
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal min-h-[44px]",
                        !manualDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {manualDate ? format(manualDate, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={manualDate}
                      onSelect={setManualDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Picker */}
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Select value={manualHour} onValueChange={setManualHour}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_HOURS.map((hour) => (
                      <SelectItem key={hour} value={String(hour)} className="min-h-[44px]">
                        {String(hour).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Select value={selectedPaciente} onValueChange={setSelectedPaciente}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Patient info: Health Tags + Credit Balance */}
            {selectedPatientData && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {patientHealthTags.length > 0 && (
                  <HealthTagList tags={patientHealthTags} maxVisible={3} size="sm" />
                )}
                {patientBalance !== null && (
                  <CreditBalanceBadge balance={patientBalance} size="sm" />
                )}
              </div>
            )}
          </div>

          {/* Schedule Warnings */}
          {scheduleWarnings.length > 0 && (
            <ScheduleWarningAlert warnings={scheduleWarnings} />
          )}

          {/* Insufficient credits warning */}
          {hasInsufficientCredits && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              <p className="font-medium">⚠️ Créditos insuficientes</p>
              <p className="text-xs mt-1">Sessão será agendada com status "Pagamento Pendente".</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Profissional *</Label>
            <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Serviço *</Label>
            <Select value={selectedServico} onValueChange={setSelectedServico}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
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
              className="min-h-[88px]"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {hasInsufficientCredits ? "Agendar (Pendente)" : "Agendar Sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
