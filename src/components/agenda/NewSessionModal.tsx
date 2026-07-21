// NewSessionModal v6 — Tela única adaptativa (Fase 3)
// Substitui o assistente de 5 passos por um formulário único e inteligente:
// • Paciente no topo; ao selecionar, o resto da tela se adapta
// • Pack ativo detectado e vinculado automaticamente (regra: pack sem especialidade)
// • Checkbox "Cobrar avulso" para exceções; criação de novo pack inline
// • Serviço e profissional pré-preenchidos com base na última sessão do paciente
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Check, UserPlus, Loader2, Package, Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";
import { checkAppointmentCreatedTrigger } from "@/services/AutomationEngine";

// Mantido para compatibilidade com importações existentes
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
  phone?: string | null;
  email?: string | null;
  health_tags?: string[];
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

interface ActivePack {
  id: string;
  numero_pack: number;
  total_sessoes: number;
  sessoes_usadas: number;
  valor_total: number;
  payment_status: string;
  data_validade: string | null;
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
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
}

const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 45) break;
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
})();

const QTY_PRESETS = [1, 2, 5, 10];

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
  // ── Paciente ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Criação rápida de paciente
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);

  // ── Packs ──
  const [activePacks, setActivePacks] = useState<ActivePack[]>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const [cobrarAvulso, setCobrarAvulso] = useState(false);
  const [showNewPack, setShowNewPack] = useState(false);
  const [novoPackSessoes, setNovoPackSessoes] = useState("10");
  const [novoPackValor, setNovoPackValor] = useState("");
  const [novoPackPago, setNovoPackPago] = useState(false);

  // ── Sessões ──
  const [quantidade, setQuantidade] = useState(1);
  const [customQty, setCustomQty] = useState("");
  const [sessionSlots, setSessionSlots] = useState<SessionSlot[]>([]);

  // ── Detalhes ──
  const [selectedServico, setSelectedServico] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [sessionPrice, setSessionPrice] = useState<string>("");
  const [patientPrecoConsulta, setPatientPrecoConsulta] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [semCobranca, setSemCobranca] = useState(false);
  const [motivoSemCobranca, setMotivoSemCobranca] = useState<string>("Cortesia");

  const [isSaving, setIsSaving] = useState(false);

  // ── Reset ao abrir ──
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedPatient(null);
      setShowDropdown(false);
      setShowQuickCreate(false);
      setQuickName("");
      setQuickPhone("");
      setQuickEmail("");
      setActivePacks([]);
      setSelectedPackId("");
      setCobrarAvulso(false);
      setShowNewPack(false);
      setNovoPackSessoes("10");
      setNovoPackValor("");
      setNovoPackPago(false);
      setQuantidade(1);
      setCustomQty("");
      setSessionSlots([]);
      setSelectedServico("");
      setSelectedProfissional("");
      setSessionPrice("");
      setPatientPrecoConsulta(null);
      setNotes("");
      setSemCobranca(false);
      setMotivoSemCobranca("Cortesia");
    }
  }, [isOpen]);

  // ── Slots conforme a quantidade ──
  useEffect(() => {
    if (quantidade < 1) return;
    setSessionSlots((prev) => {
      const slots: SessionSlot[] = [];
      for (let i = 0; i < quantidade; i++) {
        if (prev[i]) {
          slots.push(prev[i]);
        } else if (i === 0 && selectedSlot) {
          slots.push({
            date: format(selectedSlot.date, "yyyy-MM-dd"),
            time: `${String(selectedSlot.hour).padStart(2, "0")}:${String(selectedSlot.minute ?? 0).padStart(2, "0")}`,
          });
        } else {
          slots.push({ date: "", time: "" });
        }
      }
      return slots;
    });
  }, [quantidade, selectedSlot]);

  // ── Busca de paciente com debounce ──
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from("pacientes")
          .select("id, full_name, phone, email")
          .ilike("full_name", `%${searchQuery}%`)
          .eq("is_active", true)
          .limit(10);

        if (data) {
          const patientIds = data.map((p: any) => p.id);
          const { data: packsData } = await (supabase as any)
            .from("packs")
            .select("paciente_id")
            .in("paciente_id", patientIds)
            .eq("status", "ativo");

          const patientsWithPacks = new Set((packsData || []).map((p: any) => p.paciente_id));

          setSearchResults(data.map((p: any) => ({
            ...p,
            _hasActivePack: patientsWithPacks.has(p.id),
          })));
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // ── Packs ativos do paciente ──
  const fetchActivePacks = useCallback(async (patientId: string) => {
    setIsLoadingPacks(true);
    try {
      const { data: packsData } = await (supabase as any)
        .from("packs")
        .select("id, numero_pack, total_sessoes, valor_total, payment_status, data_validade")
        .eq("paciente_id", patientId)
        .eq("status", "ativo")
        .order("numero_pack", { ascending: false });
      const packIds = (packsData || []).map((p: any) => p.id);
      const usageMap: Record<string, number> = {};
      if (packIds.length > 0) {
        const { data: sessRows } = await (supabase as any)
          .from("sessoes")
          .select("pack_id, status, isento")
          .in("pack_id", packIds);
        (sessRows || []).forEach((s: any) => {
          if (s.isento) return;
          if (!["realizado", "finalizado", "falta_cobrada"].includes(s.status)) return;
          usageMap[s.pack_id] = (usageMap[s.pack_id] || 0) + 1;
        });
      }
      const packs: ActivePack[] = (packsData || []).map((p: any) => ({
        id: p.id,
        numero_pack: p.numero_pack,
        total_sessoes: p.total_sessoes,
        sessoes_usadas: usageMap[p.id] || 0,
        valor_total: p.valor_total,
        payment_status: p.payment_status,
        data_validade: p.data_validade,
      }));
      setActivePacks(packs);
      // Vínculo automático: pack mais recente com saldo
      const withBalance = packs.find((p) => p.sessoes_usadas < p.total_sessoes);
      setSelectedPackId(withBalance ? withBalance.id : "");
    } catch (err) {
      console.error("Error fetching packs:", err);
      setActivePacks([]);
      setSelectedPackId("");
    } finally {
      setIsLoadingPacks(false);
    }
  }, []);

  // ── Pré-preencher serviço/profissional da última sessão ──
  const prefillFromLastSession = useCallback(async (patientId: string) => {
    try {
      const { data } = await (supabase as any)
        .from("sessoes")
        .select("servico_id, profissional_id")
        .eq("paciente_id", patientId)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.servico_id && services.some((s) => s.id === data.servico_id)) {
        setSelectedServico((cur) => cur || data.servico_id);
      }
      if (data?.profissional_id && professionals.some((p) => p.id === data.profissional_id)) {
        setSelectedProfissional((cur) => cur || data.profissional_id);
      }
    } catch (err) {
      console.error("Prefill error:", err);
    }
  }, [services, professionals]);

  // ── Auto-preencher valor: preco_consulta do paciente > preço do serviço ──
  useEffect(() => {
    if (patientPrecoConsulta !== null && patientPrecoConsulta !== undefined) {
      setSessionPrice(String(patientPrecoConsulta));
      return;
    }
    if (!selectedServico) return;
    const svc = services.find((s) => s.id === selectedServico);
    if (svc && svc.price !== undefined && svc.price !== null) {
      setSessionPrice(String(svc.price));
    }
  }, [selectedServico, services, patientPrecoConsulta]);

  const handleSelectPatient = useCallback(async (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setShowDropdown(false);
    fetchActivePacks(patient.id);
    prefillFromLastSession(patient.id);
    try {
      const { data } = await (supabase as any)
        .from("pacientes")
        .select("preco_consulta")
        .eq("id", patient.id)
        .maybeSingle();
      const pc = data?.preco_consulta;
      setPatientPrecoConsulta(pc !== null && pc !== undefined ? Number(pc) : null);
    } catch {
      setPatientPrecoConsulta(null);
    }
  }, [fetchActivePacks, prefillFromLastSession]);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setActivePacks([]);
    setSelectedPackId("");
    setCobrarAvulso(false);
    setShowNewPack(false);
    setPatientPrecoConsulta(null);
  }, []);

  // ── Criação rápida de paciente ──
  const handleQuickCreate = async () => {
    if (!quickName.trim()) { toast.error("Nome é obrigatório"); return; }
    setIsCreatingPatient(true);
    try {
      const { clinicId } = await getAuthContext();
      const insertData: any = {
        full_name: quickName.trim(),
        clinic_id: clinicId,
        is_active: true,
        health_tags: [],
        privacy_consent_at: new Date().toISOString(),
      };
      if (quickPhone.trim()) insertData.phone = quickPhone.trim();
      if (quickEmail.trim()) insertData.email = quickEmail.trim();
      const { data, error } = await supabase.from("pacientes").insert(insertData).select().single();
      if (error) throw error;
      const created: Patient = { id: (data as any).id, full_name: (data as any).full_name, phone: (data as any).phone, email: (data as any).email };
      onPatientCreated?.(created);
      handleSelectPatient(created);
      setShowQuickCreate(false);
      setQuickName("");
      setQuickPhone("");
      setQuickEmail("");
      toast.success(`Paciente "${created.full_name}" criado!`);
    } catch (error: any) {
      toast.error("Erro: " + (error.message || "Tente novamente"));
    } finally {
      setIsCreatingPatient(false);
    }
  };

  // ── Derivados ──
  const linkedPack = useMemo(
    () => (!cobrarAvulso && !showNewPack ? activePacks.find((p) => p.id === selectedPackId) : undefined),
    [activePacks, selectedPackId, cobrarAvulso, showNewPack],
  );
  const packRestantes = linkedPack ? linkedPack.total_sessoes - linkedPack.sessoes_usadas : 0;
  const excedePack = !!linkedPack && quantidade > packRestantes;
  const packPago = useMemo(
    () => !!linkedPack && linkedPack.payment_status === "pago" && !cobrarAvulso,
    [linkedPack, cobrarAvulso],
  );

  const handleQtyButton = (n: number) => {
    setQuantidade(n);
    setCustomQty("");
  };
  const handleCustomQty = (val: string) => {
    setCustomQty(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1 && n <= 50) setQuantidade(n);
  };

  const updateSlot = useCallback((index: number, field: keyof SessionSlot, value: string) => {
    setSessionSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "?").toUpperCase();
  };

  const slotsOk = sessionSlots.length > 0 && sessionSlots.every((s) => s.date && s.time);
  const novoPackOk = !showNewPack || (parseInt(novoPackSessoes, 10) >= 1);
  const canConfirm = !!selectedPatient && slotsOk && !!selectedServico && !!selectedProfissional && novoPackOk && !isSaving;

  // ── Confirmar ──
  const handleConfirm = async () => {
    if (!selectedPatient) return;
    setIsSaving(true);
    try {
      const { clinicId, userId } = await getAuthContext();
      const selectedService = services.find((s) => s.id === selectedServico);
      const durationMin = selectedService?.duration_minutes || 60;

      let packId: string | null = null;

      if (showNewPack) {
        // Criar novo pack inline
        const { data: packData, error: packError } = await (supabase as any)
          .from("packs")
          .insert({
            clinic_id: clinicId,
            paciente_id: selectedPatient.id,
            data_inicio: sessionSlots[0]?.date || format(new Date(), "yyyy-MM-dd"),
            total_sessoes: parseInt(novoPackSessoes, 10) || quantidade,
            valor_total: parseFloat(novoPackValor) || 0,
            payment_status: novoPackPago ? "pago" : "pendente",
            status: "ativo",
          })
          .select("id")
          .single();
        if (packError) throw packError;
        packId = packData.id;
      } else if (!cobrarAvulso && linkedPack) {
        packId = linkedPack.id;
      }

      for (let i = 0; i < sessionSlots.length; i++) {
        const slot = sessionSlots[i];
        if (!slot.date || !slot.time) continue;

        const [h, m] = slot.time.split(":").map(Number);
        const startTime = new Date(slot.date + "T00:00:00");
        startTime.setHours(h, m, 0, 0);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMin);

        const isPast = startTime < new Date();

        const { data: insertedSession, error } = await supabase.from("sessoes").insert({
          clinic_id: clinicId,
          paciente_id: selectedPatient.id,
          profissional_id: selectedProfissional,
          servico_id: selectedServico,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: isPast ? "realizado" : "agendado",
          notes: notes || null,
          price: semCobranca ? 0 : (sessionPrice !== "" ? (parseFloat(sessionPrice) || 0) : (selectedService ? Number(selectedService.price) : 0)),
          payment_status: semCobranca ? "pago" : "pendente",
          sem_cobranca: semCobranca,
          motivo_sem_cobranca: semCobranca ? motivoSemCobranca : null,
          tipo_agendamento: packId ? "pack" : "avulso",
          pack_id: packId,
          created_by: userId,
        } as any).select("id").single();

        if (error) throw error;

        if (insertedSession?.id) {
          const selectedProf = professionals.find((p) => p.id === selectedProfissional);
          checkAppointmentCreatedTrigger({
            patientName: selectedPatient.full_name,
            professionalName: selectedProf?.full_name || "",
            serviceName: selectedService?.name,
            date: startTime,
            hour: h,
            sessaoId: insertedSession.id,
            pacienteId: selectedPatient.id,
            clinicId,
          }).catch((err) => console.error("Automation trigger error:", err));
        }
      }
      // O consumo do pack é recalculado por triggers no banco

      toast.success(`${quantidade} sessão${quantidade > 1 ? "ões" : ""} agendada${quantidade > 1 ? "s" : ""} para ${selectedPatient.full_name}`);
      onSessionsCreated?.();
      onClose();
    } catch (error: any) {
      console.error("Error creating sessions:", error);
      toast.error(error.message || "Erro ao agendar sessões");
    } finally {
      setIsSaving(false);
    }
  };

  const formatValidade = (d: string | null) => {
    if (!d) return null;
    try { return format(new Date(d + "T00:00:00"), "dd/MM/yyyy"); } catch { return d; }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ═══ PACIENTE ═══ */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Paciente</Label>
            {!selectedPatient ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar paciente por nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {showDropdown && (
                  <div className="border rounded-lg max-h-[200px] overflow-y-auto bg-card shadow-sm">
                    {searchResults.length > 0 ? (
                      searchResults.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center justify-between border-b last:border-b-0 transition-colors"
                        >
                          <div>
                            <div className="text-sm font-medium">{p.full_name}</div>
                            {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                          </div>
                          {p._hasActivePack && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Pack ativo</Badge>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum resultado</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 gap-1 text-xs"
                          onClick={() => {
                            setShowQuickCreate(true);
                            setQuickName(searchQuery);
                            setShowDropdown(false);
                          }}
                        >
                          <UserPlus className="h-3 w-3" /> Criar paciente rápido
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {!showQuickCreate && !showDropdown && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground"
                    onClick={() => setShowQuickCreate(true)}
                  >
                    <UserPlus className="h-3 w-3" /> Novo paciente
                  </Button>
                )}

                {showQuickCreate && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <Input placeholder="Nome completo *" value={quickName} onChange={(e) => setQuickName(e.target.value)} autoFocus />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Telefone" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} />
                      <Input placeholder="E-mail" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowQuickCreate(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleQuickCreate} disabled={isCreatingPatient} className="gap-1">
                        {isCreatingPatient ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Criar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    {getInitials(selectedPatient.full_name)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{selectedPatient.full_name}</div>
                    {selectedPatient.phone && <div className="text-xs text-muted-foreground">{selectedPatient.phone}</div>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearPatient}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </section>

          {/* O resto da tela aparece quando há paciente — adaptativo */}
          {selectedPatient && (
            <>
              {/* ═══ PACK (automático) ═══ */}
              <section className="space-y-2">
                {isLoadingPacks ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verificando packs...
                  </div>
                ) : linkedPack ? (
                  <div className="border border-green-200 bg-green-50 rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-900">
                        <Package className="h-4 w-4" />
                        Pack {linkedPack.numero_pack} — {linkedPack.sessoes_usadas}/{linkedPack.total_sessoes} usadas
                      </div>
                      <Badge className={cn("text-[10px]", linkedPack.payment_status === "pago" ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200")}>
                        {linkedPack.payment_status === "pago" ? "Pago" : "Pagamento pendente"}
                      </Badge>
                    </div>
                    <div className="text-xs text-green-800">
                      {packRestantes} restante{packRestantes !== 1 ? "s" : ""}
                      {linkedPack.data_validade ? ` · válido até ${formatValidade(linkedPack.data_validade)}` : ""}
                      {" · "}próxima sessão será {linkedPack.sessoes_usadas + 1}/{linkedPack.total_sessoes}
                    </div>
                    {activePacks.length > 1 && (
                      <Select value={selectedPackId} onValueChange={setSelectedPackId}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activePacks.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              Pack {p.numero_pack} — {p.sessoes_usadas}/{p.total_sessoes}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {excedePack && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Atenção: {quantidade} sessões excedem o saldo do pack ({packRestantes}). As excedentes ficarão sem vínculo de pack no consumo.
                      </div>
                    )}
                  </div>
                ) : !showNewPack ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground border rounded-lg px-3 py-2">
                    <span>
                      {cobrarAvulso
                        ? "Sessão avulsa (fora do pack)"
                        : activePacks.length > 0
                          ? "Pack ativo sem saldo — sessão será avulsa"
                          : "Sem pack ativo — sessão avulsa"}
                    </span>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowNewPack(true)}>
                      <Plus className="h-3 w-3" /> Criar pack
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" /> Novo pack
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewPack(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nº de sessões</Label>
                        <Input type="number" min={1} max={50} value={novoPackSessoes} onChange={(e) => setNovoPackSessoes(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor total (€)</Label>
                        <Input type="number" min={0} step="0.01" placeholder="0,00" value={novoPackValor} onChange={(e) => setNovoPackValor(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={novoPackPago} onCheckedChange={setNovoPackPago} id="novo-pack-pago" />
                      <Label htmlFor="novo-pack-pago" className="text-xs">Já está pago</Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Validade: 3 meses a partir da primeira sessão (ajustável depois no painel de Packs).</p>
                  </div>
                )}

                {(linkedPack || cobrarAvulso) && !showNewPack && (
                  <div className="flex items-center gap-2 pl-1">
                    <Checkbox
                      id="cobrar-avulso"
                      checked={cobrarAvulso}
                      onCheckedChange={(v) => setCobrarAvulso(v === true)}
                    />
                    <Label htmlFor="cobrar-avulso" className="text-xs text-muted-foreground cursor-pointer">
                      Cobrar avulso (fora do pack)
                    </Label>
                  </div>
                )}
              </section>

              {/* ═══ SESSÕES ═══ */}
              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sessões</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {QTY_PRESETS.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={quantidade === n && !customQty ? "default" : "outline"}
                      size="sm"
                      className="w-10"
                      onClick={() => handleQtyButton(n)}
                    >
                      {n}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="Outro"
                    value={customQty}
                    onChange={(e) => handleCustomQty(e.target.value)}
                    className="w-20 h-9"
                  />
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {sessionSlots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {quantidade > 1 && (
                        <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                      )}
                      <Input
                        type="date"
                        value={slot.date}
                        onChange={(e) => updateSlot(i, "date", e.target.value)}
                        className="flex-1"
                      />
                      <Select value={slot.time} onValueChange={(v) => updateSlot(i, "time", v)}>
                        <SelectTrigger className="w-[110px]">
                          <SelectValue placeholder="Hora" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </section>

              {/* ═══ DETALHES ═══ */}
              <section className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Detalhes</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Serviço *</Label>
                    <Select value={selectedServico} onValueChange={setSelectedServico}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Profissional *</Label>
                    <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {professionals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1 max-w-[180px]">
                  <Label className="text-xs">Valor por sessão (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    value={semCobranca ? "0" : sessionPrice}
                    onChange={(e) => setSessionPrice(e.target.value)}
                    disabled={semCobranca}
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch id="sem-cobranca" checked={semCobranca} onCheckedChange={setSemCobranca} />
                    <Label htmlFor="sem-cobranca" className="text-xs cursor-pointer">Sem cobrança</Label>
                  </div>
                  {semCobranca && (
                    <Select value={motivoSemCobranca} onValueChange={setMotivoSemCobranca}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cortesia">Cortesia</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="Ação social">Ação social</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Textarea
                  placeholder="Observações (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </section>

              {/* ═══ RODAPÉ ═══ */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t">
                <div className="text-xs text-muted-foreground">
                  {quantidade} sessão{quantidade > 1 ? "ões" : ""}
                  {linkedPack ? ` · Pack ${linkedPack.numero_pack}` : showNewPack ? " · novo pack" : " · avulso"}
                </div>
                <Button onClick={handleConfirm} disabled={!canConfirm} className="gap-2 min-w-[140px]">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Agendar{quantidade > 1 ? ` (${quantidade})` : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
