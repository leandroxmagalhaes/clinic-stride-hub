// NewSessionModal v3 — sem créditos, com suporte a pack
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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Clock, CalendarIcon, Check, ChevronsUpDown, UserPlus, Loader2, Package } from "lucide-react";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { ScheduleWarningAlert } from "@/components/agenda/ScheduleWarningAlert";
import { HealthTagService, HealthTag } from "@/services/HealthTagService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/contexts/DataContext";

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
    packId?: string | null;
  }) => void;
  selectedPaciente: string;
  setSelectedPaciente: (value: string) => void;
  selectedProfissional: string;
  setSelectedProfissional: (value: string) => void;
  selectedServico: string;
  setSelectedServico: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
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
  onPatientCreated,
}: NewSessionModalProps) {
  const { getActivePack, packs } = useData();

  const [manualDate, setManualDate] = useState<Date | undefined>();
  const [manualHour, setManualHour] = useState("");
  const [manualMinute, setManualMinute] = useState("0");
  const [manualEndHour, setManualEndHour] = useState("");
  const [manualEndMinute, setManualEndMinute] = useState("0");
  const [customPrice, setCustomPrice] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  // Pack
  const [usePack, setUsePack] = useState<"avulso" | "pack">("avulso");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // Quick patient
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [quickPatientName, setQuickPatientName] = useState("");
  const [quickPatientPhone, setQuickPatientPhone] = useState("");
  const [quickPatientEmail, setQuickPatientEmail] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  // Pack do paciente seleccionado
  const activePack = useMemo(() => {
    if (!selectedPaciente) return null;
    return getActivePack(selectedPaciente);
  }, [selectedPaciente, packs]);

  const patientPacks = useMemo(
    () => packs.filter((p) => p.paciente_id === selectedPaciente && p.is_active),
    [selectedPaciente, packs],
  );

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
      setCustomPrice("");
      setShowQuickPatient(false);
      setQuickPatientName("");
      setQuickPatientPhone("");
      setQuickPatientEmail("");
      setUsePack("avulso");
      setSelectedPackId(null);
    }
  }, [isOpen, selectedSlot]);

  useEffect(() => {
    if (!manualHour || !selectedServico) return;
    const svc = services.find((s) => s.id === selectedServico);
    if (!svc) return;
    const startH = parseInt(manualHour, 10);
    const startM = parseInt(manualMinute, 10);
    const totalMin = startH * 60 + startM + svc.duration_minutes;
    setManualEndHour(String(Math.floor(totalMin / 60)));
    setManualEndMinute(String(totalMin % 60));
    if (svc.price && !customPrice) setCustomPrice(String(svc.price));
  }, [selectedServico]);

  // Auto-seleccionar pack activo quando muda paciente
  useEffect(() => {
    if (activePack) {
      setUsePack("pack");
      setSelectedPackId(activePack.id);
    } else {
      setUsePack("avulso");
      setSelectedPackId(null);
    }
  }, [selectedPaciente, activePack]);

  const isManualMode = !selectedSlot;
  const finalDate = selectedSlot?.date ?? manualDate;
  const finalHour = selectedSlot?.hour ?? (manualHour ? parseInt(manualHour, 10) : undefined);
  const finalMinute = selectedSlot?.minute ?? parseInt(manualMinute, 10);
  const finalEndHour = manualEndHour ? parseInt(manualEndHour, 10) : undefined;
  const finalEndMinute = manualEndMinute ? parseInt(manualEndMinute, 10) : 0;

  const handleQuickPatientCreate = async () => {
    if (!quickPatientName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setIsCreatingPatient(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Não autenticado");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("id", userData.user.id)
        .single();
      if (!profileData?.clinic_id) {
        toast.error("Clínica não identificada");
        return;
      }
      const insertData: any = {
        full_name: quickPatientName.trim(),
        clinic_id: profileData.clinic_id,
        is_active: true,
        health_tags: [],
        privacy_consent_at: new Date().toISOString(),
      };
      if (quickPatientPhone.trim()) insertData.phone = quickPatientPhone.trim();
      if (quickPatientEmail.trim()) insertData.email = quickPatientEmail.trim();
      const { data, error } = await supabase.from("pacientes").insert(insertData).select().single();
      if (error) throw error;
      const created: Patient = { id: (data as any).id, full_name: (data as any).full_name };
      if (onPatientCreated) onPatientCreated(created);
      setSelectedPaciente(created.id);
      setShowQuickPatient(false);
      setQuickPatientName("");
      setQuickPatientPhone("");
      setQuickPatientEmail("");
      toast.success(`Paciente "${created.full_name}" criado!`);
    } catch (error: any) {
      toast.error("Erro: " + (error.message || "Tente novamente"));
    } finally {
      setIsCreatingPatient(false);
    }
  };

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
      minute: finalMinute,
      endHour: finalEndHour,
      endMinute: finalEndMinute,
      price: customPrice ? parseFloat(customPrice) : undefined,
      packId: usePack === "pack" ? selectedPackId : null,
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

  const pricePreview = customPrice ? parseFloat(customPrice) : null;
  const selectedPack = selectedPackId ? packs.find((p) => p.id === selectedPackId) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ── Data e horário ──────────────────────────────────────────── */}
          {!isManualMode && finalDate && finalHour !== undefined ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{format(finalDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                <p className="text-muted-foreground">
                  {String(finalHour).padStart(2, "0")}:{String(finalMinute).padStart(2, "0")}
                </p>
              </div>
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
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal min-h-[44px]",
                        !manualDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {manualDate ? format(manualDate, "dd/MM/yyyy") : "Selecione (pode ser retroativa)"}
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
                      {AVAILABLE_HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)} className="min-h-[44px]">
                          {String(h).padStart(2, "0")}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={manualMinute} onValueChange={setManualMinute}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)} className="min-h-[44px]">
                          {String(m).padStart(2, "0")}min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hora de fim</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={manualEndHour} onValueChange={setManualEndHour}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)} className="min-h-[44px]">
                          {String(h).padStart(2, "0")}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={manualEndMinute} onValueChange={setManualEndMinute}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)} className="min-h-[44px]">
                          {String(m).padStart(2, "0")}min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {finalDate && finalDate < new Date(new Date().setHours(0, 0, 0, 0)) && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <p className="font-medium">📅 Data retroativa</p>
              <p className="text-xs mt-1">O agendamento será registado como retroativo.</p>
            </div>
          )}

          {/* ── Paciente ────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Paciente *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary gap-1 px-2"
                onClick={() => setShowQuickPatient(!showQuickPatient)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {showQuickPatient ? "Cancelar" : "Novo Paciente"}
              </Button>
            </div>

            {showQuickPatient && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                <p className="text-xs font-medium text-primary">Cadastro rápido</p>
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowQuickPatient(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={handleQuickPatientCreate}
                    disabled={isCreatingPatient || !quickPatientName.trim()}
                  >
                    {isCreatingPatient ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Criar e Seleccionar
                      </>
                    )}
                  </Button>
                </div>
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
                    <CommandInput placeholder="Pesquisar..." className="h-10" />
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

            {selectedPatientData && patientHealthTags.length > 0 && (
              <HealthTagList tags={patientHealthTags} maxVisible={3} size="sm" />
            )}
          </div>

          {scheduleWarnings.length > 0 && <ScheduleWarningAlert warnings={scheduleWarnings} />}

          {/* ── Profissional ────────────────────────────────────────────── */}
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

          {/* ── Serviço ─────────────────────────────────────────────────── */}
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
                      {s.price ? <span className="text-xs text-muted-foreground">· {s.price}€</span> : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Pack ou Avulso ──────────────────────────────────────────── */}
          {selectedPaciente && (
            <div className="space-y-3 p-3 rounded-xl border bg-muted/30">
              <p className="text-sm font-medium">Tipo de sessão</p>
              <RadioGroup value={usePack} onValueChange={(v) => setUsePack(v as any)} className="space-y-2">
                <div
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                    usePack === "avulso" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => {
                    setUsePack("avulso");
                    setSelectedPackId(null);
                  }}
                >
                  <RadioGroupItem value="avulso" id="ns-avulso" />
                  <div>
                    <p className="text-sm font-medium">Avulso</p>
                    <p className="text-xs text-muted-foreground">Pagamento directo por sessão</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                    usePack === "pack" ? "border-blue-500 bg-blue-50" : "border-border hover:bg-muted/50",
                    !activePack && patientPacks.length === 0 && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={() => {
                    if (!activePack && patientPacks.length === 0) return;
                    setUsePack("pack");
                    setSelectedPackId(activePack?.id ?? patientPacks[0]?.id ?? null);
                  }}
                >
                  <RadioGroupItem value="pack" id="ns-pack" disabled={!activePack && patientPacks.length === 0} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-blue-700">Pack</p>
                      {activePack && (
                        <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                          Pack {activePack.numero_pack} · {activePack.sessoes_restantes} restantes
                        </Badge>
                      )}
                    </div>
                    {!activePack && patientPacks.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">Sem pack activo — crie um primeiro</p>
                    )}
                  </div>
                </div>
              </RadioGroup>

              {/* Alerta pack a acabar */}
              {usePack === "pack" &&
                selectedPack &&
                (selectedPack.alert_status === "ultima_sessao" || selectedPack.alert_status === "penultima_sessao") && (
                  <div
                    className={cn(
                      "p-2.5 rounded-lg text-xs flex items-center gap-2",
                      selectedPack.alert_status === "ultima_sessao"
                        ? "bg-red-50 border border-red-200 text-red-700"
                        : "bg-orange-50 border border-orange-200 text-orange-700",
                    )}
                  >
                    <Package className="h-3.5 w-3.5 shrink-0" />
                    {selectedPack.alert_status === "ultima_sessao"
                      ? "⚠️ Esta é a última sessão do pack!"
                      : "⚠️ Penúltima sessão do pack — considere renovar!"}
                  </div>
                )}
            </div>
          )}

          {/* ── Valor ───────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label className="text-xs">Valor da Sessão (€)</Label>
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
              <p className="text-xs text-muted-foreground">💶 {pricePreview.toFixed(2)}€</p>
            )}
          </div>

          {/* ── Observações ─────────────────────────────────────────────── */}
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
          <Button variant="outline" onClick={onClose} className="min-h-[44px] w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="min-h-[44px] w-full sm:w-auto">
            {usePack === "pack" && selectedPack
              ? `Agendar · Pack ${selectedPack.numero_pack}`
              : pricePreview
                ? `Agendar Avulso · ${pricePreview.toFixed(2)}€`
                : "Agendar Sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
