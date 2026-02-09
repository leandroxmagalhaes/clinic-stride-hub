import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, CalendarIcon, Check, ChevronsUpDown, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateReservedSlotData, ReservedSlotType } from "@/services/ReservedSlotService";

interface Patient {
  id: string;
  full_name: string;
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

interface NewReservedSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  professionals: Professional[];
  services: Service[];
  clinicId: string;
  onSubmit: (data: CreateReservedSlotData) => Promise<void>;
}

// Available hours (06:00 to 23:00)
const AVAILABLE_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

// Days of week (ISO: 1=Monday, 7=Sunday)
const DAYS_OF_WEEK = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
];

// Color options for reserved slots
const COLOR_OPTIONS = [
  { value: "#FCD34D", label: "Amarelo", class: "bg-yellow-400" },
  { value: "#4ADE80", label: "Verde", class: "bg-green-400" },
  { value: "#60A5FA", label: "Azul", class: "bg-blue-400" },
  { value: "#F472B6", label: "Rosa", class: "bg-pink-400" },
  { value: "#A78BFA", label: "Roxo", class: "bg-violet-400" },
  { value: "#FB923C", label: "Laranja", class: "bg-orange-400" },
];

export function NewReservedSlotModal({
  isOpen,
  onClose,
  patients,
  professionals,
  services,
  clinicId,
  onSubmit,
}: NewReservedSlotModalProps) {
  // Form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [tipo, setTipo] = useState<ReservedSlotType>("fixo");
  const [titulo, setTitulo] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState(60);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [cor, setCor] = useState("#FCD34D");
  const [observacoes, setObservacoes] = useState("");
  
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get selected patient name for auto-title
  const selectedPatientData = useMemo(() => {
    return patients.find(p => p.id === selectedPatient);
  }, [patients, selectedPatient]);

  // Auto-generate title when patient is selected
  const autoTitle = useMemo(() => {
    if (!selectedPatientData) return "";
    return `Reserva - ${selectedPatientData.full_name}`;
  }, [selectedPatientData]);

  const handleDayToggle = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedPatient) {
      toast.error("Selecione um paciente");
      return;
    }
    if (!horarioInicio) {
      toast.error("Selecione o horário de início");
      return;
    }
    if (!dataInicio) {
      toast.error("Selecione a data de início");
      return;
    }
    if (tipo === "fixo" && selectedDays.length === 0) {
      toast.error("Selecione pelo menos um dia da semana");
      return;
    }

    setIsSubmitting(true);
    try {
      const data: CreateReservedSlotData = {
        clinic_id: clinicId,
        patient_id: selectedPatient,
        professional_id: selectedProfessional || null,
        service_id: selectedService || null,
        tipo,
        titulo: titulo || autoTitle || "Horário Reservado",
        dias_semana: tipo === "fixo" ? selectedDays : null,
        horario_inicio: `${String(parseInt(horarioInicio)).padStart(2, '0')}:00:00`,
        duracao_minutos: duracaoMinutos,
        horarios_personalizados: null, // For now, only fixed type
        data_inicio: format(dataInicio, "yyyy-MM-dd"),
        data_fim: dataFim ? format(dataFim, "yyyy-MM-dd") : null,
        cor,
        observacoes: observacoes || null,
      };

      await onSubmit(data);
      toast.success("Horário reservado criado com sucesso!");
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar reserva");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setSelectedPatient("");
    setSelectedProfessional("");
    setSelectedService("");
    setTipo("fixo");
    setTitulo("");
    setSelectedDays([]);
    setHorarioInicio("");
    setDuracaoMinutos(60);
    setDataInicio(new Date());
    setDataFim(undefined);
    setCor("#FCD34D");
    setObservacoes("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Lock className="h-5 w-5 text-yellow-500" />
            Novo Horário Reservado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient Selection */}
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
                  {selectedPatient
                    ? patients.find((p) => p.id === selectedPatient)?.full_name
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
                            setSelectedPatient(p.id);
                            setPatientSearchOpen(false);
                          }}
                          className="min-h-[44px]"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPatient === p.id ? "opacity-100" : "opacity-0"
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

          {/* Title */}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={autoTitle || "Ex: Reserva semanal"}
              className="min-h-[44px]"
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Tipo de Reserva *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as ReservedSlotType)}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo" className="min-h-[44px]">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Fixo (Padrão Semanal)
                  </div>
                </SelectItem>
                <SelectItem value="personalizado" className="min-h-[44px]" disabled>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Personalizado (Em breve)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Days of Week (for fixed type) */}
          {tipo === "fixo" && (
            <div className="space-y-2">
              <Label>Dias da Semana *</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={selectedDays.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDayToggle(day.value)}
                    className="min-w-[48px]"
                  >
                    {day.short}
                  </Button>
                ))}
              </div>
              {selectedDays.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Selecionados: {selectedDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Horário *</Label>
              <Select value={horarioInicio} onValueChange={setHorarioInicio}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Hora" />
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

            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Select value={String(duracaoMinutos)} onValueChange={(v) => setDuracaoMinutos(parseInt(v))}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal min-h-[44px]",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal min-h-[44px]",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Sem fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    disabled={(date) => dataInicio ? date < dataInicio : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Professional (optional) */}
          <div className="space-y-2">
            <Label>Profissional (opcional)</Label>
            <Select 
              value={selectedProfessional || "__none__"} 
              onValueChange={(v) => setSelectedProfessional(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Qualquer profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="min-h-[44px]">
                  Qualquer profissional
                </SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service (optional) */}
          <div className="space-y-2">
            <Label>Serviço (opcional)</Label>
            <Select 
              value={selectedService || "__none__"} 
              onValueChange={(v) => setSelectedService(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Qualquer serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="min-h-[44px]">
                  Qualquer serviço
                </SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCor(option.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    cor === option.value ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: option.value }}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre a reserva..."
              rows={2}
              className="min-h-[66px]"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="min-h-[44px] w-full sm:w-auto"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            className="min-h-[44px] w-full sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Criando..." : "Criar Reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
