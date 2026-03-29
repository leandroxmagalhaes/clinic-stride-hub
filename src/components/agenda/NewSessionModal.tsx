// NewSessionModal v5 — 5-step scheduling wizard (Patient First)
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarIcon, Clock, Check, UserPlus, Loader2, Package, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/auth-helpers";
import { checkAppointmentCreatedTrigger } from "@/services/AutomationEngine";

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
  quantidade_sessoes: number;
  sessoes_usadas: number;
  valor_total: number;
  payment_status: string;
  is_active: boolean;
  notes: string | null;
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
    for (const m of [0, 30]) {
      if (h === 21 && m > 30) break;
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
})();

const STEP_NAMES = ["Paciente", "Tipo", "Datas", "Detalhes", "Confirmação"];

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

  // ── Step 1: Patient ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activePacks, setActivePacks] = useState<ActivePack[]>([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Step 2: Type ──
  const [tipoAgendamento, setTipoAgendamento] = useState<"avulso" | "pack_existente" | "novo_pack">("avulso");
  const [quantidade, setQuantidade] = useState(1);
  const [customQty, setCustomQty] = useState("");
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const [novoPackValor, setNovoPackValor] = useState("");
  const [novoPackPago, setNovoPackPago] = useState(false);

  // ── Step 3: Dates ──
  const [sessionSlots, setSessionSlots] = useState<SessionSlot[]>([]);

  // ── Step 4: Details ──
  const [selectedServico, setSelectedServico] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [notes, setNotes] = useState("");

  // ── Saving ──
  const [isSaving, setIsSaving] = useState(false);

  // ── Reset on open ──
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedPatient(null);
      setActivePacks([]);
      setShowQuickCreate(false);
      setQuickName("");
      setQuickPhone("");
      setQuickEmail("");
      setTipoAgendamento("avulso");
      setQuantidade(1);
      setCustomQty("");
      setSelectedPackId("");
      setNovoPackValor("");
      setNovoPackPago(false);
      setSessionSlots([]);
      setSelectedServico("");
      setSelectedProfissional("");
      setNotes("");
      setShowDropdown(false);
    }
  }, [isOpen]);

  // ── Build session slots when quantity changes or entering step 3 ──
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

  // ── Patient search with debounce ──
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
          // Check active packs for each result
          const patientIds = data.map((p: any) => p.id);
          const { data: packsData } = await (supabase as any)
            .from("packs")
            .select("paciente_id")
            .in("paciente_id", patientIds)
            .eq("is_active", true);
          
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

  // ── Fetch active packs when patient selected ──
  const fetchActivePacks = useCallback(async (patientId: string) => {
    try {
      const { data } = await (supabase as any)
        .from("packs")
        .select("id, numero_pack, quantidade_sessoes, sessoes_usadas, valor_total, payment_status, is_active, notes")
        .eq("paciente_id", patientId)
        .eq("is_active", true);
      setActivePacks(data || []);
    } catch (err) {
      console.error("Error fetching packs:", err);
      setActivePacks([]);
    }
  }, []);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setShowDropdown(false);
    fetchActivePacks(patient.id);
  }, [fetchActivePacks]);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setActivePacks([]);
    setTipoAgendamento("avulso");
    setSelectedPackId("");
  }, []);

  // ── Quick patient create ──
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

  // ── Get selected pack data ──
  const selectedPack = useMemo(() => activePacks.find((p) => p.id === selectedPackId), [activePacks, selectedPackId]);

  // ── Auto-select single pack ──
  useEffect(() => {
    if (tipoAgendamento === "pack_existente" && activePacks.length === 1) {
      setSelectedPackId(activePacks[0].id);
      const remaining = activePacks[0].quantidade_sessoes - activePacks[0].sessoes_usadas;
      setQuantidade(Math.max(1, remaining));
    }
  }, [tipoAgendamento, activePacks]);

  // ── When selecting a pack, set quantity to remaining ──
  useEffect(() => {
    if (selectedPack) {
      const remaining = selectedPack.quantidade_sessoes - selectedPack.sessoes_usadas;
      setQuantidade(Math.max(1, remaining));
    }
  }, [selectedPack]);

  // ── Quantity helpers ──
  const handleQtyButton = (n: number) => {
    setQuantidade(n);
    setCustomQty("");
  };
  const handleCustomQty = (val: string) => {
    setCustomQty(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1 && n <= 50) setQuantidade(n);
  };

  // ── Update slot ──
  const updateSlot = useCallback((index: number, field: keyof SessionSlot, value: string) => {
    setSessionSlots((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, []);

  // ── Validation per step ──
  const canAdvance1 = !!selectedPatient;
  const canAdvance2 = (() => {
    if (tipoAgendamento === "avulso") return quantidade >= 1;
    if (tipoAgendamento === "pack_existente") return !!selectedPackId;
    if (tipoAgendamento === "novo_pack") return quantidade >= 1;
    return false;
  })();
  const canAdvance3 = sessionSlots.length > 0 && sessionSlots.every((s) => s.date && s.time);
  const canAdvance4 = !!selectedServico && !!selectedProfissional;

  const filledCount = sessionSlots.filter((s) => s.date && s.time).length;

  // ── Initials avatar ──
  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "?").toUpperCase();
  };

  // ── Confirm ──
  const handleConfirm = async () => {
    if (!selectedPatient) return;
    setIsSaving(true);
    try {
      const { clinicId, userId } = await getAuthContext();
      const selectedService = services.find((s) => s.id === selectedServico);
      const durationMin = selectedService?.duration_minutes || 60;

      let packageId: string | null = null;
      const packGrupoId = quantidade >= 2 ? crypto.randomUUID() : null;

      // If "novo_pack", create pack first
      if (tipoAgendamento === "novo_pack") {
        const { data: packData, error: packError } = await (supabase as any)
          .from("packs")
          .insert({
            clinic_id: clinicId,
            paciente_id: selectedPatient.id,
            data_inicio: sessionSlots[0]?.date || format(new Date(), "yyyy-MM-dd"),
            quantidade_sessoes: quantidade,
            sessoes_usadas: 0,
            valor_total: parseFloat(novoPackValor) || 0,
            payment_status: novoPackPago ? "pago" : "pendente",
            is_active: true,
          })
          .select("id")
          .single();
        if (packError) throw packError;
        packageId = packData.id;
      }

      // If "pack_existente", use the selected pack
      if (tipoAgendamento === "pack_existente" && selectedPackId) {
        packageId = selectedPackId;
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
          price: selectedService ? Number(selectedService.price) : 0,
          payment_status: "pendente",
          tipo_agendamento: tipoAgendamento === "pack_existente" ? "pack" : tipoAgendamento === "novo_pack" ? "pack" : "avulso",
          pack_grupo_id: packGrupoId,
          package_id: packageId,
          created_by: userId,
        }).select("id").single();

        if (error) throw error;

        // Automation trigger
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

      // Update pack sessoes_usadas if pack_existente
      if (tipoAgendamento === "pack_existente" && selectedPack) {
        await (supabase as any)
          .from("packs")
          .update({ sessoes_usadas: selectedPack.sessoes_usadas + quantidade })
          .eq("id", selectedPackId);
      }

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

  // ── Lookup helpers for confirmation ──
  const serviceName = services.find((s) => s.id === selectedServico)?.name || "";
  const professionalName = professionals.find((p) => p.id === selectedProfissional)?.full_name || "";

  const typeBadge = useMemo(() => {
    if (tipoAgendamento === "avulso") return { label: `Avulsa — ${quantidade} sessão${quantidade > 1 ? "ões" : ""}`, className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    if (tipoAgendamento === "pack_existente") return { label: `Pack existente — ${quantidade} sessão${quantidade > 1 ? "ões" : ""}`, className: "bg-green-100 text-green-800 border-green-200" };
    return { label: `Novo pack — ${quantidade} sessão${quantidade > 1 ? "ões" : ""}`, className: "bg-blue-100 text-blue-800 border-blue-200" };
  }, [tipoAgendamento, quantidade]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <div>
              <div>Novo Agendamento</div>
              <div className="text-xs font-normal text-muted-foreground">Passo {step} de 5 — {STEP_NAMES[step - 1]}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ── 5-segment progress bar ── */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step ? "bg-[#3b82f6]" : "bg-[#e2e8f0]"
              )}
            />
          ))}
        </div>

        {/* ═══════════ STEP 1: Paciente ═══════════ */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {!selectedPatient ? (
              <>
                {/* Search input */}
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

                {/* Search results dropdown */}
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
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Pack activo</Badge>
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

                {/* Quick create link */}
                {!showQuickCreate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setShowQuickCreate(true)}
                  >
                    <UserPlus className="h-3 w-3" /> Criar paciente rápido
                  </Button>
                )}

                {/* Quick create form */}
                {showQuickCreate && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <Label className="text-xs font-medium">Novo Paciente</Label>
                    <Input placeholder="Nome completo *" value={quickName} onChange={(e) => setQuickName(e.target.value)} autoFocus />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Telefone" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} />
                      <Input placeholder="Email" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleQuickCreate} disabled={isCreatingPatient} className="gap-1">
                        {isCreatingPatient ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                        Criar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowQuickCreate(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selected patient card */}
                <div className="p-4 rounded-lg border bg-card flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {getInitials(selectedPatient.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{selectedPatient.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[selectedPatient.phone, selectedPatient.email].filter(Boolean).join(" • ") || "Sem contacto"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearPatient} className="text-xs">
                    Alterar
                  </Button>
                </div>

                {/* Active pack banner */}
                {activePacks.length > 0 && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                    Pack activo detectado — será pré-seleccionado no passo seguinte
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} disabled={!canAdvance1} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 2: Tipo de Agendamento ═══════════ */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            {/* Card: Avulso */}
            <button
              type="button"
              onClick={() => { setTipoAgendamento("avulso"); setSelectedPackId(""); }}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all",
                tipoAgendamento === "avulso" ? "border-[#3b82f6] bg-blue-50/50" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="font-semibold text-sm">Avulso</div>
              <p className="text-xs text-muted-foreground mt-0.5">Sessão individual ou em série (recorrência)</p>
            </button>
            {tipoAgendamento === "avulso" && (
              <div className="pl-4 space-y-2">
                <Label className="text-xs">Quantidade de sessões</Label>
                <div className="flex items-center gap-2">
                  {[1, 5, 10, 20].map((n) => (
                    <Button key={n} type="button" variant={quantidade === n && !customQty ? "default" : "outline"} size="sm" onClick={() => handleQtyButton(n)} className="min-w-[36px]">
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
                    className="w-20 text-center h-9"
                  />
                </div>
              </div>
            )}

            {/* Card: Pack existente — only if active packs */}
            {activePacks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setTipoAgendamento("pack_existente")}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all",
                    tipoAgendamento === "pack_existente" ? "border-[#3b82f6] bg-blue-50/50" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <Package className="h-4 w-4" /> Pack existente
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Associar sessões a um pack activo</p>
                </button>
                {tipoAgendamento === "pack_existente" && (
                  <div className="pl-4 space-y-2">
                    {activePacks.map((pack) => {
                      const remaining = pack.quantidade_sessoes - pack.sessoes_usadas;
                      const progress = (pack.sessoes_usadas / pack.quantidade_sessoes) * 100;
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => { setSelectedPackId(pack.id); }}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border-2 transition-all",
                            selectedPackId === pack.id ? "border-green-500 bg-green-50/50" : "border-border"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Pack #{pack.numero_pack}</span>
                            <div className="flex gap-1">
                              <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">Activo</Badge>
                              <Badge className={cn("text-[10px]", pack.payment_status === "pago" ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200")}>
                                {pack.payment_status === "pago" ? "Pago" : "Pendente"}
                              </Badge>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Progress value={progress} className="h-1.5" />
                            <div className="text-xs text-muted-foreground">
                              {pack.sessoes_usadas}/{pack.quantidade_sessoes} usadas • <span className="font-medium">{remaining} restantes</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Card: Criar novo pack */}
            <button
              type="button"
              onClick={() => { setTipoAgendamento("novo_pack"); setSelectedPackId(""); }}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all",
                tipoAgendamento === "novo_pack" ? "border-[#3b82f6] bg-blue-50/50" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <Package className="h-4 w-4" /> Criar novo pack
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Pack pré-pago — pagamento antecipado ou na 1ª sessão</p>
            </button>
            {tipoAgendamento === "novo_pack" && (
              <div className="pl-4 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Quantidade de sessões</Label>
                  <div className="flex items-center gap-2">
                    {[1, 5, 10, 20].map((n) => (
                      <Button key={n} type="button" variant={quantidade === n && !customQty ? "default" : "outline"} size="sm" onClick={() => handleQtyButton(n)} className="min-w-[36px]">
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
                      className="w-20 text-center h-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Valor total do pack (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={novoPackValor}
                    onChange={(e) => setNovoPackValor(e.target.value)}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={novoPackPago} onCheckedChange={setNovoPackPago} />
                  <Label className="text-xs">{novoPackPago ? "Pago" : "Pagamento pendente"}</Label>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canAdvance2} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 3: Datas e Horários ═══════════ */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {/* Contextual banner */}
            <div className={cn(
              "p-3 rounded-lg text-sm",
              tipoAgendamento === "avulso" && "bg-muted text-muted-foreground",
              tipoAgendamento === "pack_existente" && "bg-green-50 text-green-700 border border-green-200",
              tipoAgendamento === "novo_pack" && "bg-blue-50 text-blue-700 border border-blue-200",
            )}>
              {tipoAgendamento === "avulso" && `${quantidade} sessão${quantidade > 1 ? "ões" : ""} avulsa${quantidade > 1 ? "s" : ""} — preencha as datas`}
              {tipoAgendamento === "pack_existente" && `Pack com ${quantidade} sessão${quantidade > 1 ? "ões" : ""} restante${quantidade > 1 ? "s" : ""} — preencha as datas`}
              {tipoAgendamento === "novo_pack" && `Novo pack com ${quantidade} sessão${quantidade > 1 ? "ões" : ""} — preencha as datas`}
            </div>

            {/* Session date rows */}
            <div className={cn(quantidade > 6 && "max-h-[360px] overflow-y-auto pr-1", "space-y-2")}>
              {sessionSlots.map((slot, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border bg-card",
                    (!slot.date || !slot.time) && "border-yellow-300"
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[60px]">
                    Sessão {i + 1}
                  </span>
                  <Input
                    type="date"
                    value={slot.date}
                    onChange={(e) => updateSlot(i, "date", e.target.value)}
                    className="h-9 flex-1"
                  />
                  <Select value={slot.time} onValueChange={(v) => updateSlot(i, "time", v)}>
                    <SelectTrigger className="w-[100px] h-9">
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

            <p className="text-xs text-muted-foreground text-center">
              {filledCount} de {quantidade} sessões com data preenchida
            </p>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(4)} disabled={!canAdvance3} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 4: Detalhes ═══════════ */}
        {step === 4 && (
          <div className="space-y-4 py-2">
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
                        <span className="text-muted-foreground text-xs">({s.duration_minutes}min)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas ou observações..." rows={2} />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(5)} disabled={!canAdvance4} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 5: Confirmação ═══════════ */}
        {step === 5 && selectedPatient && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg border bg-card space-y-4">
              {/* Patient */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {getInitials(selectedPatient.full_name)}
                </div>
                <div>
                  <div className="font-medium text-sm">{selectedPatient.full_name}</div>
                  {selectedPatient.phone && <div className="text-xs text-muted-foreground">{selectedPatient.phone}</div>}
                </div>
              </div>

              {/* Type badge */}
              <div>
                <span className="text-xs text-muted-foreground">Tipo</span>
                <div className="mt-0.5">
                  <Badge className={cn("text-xs", typeBadge.className)}>{typeBadge.label}</Badge>
                </div>
              </div>

              {/* Service & Professional */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Serviço</span>
                  <div className="text-sm font-medium mt-0.5">{serviceName}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Profissional</span>
                  <div className="text-sm font-medium mt-0.5">{professionalName}</div>
                </div>
              </div>

              {/* Pack value */}
              {tipoAgendamento === "novo_pack" && novoPackValor && (
                <div>
                  <span className="text-xs text-muted-foreground">Valor do pack</span>
                  <div className="text-sm font-medium mt-0.5">
                    €{parseFloat(novoPackValor).toFixed(2)} {novoPackPago ? "(Pago)" : "(Pendente)"}
                  </div>
                </div>
              )}

              {/* Sessions table */}
              <div>
                <span className="text-xs text-muted-foreground">Sessões</span>
                <div className="mt-1 rounded-md border overflow-hidden">
                  {sessionSlots.map((slot, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm",
                        i % 2 === 0 ? "bg-muted/30" : "bg-card"
                      )}
                    >
                      <span className="text-muted-foreground">Sessão {i + 1}</span>
                      <span className="font-medium">
                        {slot.date ? format(new Date(slot.date + "T00:00:00"), "dd/MM/yyyy") : "—"} às {slot.time || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {notes && (
                <div>
                  <span className="text-xs text-muted-foreground">Observações</span>
                  <div className="text-sm mt-0.5">{notes}</div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(4)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSaving}
                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
              >
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
