import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, CalendarIcon, Check, ChevronsUpDown, UserPlus, Loader2, EuroIcon, Banknote } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

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
  price?: number;
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
    endHour?: number;
    endMinute?: number;
    price?: number;
    avulso?: boolean;
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
  onPatientCreated?: (patient: Patient) => void;
}

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
  onPatientCreated,
}: NewSessionModalProps) {
  const [manualDate, setManualDate] = useState<Date | undefined>(undefined);
  const [manualHour, setManualHour] = useState<string>("");
  const [manualMinute, setManualMinute] = useState<string>("0");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  // ── Hora de fim editável ──────────────────────────────────────────────────
  const [manualEndHour, setManualEndHour] = useState<string>("");
  const [manualEndMinute, setManualEndMinute] = useState<string>("0");

  // ── Preço personalizado + modo avulso ─────────────────────────────────────
  const [customPrice, setCustomPrice] = useState<string>("");
  const [isAvulso, setIsAvulso] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  const [modality, setModality] = useState<SchedulingModality>("avulso");
  const [frequency, setFrequency] = useState<SchedulingFrequency>("semanal");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [flexible, setFlexible] = useState(false);
  const [totalSessions, setTotalSessions] = useState(4);
  const [customSessionCount, setCustomSessionCount] = useState("");

  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [quickPatientName, setQuickPatientName] = useState("");
  const [quickPatientPhone, setQuickPatientPhone] = useState("");
  const [quickPatientEmail, setQuickPatientEmail] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  // Preenche preço automaticamente quando muda serviço
  useEffect(() => {
    if (!selectedServico) return;
    const svc = services.find((s) => s.id === selectedServico);
    if (svc?.price && !customPrice) {
      setCustomPrice(String(svc.price));
    }
  }, [selectedServico]);

  useEffect(() => {
    if (isOpen && selectedSlot) {
      setManualDate(selectedSlot.date);
      setManualHour(String(selectedSlot.hour));
      setManualMinute(String(selectedSlot.minute ?? 0));
      const svc = services.find((s) => s.id === selectedServico);
      const dur = svc?.duration_minutes || 60;
      const endH = selectedSlot.hour + Math.floor(((selectedSlot.minute ?? 0) + dur) / 60);
      const endM = ((selectedSlot.minute ?? 0) + dur) % 60;
      setManualEndHour(String(Math.min(endH, 23)));
      setManualEndMinute(String(endM));
    } else if (isOpen && !selectedSlot) {
      setManualDate(undefined);
      setManualHour("");
      setManualMinute("0");
      setManualEndHour("");
      setManualEndMinute("0");
    }
    if (isOpen) {
      setModality("avulso");
      setFrequency("semanal");
      setSelectedDays([]);
      setFlexible(false);
      setTotalSessions(4);
      setCustomSessionCount("");
      setShowQuickPatient(false);
      setQuickPatientName("");
      setQuickPatientPhone("");
      setQuickPatientEmail("");
      setCustomPrice("");
      setIsAvulso(false);
    }
  }, [isOpen, selectedSlot]);

  useEffect(() => {
    if (!manualHour) return;
    const svc = services.find((s) => s.id === selectedServico);
    if (!svc) return;
    const startH = parseInt(manualHour, 10);
    const startM = parseInt(manualMinute, 10);
    const totalMin = startH * 60 + startM + svc.duration_minutes;
    setManualEndHour(String(Math.floor(totalMin / 60)));
    setManualEndMinute(String(totalMin % 60));
    // Actualiza preço ao mudar serviço
    if (svc.price) setCustomPrice(String(svc.price));
  }, [selectedServico]);

  const isManualMode = !selectedSlot;
  const finalDate = selectedSlot?.date ?? manualDate;
  const finalHour = selectedSlot?.hour ?? (manualHour ? parseInt(manualHour, 10) : undefined);
  const finalMinute = selectedSlot?.minute ?? parseInt(manualMinute, 10);
  const finalEndHour = manualEndHour ? parseInt(manualEndHour, 10) : undefined;
  const finalEndMinute = manualEndMinute ? parseInt(manualEndMinute, 10) : 0;
  const isPackageMode = modality !== "avulso";

  const generatedDates = useMemo(() => {
    if (!isPackageMode || !finalDate || finalHour === undefined || selectedDays.length === 0) return [];
    return PackageSchedulingService.generateDates({
      modality,
      frequency,
      fixedDays: selectedDays,
      flexible,
      totalSessions: modality === "recorrente" ? 12 : totalSessions,
      startDate: finalDate,
      hour: finalHour,
      minute: finalMinute,
    });
  }, [isPackageMode, modality, frequency, selectedDays, flexible, totalSessions, finalDate, finalHour, finalMinute]);

  const handleQuickPatientCreate = async () => {
    const trimmedName = quickPatientName.trim();
    if (!trimmedName) {
      toast.error("Nome do paciente é obrigatório");
      return;
    }
    setIsCreatingPatient(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Usuário não autenticado");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("id", userData.user.id)
        .single();
      if (!profileData?.clinic_id) {
        toast.error("Clínica não identificada. Faça login novamente.");
        return;
      }
      const insertData: any = {
        full_name: trimmedName,
        clinic_id: profileData.clinic_id,
        is_active: true,
        health_tags: [],
        privacy_consent_at: new Date().toISOString(),
      };
      if (quickPatientPhone.trim()) insertData.phone = quickPatientPhone.trim();
      if (quickPatientEmail.trim()) insertData.email = quickPatientEmail.trim();
      const { data, error } = await supabase.from("pacientes").insert(insertData).select().single();
      if (error) throw error;
      if (!data) throw new Error("Nenhum dado retornado");
      const createdPatient: Patient = { id: (data as any).id, full_name: (data as any).full_name };
      if (onPatientCreated) onPatientCreated(createdPatient);
      setSelectedPaciente(createdPatient.id);
      setShowQuickPatient(false);
      setQuickPatientName("");
      setQuickPatientPhone("");
      setQuickPatientEmail("");
      toast.success(`Paciente "${createdPatient.full_name}" cadastrado e selecionado!`);
    } catch (error: any) {
      toast.error("Erro ao cadastrar paciente: " + (error.message || "Tente novamente"));
    } finally {
      setIsCreatingPatient(false);
    }
  };

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
      endHour: finalEndHour,
      endMinute: finalEndMinute,
      price: customPrice ? parseFloat(customPrice) : undefined,
      avulso: isAvulso,
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

  const selectedPatientData = useMemo(
    () => patients.find((p) => p.id === selectedPaciente),
    [patients, selectedPaciente],
  );
  const patientHealthTags = useMemo(
    () => HealthTagService.parseTags(selectedPatientData?.health_tags as string[] | undefined),
    [selectedPatientData],
  );
  const scheduleWarnings = useMemo(() => {
    if (finalHour === undefined || patientHealthTags.length === 0) return [];
    return HealthTagService.validateScheduling(patientHealthTags, finalHour);
  }, [patientHealthTags, finalHour]);

  useEffect(() => {
    if (scheduleWarnings.length > 0 && selectedPaciente && finalHour !== undefined) {
      scheduleWarnings.forEach((warning) => {
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

  const hasInsufficientCredits = !isAvulso && patientBalance !== null && patientBalance <= 0;

  // Preço exibido na pré-visualização
  const pricePreview = customPrice ? parseFloat(customPrice) : null;

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

          {/* ── Data e horário ────────────────────────────────────────────── */}
          {!isManualMode && finalDate && finalHour !== undefined ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{format(finalDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                <p className="text-muted-foreground">
                  {String(finalHour).padStart(2, "0")}:{String(finalMinute).padStart(2, "0")}
                </p>
                {isPackageMode && <p className="text-xs text-muted-foreground mt-1">Data de início do pacote</p>}
              </div>
              {!isPackageMode && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora de fim</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={manualEndHour} onValueChange={setManualEndHour}>
                      <SelectTrigger className="min-h-[40px]">
                        <SelectValue placeholder="Hora" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_HOURS.map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {String(h).padStart(2, "0")}h
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={manualEndMinute} onValueChange={setManualEndMinute}>
                      <SelectTrigger className="min-h-[40px]">
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_MINUTES.map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {String(m).padStart(2, "0")}min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                        !manualDate && "text-muted-foreground",
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
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hora de início *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={manualHour} onValueChange={setManualHour}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_HOURS.map((hour) => (
                        <SelectItem key={hour} value={String(hour)} className="min-h-[44px]">
                          {String(hour).padStart(2, "0")}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={manualMinute} onValueChange={setManualMinute}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MINUTES.map((minute) => (
                        <SelectItem key={minute} value={String(minute)} className="min-h-[44px]">
                          {String(minute).padStart(2, "0")}min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!isPackageMode && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hora de fim</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={manualEndHour} onValueChange={setManualEndHour}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Hora" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_HOURS.map((hour) => (
                          <SelectItem key={hour} value={String(hour)} className="min-h-[44px]">
                            {String(hour).padStart(2, "0")}h
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={manualEndMinute} onValueChange={setManualEndMinute}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_MINUTES.map((minute) => (
                          <SelectItem key={minute} value={String(minute)} className="min-h-[44px]">
                            {String(minute).padStart(2, "0")}min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {manualHour && manualEndHour && (
                    <p className="text-xs text-muted-foreground text-center">
                      {String(parseInt(manualHour)).padStart(2, "0")}:{String(parseInt(manualMinute)).padStart(2, "0")}{" "}
                      → {String(parseInt(manualEndHour)).padStart(2, "0")}:
                      {String(parseInt(manualEndMinute)).padStart(2, "0")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {finalDate && finalDate < new Date(new Date().setHours(0, 0, 0, 0)) && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-foreground">
              <p className="font-medium">📅 Data retroativa</p>
              <p className="text-xs mt-1">
                Esta data é anterior a hoje. O agendamento será registrado como retroativo.
              </p>
            </div>
          )}

          {/* Patient selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Paciente *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary/80 gap-1 px-2"
                onClick={() => setShowQuickPatient(!showQuickPatient)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {showQuickPatient ? "Cancelar" : "Novo Paciente"}
              </Button>
            </div>

            {showQuickPatient && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs font-medium text-primary">Cadastro rápido de paciente</p>
                <div className="space-y-2">
                  <Input
                    placeholder="Nome completo *"
                    value={quickPatientName}
                    onChange={(e) => setQuickPatientName(e.target.value)}
                    className="min-h-[40px] text-sm"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Telefone"
                      value={quickPatientPhone}
                      onChange={(e) => setQuickPatientPhone(e.target.value)}
                      className="min-h-[40px] text-sm"
                      type="tel"
                    />
                    <Input
                      placeholder="Email"
                      value={quickPatientEmail}
                      onChange={(e) => setQuickPatientEmail(e.target.value)}
                      className="min-h-[40px] text-sm"
                      type="email"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 min-h-[36px] text-xs"
                    onClick={() => {
                      setShowQuickPatient(false);
                      setQuickPatientName("");
                      setQuickPatientPhone("");
                      setQuickPatientEmail("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 min-h-[36px] text-xs gap-1"
                    onClick={handleQuickPatientCreate}
                    disabled={isCreatingPatient || !quickPatientName.trim()}
                  >
                    {isCreatingPatient ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Cadastrar e Selecionar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Dados completos podem ser preenchidos depois no cadastro do paciente.
                </p>
              </div>
            )}

            {!showQuickPatient && (
              <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between min-h-[44px] font-normal">
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
                              className={cn("mr-2 h-4 w-4", selectedPaciente === p.id ? "opacity-100" : "opacity-0")}
                            />
                            {p.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {selectedPatientData && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {patientHealthTags.length > 0 && <HealthTagList tags={patientHealthTags} maxVisible={3} size="sm" />}
                {patientBalance !== null && <CreditBalanceBadge balance={patientBalance} size="sm" />}
              </div>
            )}
          </div>

          {scheduleWarnings.length > 0 && <ScheduleWarningAlert warnings={scheduleWarnings} />}

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
            <Label>Tipo de Serviço</Label>
            <Select value={selectedServico} onValueChange={setSelectedServico}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name} ({s.duration_minutes}min)
                      {s.price ? <span className="text-xs text-muted-foreground ml-1">· {s.price}€</span> : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Preço + Modo Avulso ──────────────────────────────────────────── */}
          <div className="space-y-3 p-3 rounded-xl border bg-muted/30">
            {/* Toggle avulso */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-primary" />
                  Sessão Avulsa
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Pagamento directo — não consome créditos</p>
              </div>
              <Switch checked={isAvulso} onCheckedChange={setIsAvulso} />
            </div>

            {/* Campo de preço — sempre visível */}
            <div className="space-y-1">
              <Label className="text-xs">
                Valor da Sessão (€)
                {isAvulso && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    Avulso
                  </Badge>
                )}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7 min-h-[44px]"
                  placeholder="0,00"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
              {pricePreview !== null && pricePreview > 0 && (
                <p className="text-xs text-muted-foreground">
                  {isAvulso
                    ? `💶 Sessão avulsa de ${pricePreview.toFixed(2)}€ — finaliza sem créditos`
                    : `💶 Valor: ${pricePreview.toFixed(2)}€ — requer crédito para finalizar`}
                </p>
              )}
            </div>
          </div>
          {/* ─────────────────────────────────────────────────────────────────── */}

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

          {isPackageMode && generatedDates.length > 0 && <PackageSchedulePreview dates={generatedDates} />}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="min-h-[44px] w-full sm:w-auto">
            {isPackageMode
              ? `Agendar ${generatedDates.length} sessões`
              : isAvulso
                ? `Agendar Avulso${pricePreview ? ` · ${pricePreview.toFixed(2)}€` : ""}`
                : hasInsufficientCredits
                  ? "Agendar (Pendente)"
                  : "Agendar Sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
