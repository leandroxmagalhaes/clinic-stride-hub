// NewSessionModal v4 — 4-step scheduling wizard
import { useState, useMemo, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, CalendarIcon, Check, ChevronsUpDown, UserPlus, Loader2, Package, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { HealthTagService, HealthTag } from "@/services/HealthTagService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";

// Keep export for backward compatibility
export interface PackageSubmitData {
  modality: string;
  frequency?: string;
  fixedDays: number[];
  flexible: boolean;
  totalSessions: number;
  generatedDates: { date: Date; hour: number; minute: number }[];
}

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
  onPatientCreated?: (patient: Patient) => void;
  onSessionsCreated?: () => void;
}

interface SessionSlot {
  date: Date | undefined;
  hour: string;
  minute: string;
}

const TIME_OPTIONS = (() => {
  const opts: { label: string; hour: number; minute: number }[] = [];
  for (let h = 7; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) break;
      opts.push({
        label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        hour: h,
        minute: m,
      });
    }
  }
  return opts;
})();

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "mbway", label: "MB Way" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "outro", label: "Outro" },
];

export function NewSessionModal({
  isOpen,
  onClose,
  selectedSlot,
  patients,
  professionals,
  services,
  onPatientCreated,
  onSessionsCreated,
}: NewSessionModalProps) {
  // ── Wizard step ──
  const [step, setStep] = useState(1);

  // ── Step 1: Type & Quantity ──
  const [tipoAgendamento, setTipoAgendamento] = useState<"avulso" | "pack">("avulso");
  const [quantidade, setQuantidade] = useState(1);

  // ── Step 2: Dates & Times ──
  const [sessionSlots, setSessionSlots] = useState<SessionSlot[]>([{ date: undefined, hour: "", minute: "0" }]);

  // ── Step 3: Patient / Service / Professional ──
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [notes, setNotes] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  // Quick patient creation
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [quickPatientName, setQuickPatientName] = useState("");
  const [quickPatientPhone, setQuickPatientPhone] = useState("");
  const [quickPatientEmail, setQuickPatientEmail] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  // ── Step 4: Value & Payment ──
  const [valorSessao, setValorSessao] = useState("");
  const [valorPackTotal, setValorPackTotal] = useState("");
  const [pagamentoEstado, setPagamentoEstado] = useState<"pago" | "pendente" | "parcial">("pendente");
  const [pagamentoMetodo, setPagamentoMetodo] = useState("");
  const [pagamentoData, setPagamentoData] = useState<Date | undefined>(new Date());
  const [valorPago, setValorPago] = useState("");

  // ── Saving ──
  const [isSaving, setIsSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTipoAgendamento("avulso");
      setQuantidade(1);
      setSelectedPaciente("");
      setSelectedProfissional("");
      setSelectedServico("");
      setNotes("");
      setValorSessao("");
      setValorPackTotal("");
      setPagamentoEstado("pendente");
      setPagamentoMetodo("");
      setPagamentoData(new Date());
      setValorPago("");
      setShowQuickPatient(false);
      setQuickPatientName("");
      setQuickPatientPhone("");
      setQuickPatientEmail("");

      if (selectedSlot) {
        setSessionSlots([{
          date: selectedSlot.date,
          hour: String(selectedSlot.hour),
          minute: String(selectedSlot.minute ?? 0),
        }]);
      } else {
        setSessionSlots([{ date: undefined, hour: "", minute: "0" }]);
      }
    }
  }, [isOpen, selectedSlot]);

  // Update session slots count when quantity changes
  useEffect(() => {
    setSessionSlots((prev) => {
      const newSlots: SessionSlot[] = [];
      for (let i = 0; i < quantidade; i++) {
        if (prev[i]) {
          newSlots.push(prev[i]);
        } else {
          newSlots.push({ date: undefined, hour: "", minute: "0" });
        }
      }
      return newSlots;
    });
  }, [quantidade]);

  // Auto-fill price from service
  useEffect(() => {
    if (selectedServico) {
      const svc = services.find((s) => s.id === selectedServico);
      if (svc?.price) {
        if (tipoAgendamento === "avulso") {
          setValorSessao(String(svc.price));
        } else {
          setValorPackTotal(String(Number(svc.price) * quantidade));
        }
      }
    }
  }, [selectedServico, tipoAgendamento, quantidade]);

  const updateSlot = useCallback((index: number, field: keyof SessionSlot, value: any) => {
    setSessionSlots((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, []);

  // ── Patient data ──
  const selectedPatientData = useMemo(() => patients.find((p) => p.id === selectedPaciente), [patients, selectedPaciente]);
  const patientHealthTags = useMemo(
    () => HealthTagService.parseTags(selectedPatientData?.health_tags as string[] | undefined),
    [selectedPatientData],
  );

  // ── Dynamic legend ──
  const legend = useMemo(() => {
    if (tipoAgendamento === "pack") return "Pack pré-pago — pagamento antecipado ou na 1ª sessão";
    if (quantidade === 1) return "O pagamento é feito no dia da consulta";
    return "Agendamento em série — pagamento a cada sessão";
  }, [tipoAgendamento, quantidade]);

  // ── Computed values ──
  const totalAvulso = useMemo(() => {
    const v = parseFloat(valorSessao);
    return isNaN(v) ? 0 : v * quantidade;
  }, [valorSessao, quantidade]);

  const valorSessaoPack = useMemo(() => {
    const v = parseFloat(valorPackTotal);
    return isNaN(v) || quantidade === 0 ? 0 : v / quantidade;
  }, [valorPackTotal, quantidade]);

  // ── Validation per step ──
  const canAdvanceStep1 = quantidade >= 1;
  const canAdvanceStep2 = sessionSlots.every((s) => s.date && s.hour !== "");
  const canAdvanceStep3 = selectedPaciente && selectedServico && selectedProfissional;

  // ── Quick patient create ──
  const handleQuickPatientCreate = async () => {
    if (!quickPatientName.trim()) { toast.error("Nome é obrigatório"); return; }
    setIsCreatingPatient(true);
    try {
      const { clinicId } = await getAuthContext();
      const insertData: any = {
        full_name: quickPatientName.trim(),
        clinic_id: clinicId,
        is_active: true,
        health_tags: [],
        privacy_consent_at: new Date().toISOString(),
      };
      if (quickPatientPhone.trim()) insertData.phone = quickPatientPhone.trim();
      if (quickPatientEmail.trim()) insertData.email = quickPatientEmail.trim();
      const { data, error } = await supabase.from("pacientes").insert(insertData).select().single();
      if (error) throw error;
      const created: Patient = { id: (data as any).id, full_name: (data as any).full_name };
      onPatientCreated?.(created);
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

  // ── Save ──
  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const { clinicId, userId } = await getAuthContext();
      const selectedService = services.find((s) => s.id === selectedServico);
      const durationMin = selectedService?.duration_minutes || 60;

      const isMultiple = quantidade >= 2;
      const packGrupoId = (tipoAgendamento === "pack" || isMultiple) ? crypto.randomUUID() : null;

      const vSessao = tipoAgendamento === "avulso"
        ? (parseFloat(valorSessao) || null)
        : (valorSessaoPack || null);
      const vPackTotal = tipoAgendamento === "pack" ? (parseFloat(valorPackTotal) || null) : null;

      for (let i = 0; i < sessionSlots.length; i++) {
        const slot = sessionSlots[i];
        if (!slot.date) continue;

        const startTime = new Date(slot.date);
        startTime.setHours(parseInt(slot.hour, 10), parseInt(slot.minute, 10), 0, 0);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMin);

        const isPast = startTime < new Date();

        const { error } = await supabase.from("sessoes").insert({
          clinic_id: clinicId,
          paciente_id: selectedPaciente,
          profissional_id: selectedProfissional,
          servico_id: selectedServico,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: isPast ? "realizado" : "agendado",
          notes: notes || null,
          price: vSessao ?? (selectedService ? Number(selectedService.price) : 0),
          payment_status: pagamentoEstado === "pago" ? "pago" : "pendente",
          tipo_agendamento: tipoAgendamento,
          pack_grupo_id: packGrupoId,
          valor_sessao: vSessao,
          valor_pack_total: vPackTotal,
          pagamento_estado: pagamentoEstado,
          pagamento_metodo: (pagamentoEstado === "pago" || pagamentoEstado === "parcial") ? (pagamentoMetodo || null) : null,
          pagamento_data: (pagamentoEstado === "pago" || pagamentoEstado === "parcial") && pagamentoData
            ? format(pagamentoData, "yyyy-MM-dd")
            : null,
          created_by: userId,
        });

        if (error) throw error;
      }

      toast.success(`${quantidade} sessão${quantidade > 1 ? "ões" : ""} agendada${quantidade > 1 ? "s" : ""} com sucesso!`);
      onSessionsCreated?.();
      onClose();
    } catch (error: any) {
      console.error("Error creating sessions:", error);
      toast.error(error.message || "Erro ao agendar sessões");
    } finally {
      setIsSaving(false);
    }
  };

  const progressValue = (step / 4) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Passo {step} de 4</span>
            <span>{step === 1 ? "Tipo" : step === 2 ? "Datas" : step === 3 ? "Detalhes" : "Pagamento"}</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        {/* ═══════════════════ STEP 1: Type & Quantity ═══════════════════ */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            {/* Toggle cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoAgendamento("avulso")}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  tipoAgendamento === "avulso"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <div className="font-semibold text-sm">Avulso</div>
                <p className="text-xs text-muted-foreground mt-1">Sessão individual ou em série</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoAgendamento("pack")}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  tipoAgendamento === "pack"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Pack
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pagamento antecipado</p>
              </button>
            </div>

            {/* Legend */}
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">{legend}</p>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantidade de sessões</Label>
              <div className="flex items-center gap-2">
                {[1, 5, 10, 20].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={quantidade === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuantidade(n)}
                    className="min-w-[40px]"
                  >
                    {n}
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={quantidade}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
                    setQuantidade(v);
                  }}
                  className="w-20 text-center"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canAdvanceStep1} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 2: Dates & Times ═══════════════════ */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className={cn(quantidade > 5 && "max-h-[400px] overflow-y-auto pr-1", "space-y-3")}>
              {sessionSlots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      Sessão {i + 1}
                    </span>
                    {tipoAgendamento === "pack" && (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Pack</Badge>
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("w-[130px] justify-start text-left font-normal", !slot.date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {slot.date ? format(slot.date, "dd/MM/yyyy") : "Data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={slot.date}
                        onSelect={(d) => updateSlot(i, "date", d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Select value={slot.hour ? `${slot.hour}:${slot.minute}` : ""} onValueChange={(v) => {
                    const [h, m] = v.split(":");
                    updateSlot(i, "hour", h);
                    updateSlot(i, "minute", m);
                  }}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t.label} value={`${t.hour}:${t.minute}`}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canAdvanceStep2} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 3: Patient / Service / Professional ═══════════════════ */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {/* Patient combobox */}
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between min-h-[44px]", !selectedPaciente && "text-muted-foreground")}
                  >
                    {selectedPaciente ? patients.find((p) => p.id === selectedPaciente)?.full_name : "Pesquisar paciente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Nome do paciente..." />
                    <CommandList>
                      <CommandEmpty>
                        <div className="text-center py-2">
                          <p className="text-sm">Nenhum paciente encontrado</p>
                          <Button variant="ghost" size="sm" className="mt-1 gap-1" onClick={() => { setShowQuickPatient(true); setPatientSearchOpen(false); }}>
                            <UserPlus className="h-3 w-3" /> Criar novo
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {patients.map((p) => (
                          <CommandItem key={p.id} value={p.full_name} onSelect={() => { setSelectedPaciente(p.id); setPatientSearchOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedPaciente === p.id ? "opacity-100" : "opacity-0")} />
                            {p.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {!showQuickPatient && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setShowQuickPatient(true)}>
                  <UserPlus className="h-3 w-3" /> Criar paciente rápido
                </Button>
              )}
            </div>

            {/* Quick patient form */}
            {showQuickPatient && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <Label className="text-xs font-medium">Novo Paciente</Label>
                <Input placeholder="Nome completo *" value={quickPatientName} onChange={(e) => setQuickPatientName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Telefone" value={quickPatientPhone} onChange={(e) => setQuickPatientPhone(e.target.value)} />
                  <Input placeholder="Email" value={quickPatientEmail} onChange={(e) => setQuickPatientEmail(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleQuickPatientCreate} disabled={isCreatingPatient} className="gap-1">
                    {isCreatingPatient ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                    Criar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowQuickPatient(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Health tags warning */}
            {patientHealthTags.length > 0 && (
              <div className="p-2 rounded-md bg-muted/30">
                <HealthTagList tags={patientHealthTags} />
              </div>
            )}

            {/* Service */}
            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Select value={selectedServico} onValueChange={setSelectedServico}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span>{s.name}</span>
                        <span className="text-muted-foreground text-xs">({s.duration_minutes}min • €{s.price ?? 0})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Professional */}
            <div className="space-y-2">
              <Label>Profissional *</Label>
              <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas ou observações..." rows={2} />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(4)} disabled={!canAdvanceStep3} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 4: Value & Payment ═══════════════════ */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            {/* Value */}
            {tipoAgendamento === "avulso" ? (
              <div className="space-y-2">
                <Label>Valor por sessão (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorSessao}
                  onChange={(e) => setValorSessao(e.target.value)}
                  placeholder="0.00"
                />
                {quantidade > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Total: <span className="font-medium">€{totalAvulso.toFixed(2)}</span> ({quantidade} sessões)
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Valor total do Pack (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorPackTotal}
                  onChange={(e) => setValorPackTotal(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Valor por sessão: <span className="font-medium">€{valorSessaoPack.toFixed(2)}</span> ({quantidade} sessões)
                </p>
                <Alert className="border-warning/50 bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-xs">
                    Pack deve ser pago antecipadamente ou na 1ª sessão
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Payment state */}
            <div className="space-y-2">
              <Label>Estado do pagamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["pago", "pendente", "parcial"] as const).map((estado) => (
                  <Button
                    key={estado}
                    type="button"
                    variant={pagamentoEstado === estado ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPagamentoEstado(estado)}
                    className="capitalize"
                  >
                    {estado}
                  </Button>
                ))}
              </div>
            </div>

            {/* Payment method + date if paid/partial */}
            {(pagamentoEstado === "pago" || pagamentoEstado === "parcial") && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                <div className="space-y-2">
                  <Label className="text-xs">Método de pagamento</Label>
                  <Select value={pagamentoMetodo} onValueChange={setPagamentoMetodo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Data do pagamento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start", !pagamentoData && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {pagamentoData ? format(pagamentoData, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={pagamentoData} onSelect={setPagamentoData} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                {pagamentoEstado === "parcial" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Valor pago (€)</Label>
                    <Input type="number" step="0.01" min="0" value={valorPago} onChange={(e) => setValorPago(e.target.value)} placeholder="0.00" />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={isSaving} className="gap-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar Agendamento
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

