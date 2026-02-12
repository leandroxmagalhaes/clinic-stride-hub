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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { CreditBalanceBadge } from "@/components/ui/credit-balance-badge";
import { ScheduleWarningAlert } from "@/components/agenda/ScheduleWarningAlert";
import { ModalityFields } from "@/components/agenda/ModalityFields";
import { PackageSchedulePreview } from "@/components/agenda/PackageSchedulePreview";
import { HealthTagService, HealthTag } from "@/services/HealthTagService";
import {
  PackageSchedulingService,
  SchedulingModality,
  SchedulingFrequency,
  GeneratedDate,
} from "@/services/PackageSchedulingService";
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

export interface PackageSubmitData {
  modality: SchedulingModality;
  frequency?: SchedulingFrequency;
  fixedDays: number[];
  flexible: boolean;
  totalSessions: number;
  generatedDates: GeneratedDate[];
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlot: { date: Date; hour: number; minute?: number } | null;
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
    minute?: number;
    packageData?: PackageSubmitData;
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

// Full range of available hours (06:00 to 23:00)
const AVAILABLE_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const AVAILABLE_MINUTES = [0, 15, 30, 45];

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
  const [manualDate, setManualDate] = useState<Date | undefined>(undefined);
  const [manualHour, setManualHour] = useState<string>("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [manualMinute, setManualMinute] = useState<string>("0");

  // Package/modality state
  const [modality, setModality] = useState<SchedulingModality>("avulso");
  const [frequency, setFrequency] = useState<SchedulingFrequency>("semanal");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [flexible, setFlexible] = useState(false);
  const [totalSessions, setTotalSessions] = useState(4);
  const [customSessionCount, setCustomSessionCount] = useState("");

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen && selectedSlot) {
      setManualDate(selectedSlot.date);
      setManualHour(String(selectedSlot.hour));
      setManualMinute(String(selectedSlot.minute ?? 0));
    } else if (isOpen && !selectedSlot) {
      setManualDate(undefined);
      setManualHour("");
      setManualMinute("0");
    }
    if (isOpen) {
      setModality("avulso");
      setFrequency("semanal");
      setSelectedDays([]);
      setFlexible(false);
      setTotalSessions(4);
      setCustomSessionCount("");
    }
  }, [isOpen, selectedSlot]);

  const isManualMode = !selectedSlot;
  const finalDate = selectedSlot?.date ?? manualDate;
  const finalHour = selectedSlot?.hour ?? (manualHour ? parseInt(manualHour, 10) : undefined);
  const finalMinute = selectedSlot?.minute ?? parseInt(manualMinute, 10);

  const isPackageMode = modality !== "avulso";

  // Generate preview dates for packages
  const generatedDates = useMemo(() => {
    if (!isPackageMode || !finalDate || finalHour === undefined || selectedDays.length === 0) {
      return [];
    }
    return PackageSchedulingService.generateDates({
      modality,
      frequency,
      fixedDays: selectedDays,
      flexible,
      totalSessions: modality === "recorrente" ? 12 : totalSessions, // recorrente generates 12 by default
      startDate: finalDate,
      hour: finalHour,
      minute: finalMinute,
    });
  }, [isPackageMode, modality, frequency, selectedDays, flexible, totalSessions, finalDate, finalHour, finalMinute]);

  const handleSubmit = () => {
    if (!finalDate || finalHour === undefined) {
      toast.error("Selecione data e horário");
      return;
    }
    if (isPackageMode && selectedDays.length === 0) {
      toast.error("Selecione pelo menos um dia da semana");
      return;
    }

    onSubmit({
      pacienteId: selectedPaciente,
      profissionalId: selectedProfissional,
      servicoId: selectedServico,
      notes,
      date: finalDate,
      hour: finalHour,
      minute: finalMinute,
      packageData: isPackageMode
        ? {
            modality,
            frequency,
            fixedDays: selectedDays,
            flexible,
            totalSessions: modality === "recorrente" ? generatedDates.length : totalSessions,
            generatedDates,
          }
        : undefined,
    });
  };

  // Patient data
  const selectedPatientData = useMemo(() => patients.find(p => p.id === selectedPaciente), [patients, selectedPaciente]);
  const patientHealthTags = useMemo(() => HealthTagService.parseTags(selectedPatientData?.health_tags as string[] | undefined), [selectedPatientData]);
  const scheduleWarnings = useMemo(() => {
    if (finalHour === undefined || patientHealthTags.length === 0) return [];
    return HealthTagService.validateScheduling(patientHealthTags, finalHour);
  }, [patientHealthTags, finalHour]);

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

  const patientBalance = useMemo(() => {
    if (!selectedPaciente || !getCreditBalance) return null;
    return getCreditBalance(selectedPaciente);
  }, [selectedPaciente, getCreditBalance]);

  const hasInsufficientCredits = patientBalance !== null && patientBalance <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Modality Selector */}
          <ModalityFields
            modality={modality}
            setModality={setModality}
            frequency={frequency}
            setFrequency={setFrequency}
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            flexible={flexible}
            setFlexible={setFlexible}
            totalSessions={totalSessions}
            setTotalSessions={setTotalSessions}
            customSessionCount={customSessionCount}
            setCustomSessionCount={setCustomSessionCount}
          />

          {/* Date/Time Selection */}
          {!isManualMode && finalDate && finalHour !== undefined ? (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium">
                {format(finalDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-muted-foreground">
                {String(finalHour).padStart(2, '0')}:{String(finalMinute).padStart(2, '0')}
              </p>
              {isPackageMode && (
                <p className="text-xs text-muted-foreground mt-1">Data de início do pacote</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{isPackageMode ? "Data de início *" : "Data *"}</Label>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hora *</Label>
                  <Select value={manualHour} onValueChange={setManualHour}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_HOURS.map((hour) => (
                        <SelectItem key={hour} value={String(hour)} className="min-h-[44px]">
                          {String(hour).padStart(2, '0')}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Minutos</Label>
                  <Select value={manualMinute} onValueChange={setManualMinute}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MINUTES.map((minute) => (
                        <SelectItem key={minute} value={String(minute)} className="min-h-[44px]">
                          {String(minute).padStart(2, '0')}min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {manualHour && (
                <p className="text-sm text-muted-foreground text-center">
                  Horário: {String(parseInt(manualHour, 10)).padStart(2, '0')}:{String(parseInt(manualMinute, 10)).padStart(2, '0')}
                </p>
              )}
            </div>
          )}

          {/* Patient selector */}
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={patientSearchOpen}
                  className="w-full justify-between min-h-[44px] font-normal"
                >
                  {selectedPaciente
                    ? patients.find((p) => p.id === selectedPaciente)?.full_name
                    : "Selecione o paciente"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Pesquisar paciente..." className="h-10" />
                  <CommandList>
                    <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {patients.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.full_name}
                          onSelect={() => {
                            setSelectedPaciente(p.id);
                            setPatientSearchOpen(false);
                          }}
                          className="min-h-[44px]"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPaciente === p.id ? "opacity-100" : "opacity-0"
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

          {scheduleWarnings.length > 0 && (
            <ScheduleWarningAlert warnings={scheduleWarnings} />
          )}

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

          {/* Package preview */}
          {isPackageMode && generatedDates.length > 0 && (
            <PackageSchedulePreview dates={generatedDates} />
          )}
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
            {isPackageMode
              ? `Agendar ${generatedDates.length} sessões`
              : hasInsufficientCredits
                ? "Agendar (Pendente)"
                : "Agendar Sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
