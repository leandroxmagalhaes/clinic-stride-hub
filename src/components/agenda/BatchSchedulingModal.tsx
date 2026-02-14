import { useState, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BatchSchedulingService,
  ParsedRow,
  MatchConfidence,
  NamedEntity,
} from "@/services/BatchSchedulingService";

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
        const entity = options.find((o) => o.id === v);
        if (entity) onChange(entity.id, entity.name);
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
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patientEntities: NamedEntity[] = useMemo(
    () => patients.map((p) => ({ id: p.id, name: p.full_name })),
    [patients]
  );
  const professionalEntities: NamedEntity[] = useMemo(
    () => professionals.map((p) => ({ id: p.id, name: p.full_name })),
    [professionals]
  );
  const serviceEntities: NamedEntity[] = useMemo(
    () => services.map((s) => ({ id: s.id, name: s.name })),
    [services]
  );

  const resetModal = useCallback(() => {
    setStep("upload");
    setRows([]);
    setIsParsing(false);
    setIsSaving(false);
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const parsed = await BatchSchedulingService.parseFile(
        file,
        patientEntities,
        professionalEntities,
        serviceEntities
      );
      setRows(parsed);
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar ficheiro");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      setIsParsing(true);
      try {
        const parsed = await BatchSchedulingService.parseFile(
          file,
          patientEntities,
          professionalEntities,
          serviceEntities
        );
        setRows(parsed);
        setStep("review");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao processar ficheiro");
      } finally {
        setIsParsing(false);
      }
    },
    [patientEntities, professionalEntities, serviceEntities]
  );

  const updateRow = (index: number, updates: Partial<ParsedRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const allApproved = rows.length > 0 && rows.every((r) => r.approved);
  const toggleAll = () => {
    const newVal = !allApproved;
    setRows((prev) => prev.map((r) => ({ ...r, approved: newVal })));
  };

  const approvedRows = rows.filter((r) => r.approved);
  const retroactiveCount = approvedRows.filter((r) => r.isRetroactive).length;

  const handleSave = async () => {
    const toInsert = approvedRows.filter(
      (r) =>
        r.pacienteMatch.id &&
        r.profissionalMatch.id &&
        r.parsedDate &&
        r.rawHora !== null
    );

    if (toInsert.length === 0) {
      toast.error("Nenhuma sessão válida para agendar");
      return;
    }

    setIsSaving(true);
    try {
      const inserts = toInsert.map((r) => {
        const startTime = new Date(r.parsedDate!);
        startTime.setHours(r.rawHora!, r.rawMinuto ?? 0, 0, 0);

        const svc = services.find((s) => s.id === r.servicoMatch.id);
        const durationMinutes = svc?.duration_minutes ?? 60;

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);

        const isRetro = startTime < new Date();

        return {
          clinic_id: clinicId,
          paciente_id: r.pacienteMatch.id!,
          profissional_id: r.profissionalMatch.id!,
          servico_id: r.servicoMatch.id || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: isRetro ? "realizado" : "agendado",
          notes: r.rawObservacoes || null,
          price: svc ? Number(svc.price) : 0,
          payment_status: "pendente" as const,
        };
      });

      const { error } = await supabase.from("sessoes").insert(inserts);
      if (error) throw error;

      await onSessionsCreated();
      toast.success(`${inserts.length} sessões agendadas com sucesso!`);
      handleClose();
    } catch (err) {
      toast.error(
        "Erro ao gravar sessões: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Agendamento em Lote
            {step === "review" && (
              <Badge variant="outline" className="ml-2">
                {rows.length} linhas
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
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
                  <p className="text-sm text-muted-foreground">A processar ficheiro...</p>
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

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => BatchSchedulingService.downloadTemplate()}
            >
              <Download className="h-4 w-4" />
              Descarregar modelo de planilha
            </Button>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allApproved}
                        onCheckedChange={toggleAll}
                      />
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
                  {rows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={row.validationError ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.approved}
                          onCheckedChange={(checked) =>
                            updateRow(idx, { approved: !!checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.rowIndex}
                      </TableCell>

                      {/* Paciente */}
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
                              updateRow(idx, {
                                pacienteMatch: { id, name, confidence: "exato" },
                              })
                            }
                          />
                        </div>
                      </TableCell>

                      {/* Profissional */}
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
                              updateRow(idx, {
                                profissionalMatch: { id, name, confidence: "exato" },
                              })
                            }
                          />
                        </div>
                      </TableCell>

                      {/* Serviço */}
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
                              updateRow(idx, {
                                servicoMatch: { id, name, confidence: "exato" },
                              })
                            }
                          />
                        </div>
                      </TableCell>

                      {/* Data */}
                      <TableCell className="text-xs">
                        {row.parsedDate
                          ? row.parsedDate.toLocaleDateString("pt-PT")
                          : <span className="text-destructive">{row.rawData || "—"}</span>}
                      </TableCell>

                      {/* Hora */}
                      <TableCell className="text-xs">
                        {row.rawHora !== null
                          ? `${String(row.rawHora).padStart(2, "0")}:${String(row.rawMinuto ?? 0).padStart(2, "0")}`
                          : "—"}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {row.validationError ? (
                          <Badge variant="destructive" className="text-xs">
                            {row.validationError}
                          </Badge>
                        ) : row.isRetroactive ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="h-3 w-3" /> Retroativa
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

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={approvedRows.length === 0}
              >
                Revisar ({approvedRows.length} aprovadas)
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-primary">{approvedRows.length}</p>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground">
                  {rows.length - approvedRows.length}
                </p>
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

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("review")}>
                Voltar
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Agendar {approvedRows.length} Sessões
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
