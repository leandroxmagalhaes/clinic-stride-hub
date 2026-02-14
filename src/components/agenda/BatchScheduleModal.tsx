import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { Patient } from "@/services/PatientService";
import { Session } from "@/services/SessionService";
import { parseSpreadsheet, analyzeRows, getSessionStatus, BatchRow } from "@/services/BatchSchedulingService";
import { BatchScheduleReviewTable } from "./BatchScheduleReviewTable";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Professional {
  id: string;
  full_name: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color?: string | null;
  consumes_credit?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  professionals: Professional[];
  services: Service[];
  sessions: Session[];
  clinicId: string;
  onComplete: () => void;
}

type Step = "upload" | "analyzing" | "review" | "result";

export function BatchScheduleModal({ isOpen, onClose, patients, professionals, services, sessions, clinicId, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [resultStats, setResultStats] = useState({ created: 0, failed: 0, skipped: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setSelectedProfissional("");
    setSelectedServico("");
    setRows([]);
    setProgress(0);
    setResultStats({ created: 0, failed: 0, skipped: 0 });
    setIsSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv"))) {
      setFile(f);
    } else {
      toast.error("Formato não suportado. Use .xlsx, .xls ou .csv");
    }
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setStep("analyzing");
    setProgress(20);

    try {
      const parsed = await parseSpreadsheet(file);
      setProgress(60);

      const analyzed = analyzeRows(parsed, patients, sessions);
      setProgress(100);

      setRows(analyzed);
      setTimeout(() => setStep("review"), 300);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar planilha");
      setStep("upload");
    }
  };

  const handleRowUpdate = (id: string, updates: Partial<BatchRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleToggleAll = (approved: boolean) => {
    setRows(prev => prev.map(r => (!r.parseError ? { ...r, approved } : r)));
  };

  const handleSubmit = async () => {
    const approved = rows.filter(r => r.approved && r.matchedPatient && r.date && !r.parseError);
    if (approved.length === 0) {
      toast.error("Nenhuma linha aprovada para agendar.");
      return;
    }
    if (!selectedProfissional) {
      toast.error("Selecione um profissional.");
      return;
    }
    if (!selectedServico) {
      toast.error("Selecione um serviço.");
      return;
    }

    setIsSubmitting(true);
    const service = services.find(s => s.id === selectedServico);
    const duration = service?.duration_minutes || 60;

    const inserts = approved.map(row => {
      const startTime = new Date(row.date!);
      startTime.setHours(row.startHour, row.startMinute, 0, 0);
      const endTime = new Date(row.date!);
      endTime.setHours(row.endHour, row.endMinute, 0, 0);

      // If end equals start, use service duration
      if (endTime <= startTime) {
        endTime.setTime(startTime.getTime() + duration * 60 * 1000);
      }

      return {
        clinic_id: clinicId,
        paciente_id: row.matchedPatient!.id,
        profissional_id: selectedProfissional,
        servico_id: selectedServico,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: getSessionStatus(row),
        notes: row.notes || null,
        price: service ? Number(service.price) : 0,
        payment_status: "pendente" as const,
      };
    });

    try {
      const { error } = await supabase.from("sessoes").insert(inserts);
      if (error) throw error;

      setResultStats({
        created: inserts.length,
        failed: 0,
        skipped: rows.length - approved.length,
      });
      setStep("result");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar sessões.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const wsData = [
      ["Data", "Dia da Semana", "Nome/Evento", "Horário Início", "Horário Fim", "Observações"],
      ["06/02/2026", "Sexta", "Maria Francisca Veloso", "13:00", "14:00", ""],
      ["06/02/2026", "Sexta", "João Silva", "14:00", "15:00", "Retorno"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_agendamento_lote.xlsx");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Agendamento em Lote
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* File drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById("batch-file-input")?.click()}
            >
              <input
                id="batch-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">Clique para trocar o ficheiro</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Arraste a planilha aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">Formatos aceites: .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>

            {/* Professional & Service selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
                  <SelectTrigger><SelectValue placeholder="Selecionar profissional" /></SelectTrigger>
                  <SelectContent>
                    {professionals.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serviço *</Label>
                <Select value={selectedServico} onValueChange={setSelectedServico}>
                  <SelectTrigger><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Descarregar Modelo
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={!file || !selectedProfissional || !selectedServico}
              >
                Analisar Planilha
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Analyzing */}
        {step === "analyzing" && (
          <div className="space-y-4 py-8 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-primary animate-pulse" />
            <p className="font-medium">A analisar planilha...</p>
            <p className="text-sm text-muted-foreground">Cruzando nomes com pacientes cadastrados</p>
            <Progress value={progress} className="max-w-xs mx-auto" />
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{rows.filter(r => r.matchStatus === "exact").length} exactos</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>{rows.filter(r => r.matchStatus === "suggestion").length} sugestões</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>{rows.filter(r => r.matchStatus === "none").length} sem match</span>
              </div>
            </div>

            <BatchScheduleReviewTable
              rows={rows}
              patients={patients}
              onRowUpdate={handleRowUpdate}
              onToggleAll={handleToggleAll}
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || rows.filter(r => r.approved).length === 0}>
                {isSubmitting ? "A agendar..." : `Agendar ${rows.filter(r => r.approved).length} Sessões`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <p className="text-xl font-semibold">Agendamento concluído!</p>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-green-600">{resultStats.created}</p>
                <p className="text-muted-foreground">Criadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{resultStats.skipped}</p>
                <p className="text-muted-foreground">Ignoradas</p>
              </div>
              {resultStats.failed > 0 && (
                <div>
                  <p className="text-2xl font-bold text-destructive">{resultStats.failed}</p>
                  <p className="text-muted-foreground">Falharam</p>
                </div>
              )}
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
