import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  PenLine,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BatchSchedulingService, ParsedRow, MatchConfidence, NamedEntity } from "@/services/BatchSchedulingService";
import type { Json } from "@/integrations/supabase/types";

interface BatchSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Array<{ id: string; full_name: string }>;
  professionals: Array<{ id: string; full_name: string }>;
  services: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
    consumes_credit?: boolean;
  }>;
  clinicId: string;
  onSessionsCreated: () => Promise<void>;
}

type Step = "upload" | "review" | "confirm";

// ── Linha manual ──────────────────────────────────────────────────────────────
interface ManualRow {
  id: string;
  patientSearch: string;
  patientId: string;
  patientName: string;
  date: string;
  hour: string;
  minute: string;
  serviceId: string;
  professionalId: string;
  showSuggestions: boolean;
}

function emptyManualRow(defaultProfId: string): ManualRow {
  return {
    id: `mr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    patientSearch: "",
    patientId: "",
    patientName: "",
    date: "",
    hour: "09",
    minute: "00",
    serviceId: "",
    professionalId: defaultProfId,
    showSuggestions: false,
  };
}

const HOURS = Array.from({ length: 15 }, (_, i) => String(i + 7).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const BATCH_SIZE = 50;

function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  switch (confidence) {
    case "exato":
      return (
        <Badge variant="default" className="text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" /> Exato
        </Badge>
      );
    case "sugestao":
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <AlertTriangle className="h-3 w-3" /> Sugestão
        </Badge>
      );
    case "sem_match":
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" /> Sem match
        </Badge>
      );
  }
}

function EntitySelect({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: NamedEntity[];
  onChange: (id: string, name: string) => void;
}) {
  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => {
        if (v === "__none__") return;
        const e = options.find((o) => o.id === v);
        if (e) onChange(e.id, e.name);
      }}
    >
      <SelectTrigger className="h-8 text-xs w-[160px]">
        <SelectValue placeholder="Selecionar..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function rowToRawData(row: ParsedRow): Json {
  return {
    rowIndex: row.rowIndex,
    rawPaciente: row.rawPaciente,
    rawProfissional: row.rawProfissional,
    rawServico: row.rawServico,
    rawData: row.rawData,
    rawHora: row.rawHora,
    rawMinuto: row.rawMinuto,
    rawObservacoes: row.rawObservacoes,
    pacienteMatch: row.pacienteMatch,
    profissionalMatch: row.profissionalMatch,
    servicoMatch: row.servicoMatch,
    parsedDate: row.parsedDate?.toISOString() || null,
    isRetroactive: row.isRetroactive,
    approved: row.approved,
    validationError: row.validationError,
  } as unknown as Json;
}

function rawDataToRow(raw: Record<string, unknown>, queueId: string): ParsedRow & { queueId: string } {
  return {
    queueId,
    rowIndex: raw.rowIndex as number,
    rawPaciente: raw.rawPaciente as string,
    rawProfissional: raw.rawProfissional as string,
    rawServico: raw.rawServico as string,
    rawData: raw.rawData as string,
    rawHora: raw.rawHora as number | null,
    rawMinuto: raw.rawMinuto as number | null,
    rawObservacoes: (raw.rawObservacoes as string) || "",
    pacienteMatch: raw.pacienteMatch as ParsedRow["pacienteMatch"],
    profissionalMatch: raw.profissionalMatch as ParsedRow["profissionalMatch"],
    servicoMatch: raw.servicoMatch as ParsedRow["servicoMatch"],
    parsedDate: raw.parsedDate ? new Date(raw.parsedDate as string) : null,
    isRetroactive: raw.isRetroactive as boolean,
    approved: raw.approved as boolean,
    validationError: raw.validationError as string | null,
  };
}

type PersistedRow = ParsedRow & { queueId: string };

export function BatchSchedulingModal({
  isOpen,
  onClose,
  patients,
  professionals,
  services,
  clinicId,
  onSessionsCreated,
}: BatchSchedulingModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<PersistedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [page, setPage] = useState(0);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"manual" | "ficheiro">("manual");

  // ── Profissional padrão (Camila) ─────────────────────────────────────────
  const camilaId = useMemo(() => {
    const c = professionals.find((p) => p.full_name.toLowerCase().includes("camila"));
    return c?.id || professionals[0]?.id || "";
  }, [professionals]);

  // ── Estado manual ─────────────────────────────────────────────────────────
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);

  useEffect(() => {
    if (isOpen && manualRows.length === 0) {
      setManualRows(Array.from({ length: 5 }, () => emptyManualRow(camilaId)));
    }
  }, [isOpen, camilaId]);

  const getPatientSuggestions = (search: string) => {
    if (!search || search.length < 2) return [];
    const term = search.toLowerCase();
    return patients.filter((p) => p.full_name.toLowerCase().includes(term)).slice(0, 8);
  };

  const updateManualRow = (id: string, updates: Partial<ManualRow>) => {
    setManualRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const addManualRows = (count = 5) => {
    setManualRows((prev) => [...prev, ...Array.from({ length: count }, () => emptyManualRow(camilaId))]);
  };

  const deleteManualRow = (id: string) => {
    setManualRows((prev) => prev.filter((r) => r.id !== id));
  };

  const clearManualRows = () => {
    setManualRows(Array.from({ length: 5 }, () => emptyManualRow(camilaId)));
  };

  const filledManualRows = manualRows.filter((r) => r.patientId && r.date && r.serviceId).length;

  const handleSaveManual = async () => {
    const valid = manualRows.filter((r) => r.patientId && r.date && r.hour && r.serviceId && r.professionalId);
    if (valid.length === 0) {
      toast.error("Preencha pelo menos uma linha completa (paciente, data, hora, especialidade)");
      return;
    }
    setIsSavingManual(true);
    try {
      const inserts = valid.map((r) => {
        const startTime = new Date(`${r.date}T${r.hour}:${r.minute}:00`);
        const svc = services.find((s) => s.id === r.serviceId);
        const endTime = new Date(startTime.getTime() + (svc?.duration_minutes ?? 60) * 60000);
        return {
          clinic_id: clinicId,
          paciente_id: r.patientId,
          profissional_id: r.professionalId,
          servico_id: r.serviceId || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: startTime < new Date() ? "realizado" : "agendado",
          notes: null,
          price: svc ? Number(svc.price) : 0,
          payment_status: "pendente" as const,
        };
      });
      const { error } = await supabase.from("sessoes").insert(inserts);
      if (error) throw error;
      await onSessionsCreated();
      toast.success(`${inserts.length} sessão(ões) agendada(s) com sucesso!`);
      clearManualRows();
      onClose();
    } catch (error: any) {
      const msg = error?.message || error?.error_description || JSON.stringify(error);
      toast.error("Erro ao gravar sessões: " + msg);
      console.error("Batch error:", error);
    } finally {
      setIsSavingManual(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const patientEntities: NamedEntity[] = useMemo(
    () => patients.map((p) => ({ id: p.id, name: p.full_name })),
    [patients],
  );
  const professionalEntities: NamedEntity[] = useMemo(
    () => professionals.map((p) => ({ id: p.id, name: p.full_name })),
    [professionals],
  );
  const serviceEntities: NamedEntity[] = useMemo(() => services.map((s) => ({ id: s.id, name: s.name })), [services]);

  useEffect(() => {
    if (!isOpen || !clinicId) return;
    let cancelled = false;
    async function loadPendingQueue() {
      setIsLoadingQueue(true);
      try {
        const { data, error } = await supabase
          .from("import_queue")
          .select("id, raw_data, suggested_patient_id, suggested_service_id, match_confidence, status")
          .eq("clinic_id", clinicId)
          .eq("status", "pending")
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        if (data && data.length > 0) {
          setRows(data.map((item) => rawDataToRow(item.raw_data as Record<string, unknown>, item.id)));
          setStep("review");
          setPage(0);
          setActiveTab("ficheiro");
        }
      } catch (err) {
        console.error("Error loading import queue:", err);
      } finally {
        if (!cancelled) setIsLoadingQueue(false);
      }
    }
    loadPendingQueue();
    return () => {
      cancelled = true;
    };
  }, [isOpen, clinicId]);

  const handleClose = () => {
    setStep(rows.length > 0 ? "review" : "upload");
    setIsParsing(false);
    setIsSaving(false);
    setSaveProgress(null);
    onClose();
  };

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    try {
      const parsed = await BatchSchedulingService.parseFile(
        file,
        patientEntities,
        professionalEntities,
        serviceEntities,
      );
      setSaveProgress({ current: 0, total: parsed.length });
      const persistedRows: PersistedRow[] = [];
      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        const batch = parsed.slice(i, i + BATCH_SIZE);
        const inserts = batch.map((row) => ({
          clinic_id: clinicId,
          raw_data: rowToRawData(row),
          suggested_patient_id: row.pacienteMatch.id || null,
          suggested_service_id: row.servicoMatch.id || null,
          match_confidence:
            row.pacienteMatch.confidence === "exato" ? 1.0 : row.pacienteMatch.confidence === "sugestao" ? 0.7 : 0.0,
          status: "pending" as const,
        }));
        const { data, error } = await supabase.from("import_queue").insert(inserts).select("id");
        if (error) throw error;
        batch.forEach((row, idx) => {
          persistedRows.push({ ...row, queueId: data![idx].id });
        });
        setSaveProgress({ current: Math.min(i + BATCH_SIZE, parsed.length), total: parsed.length });
        await new Promise((r) => setTimeout(r, 30));
      }
      setRows(persistedRows);
      setStep("review");
      setPage(0);
      setSaveProgress(null);
      toast.success(`${parsed.length} linhas importadas e guardadas`);
    } catch (error: any) {
      const msg = error?.message || error?.error_description || JSON.stringify(error);
      toast.error("Erro ao gravar sessões: " + msg);
      console.error("Batch error:", error);
    } finally {
      setIsParsing(false);
      setSaveProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) await handleFileUpload(file);
    },
    [clinicId, patientEntities, professionalEntities, serviceEntities],
  );

  const updateRow = (index: number, updates: Partial<ParsedRow>) => {
    setRows((prev) => {
      const gi = page * PAGE_SIZE + index;
      const updated = [...prev];
      const row = { ...updated[gi], ...updates };
      updated[gi] = row;
      supabase
        .from("import_queue")
        .update({
          raw_data: rowToRawData(row),
          suggested_patient_id: row.pacienteMatch.id || null,
          suggested_service_id: row.servicoMatch.id || null,
        })
        .eq("id", row.queueId)
        .then();
      return updated;
    });
  };

  const allApproved = rows.length > 0 && rows.every((r) => r.approved);
  const toggleAll = () => {
    const newVal = !allApproved;
    setRows((prev) => prev.map((r) => ({ ...r, approved: newVal })));
    const ids = rows.map((r) => r.queueId);
    for (let i = 0; i < ids.length; i += 100) {
      supabase
        .from("import_queue")
        .update({ raw_data: rows[i] ? rowToRawData({ ...rows[i], approved: newVal }) : {} })
        .in("id", ids.slice(i, i + 100))
        .then();
    }
  };

  const approvedRows = rows.filter((r) => r.approved);
  const retroactiveCount = approvedRows.filter((r) => r.isRetroactive).length;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDiscardQueue = async () => {
    try {
      const { error } = await supabase.from("import_queue").delete().eq("clinic_id", clinicId).eq("status", "pending");
      if (error) throw error;
      setRows([]);
      setStep("upload");
      setPage(0);
      toast.success("Importação descartada");
    } catch {
      toast.error("Erro ao descartar importação");
    }
  };

  const handleSave = async () => {
    const toInsert = approvedRows.filter(
      (r) => r.pacienteMatch.id && r.profissionalMatch.id && r.parsedDate && r.rawHora !== null,
    );
    if (toInsert.length === 0) {
      toast.error("Nenhuma sessão válida para agendar");
      return;
    }
    setIsSaving(true);
    setSaveProgress({ current: 0, total: toInsert.length });
    try {
      let created = 0;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const inserts = batch.map((r) => {
          const st = new Date(r.parsedDate!);
          st.setHours(r.rawHora!, r.rawMinuto ?? 0, 0, 0);
          const svc = services.find((s) => s.id === r.servicoMatch.id);
          const et = new Date(st);
          et.setMinutes(et.getMinutes() + (svc?.duration_minutes ?? 60));
          return {
            clinic_id: clinicId,
            paciente_id: r.pacienteMatch.id!,
            profissional_id: r.profissionalMatch.id!,
            servico_id: r.servicoMatch.id || null,
            start_time: st.toISOString(),
            end_time: et.toISOString(),
            status: st < new Date() ? "realizado" : "agendado",
            notes: r.rawObservacoes || null,
            price: svc ? Number(svc.price) : 0,
            payment_status: "pendente" as const,
          };
        });
        const { error } = await supabase.from("sessoes").insert(inserts);
        if (error) throw error;
        await supabase
          .from("import_queue")
          .update({ status: "confirmed" })
          .in(
            "id",
            batch.map((r) => r.queueId),
          );
        created += batch.length;
        setSaveProgress({ current: created, total: toInsert.length });
        await new Promise((r) => setTimeout(r, 30));
      }
      const rejectedIds = rows.filter((r) => !r.approved).map((r) => r.queueId);
      if (rejectedIds.length > 0) {
        for (let i = 0; i < rejectedIds.length; i += 100)
          await supabase
            .from("import_queue")
            .update({ status: "rejected" })
            .in("id", rejectedIds.slice(i, i + 100));
      }
      await onSessionsCreated();
      toast.success(`${created} sessões agendadas com sucesso!`);
      setRows([]);
      setStep("upload");
      setSaveProgress(null);
      onClose();
    } catch (err) {
      toast.error("Erro ao gravar sessões: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Agendamento em Lote
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0 grid grid-cols-2 mb-3">
            <TabsTrigger value="manual" className="gap-2">
              <PenLine className="h-4 w-4" />
              Manual
              {filledManualRows > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {filledManualRows}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ficheiro" className="gap-2">
              <Upload className="h-4 w-4" />
              Por Ficheiro
              {rows.length > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px]">
                  {rows.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════ ABA MANUAL ═══════════════════════════ */}
          <TabsContent value="manual" className="flex flex-col flex-1 min-h-0 mt-0">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-xs text-muted-foreground">
                Profissional padrão:{" "}
                <span className="font-medium text-foreground">
                  {professionals.find((p) => p.id === camilaId)?.full_name || "—"}
                </span>
                <span className="ml-1 text-[10px]">(pode alterar por linha)</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => addManualRows(5)}>
                  <Plus className="h-3.5 w-3.5" />
                  +5 linhas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={clearManualRows}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              </div>
            </div>

            {/* Tabela editável */}
            <div className="flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold w-8 text-center sticky left-0 bg-muted/40">#</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[210px]">Paciente *</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[140px]">Data *</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[110px]">Hora *</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[180px]">Especialidade *</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[170px]">Profissional</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualRows.map((row, idx) => {
                    const suggestions = getPatientSuggestions(row.patientSearch);
                    const isComplete = !!(row.patientId && row.date && row.serviceId);
                    return (
                      <TableRow key={row.id} className={isComplete ? "bg-green-50/50 dark:bg-green-950/20" : ""}>
                        {/* # */}
                        <TableCell className="text-xs text-muted-foreground text-center">{idx + 1}</TableCell>

                        {/* Paciente autocomplete */}
                        <TableCell className="p-1.5">
                          <div className="relative">
                            <Input
                              className="h-8 text-xs pr-6"
                              placeholder="Digite o nome..."
                              value={row.patientSearch}
                              onChange={(e) =>
                                updateManualRow(row.id, {
                                  patientSearch: e.target.value,
                                  patientId: "",
                                  patientName: "",
                                  showSuggestions: true,
                                })
                              }
                              onFocus={() => updateManualRow(row.id, { showSuggestions: true })}
                              onBlur={() => setTimeout(() => updateManualRow(row.id, { showSuggestions: false }), 150)}
                            />
                            {row.patientId && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 text-xs">
                                ✓
                              </span>
                            )}
                            {row.showSuggestions && suggestions.length > 0 && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border rounded-md shadow-lg max-h-44 overflow-y-auto">
                                {suggestions.map((s) => (
                                  <button
                                    key={s.id}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      updateManualRow(row.id, {
                                        patientId: s.id,
                                        patientName: s.full_name,
                                        patientSearch: s.full_name,
                                        showSuggestions: false,
                                      });
                                    }}
                                  >
                                    {s.full_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Data */}
                        <TableCell className="p-1.5">
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={row.date}
                            onChange={(e) => updateManualRow(row.id, { date: e.target.value })}
                          />
                        </TableCell>

                        {/* Hora + Minuto */}
                        <TableCell className="p-1.5">
                          <div className="flex gap-1">
                            <Select value={row.hour} onValueChange={(v) => updateManualRow(row.id, { hour: v })}>
                              <SelectTrigger className="h-8 text-xs w-[58px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {HOURS.map((h) => (
                                  <SelectItem key={h} value={h} className="text-xs">
                                    {h}h
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={row.minute} onValueChange={(v) => updateManualRow(row.id, { minute: v })}>
                              <SelectTrigger className="h-8 text-xs w-[52px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MINUTES.map((m) => (
                                  <SelectItem key={m} value={m} className="text-xs">
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>

                        {/* Especialidade */}
                        <TableCell className="p-1.5">
                          <Select
                            value={row.serviceId}
                            onValueChange={(v) => updateManualRow(row.id, { serviceId: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((s) => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Profissional */}
                        <TableCell className="p-1.5">
                          <Select
                            value={row.professionalId}
                            onValueChange={(v) => updateManualRow(row.id, { professionalId: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {professionals.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {p.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Delete linha */}
                        <TableCell className="p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteManualRow(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-between pt-3 shrink-0">
              <p className="text-xs text-muted-foreground">
                {filledManualRows > 0 ? (
                  <span className="text-green-700 font-medium">{filledManualRows} sessão(ões) prontas ✓</span>
                ) : (
                  "Campos obrigatórios: paciente, data e especialidade"
                )}
              </p>
              <Button onClick={handleSaveManual} disabled={isSavingManual || filledManualRows === 0} className="gap-2">
                {isSavingManual ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />A agendar...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Agendar {filledManualRows > 0 ? filledManualRows : ""} Sessões
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ══════════════════════ ABA FICHEIRO ══════════════════════════ */}
          <TabsContent value="ficheiro" className="flex flex-col flex-1 min-h-0 mt-0 overflow-y-auto">
            <div className="space-y-4">
              {isLoadingQueue && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">A carregar importação anterior...</p>
                </div>
              )}

              {step === "upload" && !isLoadingQueue && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isParsing ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {saveProgress
                            ? `A guardar... ${saveProgress.current}/${saveProgress.total}`
                            : "A processar ficheiro..."}
                        </p>
                        {saveProgress && (
                          <Progress value={(saveProgress.current / saveProgress.total) * 100} className="w-64" />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="font-medium">Arraste um ficheiro ou clique para selecionar</p>
                        <p className="text-sm text-muted-foreground">.xlsx ou .csv</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.csv,.xls"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => BatchSchedulingService.downloadTemplate()}>
                    <Download className="h-4 w-4" />
                    Descarregar modelo de planilha
                  </Button>
                </div>
              )}

              {step === "review" && !isLoadingQueue && (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox checked={allApproved} onCheckedChange={toggleAll} />
                          </TableHead>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Paciente</TableHead>
                          <TableHead className="text-xs">Profissional</TableHead>
                          <TableHead className="text-xs">Serviço</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Hora</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((row, idx) => (
                          <TableRow key={row.queueId} className={row.validationError ? "bg-destructive/5" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={row.approved}
                                onCheckedChange={(c) => updateRow(idx, { approved: !!c })}
                              />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <ConfidenceBadge confidence={row.pacienteMatch.confidence} />
                                  <span className="text-xs truncate max-w-[100px]">
                                    {row.pacienteMatch.name || row.rawPaciente}
                                  </span>
                                </div>
                                <EntitySelect
                                  value={row.pacienteMatch.id}
                                  options={patientEntities}
                                  onChange={(id, name) =>
                                    updateRow(idx, { pacienteMatch: { id, name, confidence: "exato" } })
                                  }
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <ConfidenceBadge confidence={row.profissionalMatch.confidence} />
                                  <span className="text-xs truncate max-w-[100px]">
                                    {row.profissionalMatch.name || row.rawProfissional}
                                  </span>
                                </div>
                                <EntitySelect
                                  value={row.profissionalMatch.id}
                                  options={professionalEntities}
                                  onChange={(id, name) =>
                                    updateRow(idx, { profissionalMatch: { id, name, confidence: "exato" } })
                                  }
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <ConfidenceBadge confidence={row.servicoMatch.confidence} />
                                  <span className="text-xs truncate max-w-[100px]">
                                    {row.servicoMatch.name || row.rawServico}
                                  </span>
                                </div>
                                <EntitySelect
                                  value={row.servicoMatch.id}
                                  options={serviceEntities}
                                  onChange={(id, name) =>
                                    updateRow(idx, { servicoMatch: { id, name, confidence: "exato" } })
                                  }
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.parsedDate ? (
                                row.parsedDate.toLocaleDateString("pt-PT")
                              ) : (
                                <span className="text-destructive">{row.rawData || "—"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.rawHora !== null
                                ? `${String(row.rawHora).padStart(2, "0")}:${String(row.rawMinuto ?? 0).padStart(2, "0")}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.validationError ? (
                                <Badge variant="destructive" className="text-xs">
                                  {row.validationError}
                                </Badge>
                              ) : row.isRetroactive ? (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Clock className="h-3 w-3" /> Retro
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Agendado
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Página {page + 1} de {totalPages} ({rows.length} linhas)
                      </p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages - 1}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep("upload")}>
                        Novo ficheiro
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDiscardQueue} className="gap-1">
                        <Trash2 className="h-4 w-4" />
                        Descartar tudo
                      </Button>
                    </div>
                    <Button onClick={() => setStep("confirm")} disabled={approvedRows.length === 0}>
                      Revisar ({approvedRows.length} aprovadas)
                    </Button>
                  </div>
                </div>
              )}

              {step === "confirm" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{approvedRows.length}</p>
                      <p className="text-sm text-muted-foreground">Aprovadas</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold text-muted-foreground">{rows.length - approvedRows.length}</p>
                      <p className="text-sm text-muted-foreground">Rejeitadas</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold text-secondary-foreground">{retroactiveCount}</p>
                      <p className="text-sm text-muted-foreground">Retroativas</p>
                    </div>
                  </div>
                  {retroactiveCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      <Clock className="inline h-4 w-4 mr-1" />
                      Sessões retroativas serão criadas com status "realizado".
                    </p>
                  )}
                  {saveProgress && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        A criar sessões... {saveProgress.current}/{saveProgress.total}
                      </p>
                      <Progress value={(saveProgress.current / saveProgress.total) * 100} />
                    </div>
                  )}
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep("review")} disabled={isSaving}>
                      Voltar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Agendar {approvedRows.length} Sessões
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
