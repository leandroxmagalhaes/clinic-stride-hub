import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock, CalendarIcon, Check, ChevronsUpDown, UserPlus, X, Loader2 } from "lucide-react";
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
import { getAuthContext } from "@/lib/auth-helpers";

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

// ── Formulário de cadastro rápido de paciente ───────────────────────────────
interface QuickPatientFormData {
  full_name: string;
  phone: string;
  email: string;
  birth_date: string;
  nif: string;
  notes: string;
}

interface QuickPatientFormProps {
  onSave: (patient: Patient) => void;
  onCancel: () => void;
}

function QuickPatientForm({ onSave, onCancel }: QuickPatientFormProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<QuickPatientFormData>({
    full_name: "",
    phone: "",
    email: "",
    birth_date: "",
    nif: "",
    notes: "",
  });

  const handleChange = (field: keyof QuickPatientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { clinicId } = await getAuthContext();

      const insertData: Record<string, any> = {
        clinic_id: clinicId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        cadastro_incompleto: true,
      };

      if (form.email.trim()) insertData.email = form.email.trim();
      if (form.birth_date) insertData.birth_date = form.birth_date;
      if (form.nif.trim()) insertData.nif = form.nif.trim();
      if (form.notes.trim()) insertData.notes = form.notes.trim();

      const { data, error } = await supabase.from("pacientes").insert(insertData).select("id, full_name").single();

      if (error) throw error;

      toast.success(`Paciente "${data.full_name}" cadastrado com sucesso!`);
      onSave({ id: data.id, full_name: data.full_name });
    } catch (err: any) {
      console.error("Erro ao cadastrar paciente:", err);
      toast.error(err?.message || "Erro ao cadastrar paciente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-primary/30 rounded-lg bg-primary/5 p-4 space-y-3 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Novo paciente</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Campos */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Nome completo *</Label>
          <Input
            value={form.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
            placeholder="Nome completo do paciente"
            className="mt-1 h-9 text-sm"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Telefone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+351 9xx xxx xxx"
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Data de nascimento</Label>
            <Input
              value={form.birth_date}
              onChange={(e) => handleChange("birth_date", e.target.value)}
              type="date"
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">NIF / Documento</Label>
            <Input
              value={form.nif}
              onChange={(e) => handleChange("nif", e.target.value)}
              placeholder="NIF ou documento"
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações rápidas</Label>
          <Input
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Notas iniciais (opcional)"
            className="mt-1 h-9 text-sm"
          />
        </div>
      </div>

      {/* Badge de cadastro incompleto */}
      <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        <span>⚠️</span>
        <span>Cadastro marcado como incompleto — complete os dados depois em Pacientes.</span>
      </div>

      {/* Botões */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1" disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} className="flex-1" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />A guardar...
            </>
          ) : (
            "Guardar e selecionar"
          )}
        </Button>
      </div>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

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

  // Estado do formulário rápido de paciente
  const [showQuickPatientForm, setShowQuickPatientForm] = useState(false);
  // Lista local de pacientes (inclui recém-criados antes do refresh)
  const [localPatients, setLocalPatients] = useState<Patient[]>([]);

  // Lista combinada: pacientes originais + criados localmente nesta sessão
  const allPatients = useMemo(() => {
    const existingIds = new Set(patients.map((p) => p.id));
    const newOnes = localPatients.filter((p) => !existingIds.has(p.id));
    return [...patients, ...newOnes];
  }, [patients, localPatients]);

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
      setShowQuickPatientForm(false);
    }
  }, [isOpen, selectedSlot]);

  const isManualMode = !selectedSlot;
  const finalDate = selectedSlot?.date ?? manualDate;
  const finalHour = selectedSlot?.hour ?? (manualHour ? parseInt(manualHour, 10) : undefined);
  const finalMinute = selectedSlot?.minute ?? parseInt(manualMinute, 10);

  const isPackageMode = modality !== "avulso";

  const generatedDates = useMemo(() => {
    if (!isPackageMode || !finalDate || finalHour === undefined || selectedDays.length === 0) {
      return [];
    }
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

  // Após guardar novo paciente: selecionar automaticamente e fechar formulário
  const handleQuickPatientSaved = (newPatient: Patient) => {
    setLocalPatients((prev) => [...prev, newPatient]);
    setSelectedPaciente(newPatient.id);
    setShowQuickPatientForm(false);
    setPatientSearchOpen(false);
  };

  // Patient data
  const selectedPatientData = useMemo(
    () => allPatients.find((p) => p.id === selectedPaciente),
    [allPatients, selectedPaciente],
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
              <p className="font-medium">{format(finalDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
              <p className="text-muted-foreground">
                {String(finalHour).padStart(2, "0")}:{String(finalMinute).padStart(2, "0")}
              </p>
              {isPackageMode && <p className="text-xs text-muted-foreground mt-1">Data de início do pacote</p>}
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
                      className={cn("p-3 pointer-events-auto")}
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
                          {String(hour).padStart(2, "0")}h
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
                          {String(minute).padStart(2, "0")}min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {manualHour && (
                <p className="text-sm text-muted-foreground text-center">
                  Horário: {String(parseInt(manualHour, 10)).padStart(2, "0")}:
                  {String(parseInt(manualMinute, 10)).padStart(2, "0")}
                </p>
              )}
            </div>
          )}

          {/* Retroactive date warning */}
          {finalDate && finalDate < new Date(new Date().setHours(0, 0, 0, 0)) && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-foreground">
              <p className="font-medium">📅 Data retroativa</p>
              <p className="text-xs mt-1">
                Esta data é anterior a hoje. O agendamento será registrado como retroativo.
              </p>
            </div>
          )}

          {/* ── Patient selector com botão "+ Novo paciente" ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Paciente *</Label>
              {!showQuickPatientForm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary gap-1 px-2"
                  onClick={() => {
                    setShowQuickPatientForm(true);
                    setPatientSearchOpen(false);
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  Novo paciente
                </Button>
              )}
            </div>

            {!showQuickPatientForm ? (
              <>
                <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientSearchOpen}
                      className="w-full justify-between min-h-[44px] font-normal"
                    >
                      {selectedPaciente
                        ? allPatients.find((p) => p.id === selectedPaciente)?.full_name
                        : "Selecione o paciente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar paciente..." className="h-10" />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-3 text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-primary border-primary/30"
                              onClick={() => {
                                setPatientSearchOpen(false);
                                setShowQuickPatientForm(true);
                              }}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Cadastrar novo paciente
                            </Button>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {allPatients.map((p) => (
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
                              <span>{p.full_name}</span>
                              {/* Badge para cadastros incompletos vindos desta sessão */}
                              {localPatients.some((lp) => lp.id === p.id) && (
                                <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                  incompleto
                                </span>
                              )}
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
                    {patientBalance !== null && <CreditBalanceBadge balance={patientBalance} size="sm" />}
                  </div>
                )}
              </>
            ) : (
              // Formulário rápido inline
              <QuickPatientForm onSave={handleQuickPatientSaved} onCancel={() => setShowQuickPatientForm(false)} />
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
            <Label>Tipo de Serviço *</Label>
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
          {isPackageMode && generatedDates.length > 0 && <PackageSchedulePreview dates={generatedDates} />}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="min-h-[44px] w-full sm:w-auto" disabled={showQuickPatientForm}>
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
