import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  ClipboardList,
  Eye,
  Loader2,
  Download,
  Import,
  Info,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ClinicalReportService,
  type ClinicalReport,
  type ReportType,
  REPORT_TYPE_LABELS,
  REPORT_STATUS_CONFIG,
} from "@/services/ClinicalReportService";
import { generateClinicalReportPDF } from "./ClinicalReportPDF";
import { useData } from "@/contexts/DataContext";
import { AIService } from "@/services/AIService";

interface NewClinicalReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  prontuarioId: string;
  clinicId: string;
  clinicInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  editingReport?: ClinicalReport | null;
  onSave: (report: ClinicalReport) => void;
}

export function NewClinicalReportModal({
  open,
  onOpenChange,
  patientId,
  prontuarioId,
  clinicId,
  clinicInfo,
  editingReport,
  onSave,
}: NewClinicalReportModalProps) {
  const { professionals } = useData();
  const [activeTab, setActiveTab] = useState("dados");
  const [saving, setSaving] = useState(false);
  const [loadingEvolutions, setLoadingEvolutions] = useState(false);
  const [loadingAIDraft, setLoadingAIDraft] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<ReportType>("evolucao_periodica");

  // Clinical content - simplified to single field
  const [conteudo, setConteudo] = useState("");

  // Professional selection
  const [professionalId, setProfessionalId] = useState("");

  // Conteúdo: tipo de inclusão
  const [tipoConteudo, setTipoConteudo] = useState<"evolucoes" | "anamnese" | "completo">("completo");
  const [loadingBuild, setLoadingBuild] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editingReport) {
        setTitulo(editingReport.titulo);
        setTipo(editingReport.tipo);
        if (editingReport.conteudo) {
          setConteudo(editingReport.conteudo);
        } else {
          const legacyParts = [
            editingReport.diagnostico_clinico && `Diagnóstico Clínico:\n${editingReport.diagnostico_clinico}`,
            editingReport.objetivo_tratamento && `Objetivo do Tratamento:\n${editingReport.objetivo_tratamento}`,
            editingReport.evolucao_paciente && `Evolução do Paciente:\n${editingReport.evolucao_paciente}`,
            editingReport.resultados_obtidos && `Resultados Obtidos:\n${editingReport.resultados_obtidos}`,
            editingReport.recomendacoes && `Recomendações:\n${editingReport.recomendacoes}`,
            editingReport.observacoes && `Observações:\n${editingReport.observacoes}`,
          ].filter(Boolean);
          setConteudo(legacyParts.join('\n\n'));
        }
        setProfessionalId(editingReport.professional_id);
      } else {
        setTitulo("");
        setTipo("evolucao_periodica");
        setConteudo("");
        setProfessionalId(professionals[0]?.id || "");
      }
      setActiveTab("dados");
    }
  }, [open, editingReport, professionals]);

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined || value === "") return "— não preenchido";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "— não preenchido";
    if (typeof value === "object") {
      const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== "");
      if (!entries.length) return "— não preenchido";
      return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
    }
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    return String(value);
  };

  const fetchAnamnese = async (): Promise<{ text: string; hasData: boolean; summary?: Record<string, string> }> => {
    const { data: q } = await (supabase as any)
      .from("portal_questionario")
      .select("respostas, completo, updated_at, template_id, perfil_tipo")
      .eq("paciente_id", patientId)
      .maybeSingle();

    if (!q || !q.respostas || Object.keys(q.respostas).length === 0) {
      return { text: "", hasData: false };
    }

    const respostas = q.respostas || {};

    let sections: any[] = [];
    if (q.template_id) {
      const { data: tpl } = await (supabase as any)
        .from("portal_questionario_templates")
        .select("schema")
        .eq("id", q.template_id)
        .maybeSingle();
      sections = tpl?.schema?.sections || [];
    }

    // Resumo executivo (extracção tolerante a chaves diferentes)
    const pick = (...paths: string[]): string => {
      for (const p of paths) {
        const parts = p.split(".");
        let cur: any = respostas;
        for (const part of parts) {
          cur = cur?.[part];
          if (cur === undefined) break;
        }
        if (cur !== undefined && cur !== null && cur !== "") return formatFieldValue(cur);
      }
      return "—";
    };

    const summary: Record<string, string> = {
      "Diagnóstico clínico": pick("ficha_clinica.diagnostico_clinico", "clinical.diagnostico_clinico", "clinical.diagnosis", "diagnostico_clinico"),
      "Queixa principal": pick("ficha_clinica.queixa_maior", "clinical.queixa_maior", "clinical.main_complaint", "queixa_principal"),
      "Medicação contínua": pick("primeiros_dias.medicamentos_actuais", "medicacao.medicacao_continua", "health.current_medication", "medicacao_continua"),
      "Alergias conhecidas": pick("saude_vacinacao.alergias", "health.alergias", "health.allergies", "alergias"),
      "Início da queixa": pick("ficha_clinica.quando_comecou", "clinical.quando_comecou", "clinical.complaint_start", "inicio_queixa"),
    };

    const lines: string[] = [];
    lines.push("=== RESUMO EXECUTIVO ===");
    Object.entries(summary).forEach(([k, v]) => lines.push(`• ${k}: ${v || "—"}`));
    lines.push("");
    lines.push("=== ANAMNESE COMPLETA ===");

    if (sections.length) {
      sections.forEach((sec: any, idx: number) => {
        const sectionData = respostas[sec.id] ?? respostas[sec.key] ?? null;
        lines.push("");
        lines.push(`${idx + 1}. ${sec.title || sec.id}`);
        lines.push("─".repeat(40));
        const fields = sec.fields || [];
        fields.forEach((f: any) => {
          const val = sectionData && typeof sectionData === "object" ? sectionData[f.key] : respostas[f.key];
          lines.push(`  ${f.label || f.key}: ${formatFieldValue(val)}`);
        });
      });
    } else {
      // Fallback: dump bruto se não houver template
      Object.entries(respostas).forEach(([k, v]) => {
        lines.push(`• ${k}: ${formatFieldValue(v)}`);
      });
    }

    return { text: lines.join("\n"), hasData: true, summary };
  };

  const handleBuildContent = async () => {
    setLoadingBuild(true);
    try {
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      let anamneseBlock = "";
      let evolutionsBlock = "";
      let warnings: string[] = [];

      if (tipoConteudo === "anamnese" || tipoConteudo === "completo") {
        const ana = await fetchAnamnese();
        if (ana.hasData) {
          anamneseBlock = ana.text;
        } else {
          warnings.push("Este utente ainda não preencheu a Anamnese.");
        }
      }

      if (tipoConteudo === "evolucoes" || tipoConteudo === "completo") {
        const evText = await ClinicalReportService.getEvolutionsForPeriod(
          prontuarioId,
          format(oneYearAgo, "yyyy-MM-dd"),
          format(today, "yyyy-MM-dd")
        );
        if (evText) {
          evolutionsBlock = `=== EVOLUÇÕES (período seleccionado) ===\n\n${evText}`;
        } else if (tipoConteudo === "evolucoes" || (tipoConteudo === "completo" && anamneseBlock)) {
          warnings.push("Não há evoluções no período seleccionado.");
        }
      }

      const blocks = [anamneseBlock, evolutionsBlock].filter(Boolean);
      if (!blocks.length) {
        toast.error(warnings.join(" ") || "Nada para importar.");
        return;
      }

      setConteudo(blocks.join("\n\n"));
      if (warnings.length) {
        toast.warning(warnings.join(" "));
      } else {
        toast.success("Conteúdo importado com sucesso!");
      }
    } catch (error) {
      console.error("Error building content:", error);
      toast.error("Erro ao importar conteúdo");
    } finally {
      setLoadingBuild(false);
    }
  };

  const handleGenerateAIDraft = async () => {
    setLoadingAIDraft(true);
    try {
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const result = await AIService.generateReportDraft({
        prontuarioId,
        patientName: undefined,
        tipo,
        periodoInicio: format(oneYearAgo, "yyyy-MM-dd"),
        periodoFim: format(today, "yyyy-MM-dd"),
      });

      if (result.data?.draft) {
        setConteudo(prev =>
          prev ? `${result.data.draft}\n\n--- Conteúdo anterior ---\n\n${prev}` : result.data.draft
        );
        toast.success("Rascunho IA gerado! Revise e edite antes de finalizar.");
      }
    } catch (error: any) {
      console.error("Error generating AI draft:", error);
      toast.error(error.message || "Erro ao gerar rascunho com IA");
    } finally {
      setLoadingAIDraft(false);
    }
  };

  const validateForm = (): boolean => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      setActiveTab("dados");
      return false;
    }
    if (!professionalId) {
      toast.error("Profissional é obrigatório");
      setActiveTab("dados");
      return false;
    }
    return true;
  };

  const handleSave = async (finalize: boolean = false) => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const status: 'rascunho' | 'finalizado' = finalize ? 'finalizado' : 'rascunho';
      const today = format(new Date(), "yyyy-MM-dd");
      const reportData = {
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        titulo,
        tipo,
        periodo_inicio: today,
        periodo_fim: today,
        conteudo: conteudo || undefined,
        sessoes_realizadas: 0,
        dias_aviso_antecedencia: 7,
        status,
      };

      let savedReport: ClinicalReport;
      if (editingReport) {
        savedReport = await ClinicalReportService.update(editingReport.id, reportData);
      } else {
        savedReport = await ClinicalReportService.create(reportData as any);
      }

      toast.success(finalize ? "Relatório finalizado!" : "Relatório guardado!");
      onSave(savedReport);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Erro ao guardar relatório");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!validateForm()) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const tempReport: ClinicalReport = {
      id: editingReport?.id || "temp",
      clinic_id: clinicId,
      patient_id: patientId,
      professional_id: professionalId,
      titulo,
      tipo,
      periodo_inicio: today,
      periodo_fim: today,
      conteudo: conteudo,
      sessoes_realizadas: 0,
      dias_aviso_antecedencia: 7,
      status: editingReport?.status || "rascunho",
      created_at: editingReport?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paciente: editingReport?.paciente,
      profissional: professionals.find(p => p.id === professionalId) 
        ? { 
            full_name: professionals.find(p => p.id === professionalId)!.full_name,
            council_number: professionals.find(p => p.id === professionalId)!.crefito,
            specialty: professionals.find(p => p.id === professionalId)!.specialty,
          }
        : undefined,
    };

    try {
      await generateClinicalReportPDF(tempReport, clinicInfo);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editingReport ? "Editar Relatório Fisioterapêutico" : "Novo Relatório Fisioterapêutico"}
            {editingReport && (
              <Badge className={cn("ml-2", REPORT_STATUS_CONFIG[editingReport.status].className)}>
                {REPORT_STATUS_CONFIG[editingReport.status].label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Dados Básicos
            </TabsTrigger>
            <TabsTrigger value="conteudo" className="gap-2">
              <FileText className="h-4 w-4" />
              Conteúdo Clínico
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Tab 1: Dados Básicos */}
            <TabsContent value="dados" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="titulo">Título do Relatório *</Label>
                  <Input
                    id="titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Relatório de Evolução - Janeiro 2025"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo de Relatório *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as ReportType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="professional">Profissional *</Label>
                  <Select value={professionalId} onValueChange={setProfessionalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>
                          {prof.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Conteúdo Clínico */}
            <TabsContent value="conteudo" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Conteúdo do relatório</Label>
                <RadioGroup
                  value={tipoConteudo}
                  onValueChange={(v) => setTipoConteudo(v as any)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="completo" id="tc-completo" />
                    <span className="text-sm">Anamnese + Evoluções <Badge variant="secondary" className="ml-1">Recomendado</Badge></span>
                  </label>
                  <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="anamnese" id="tc-anamnese" />
                    <span className="text-sm">Só Anamnese</span>
                  </label>
                  <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="evolucoes" id="tc-evolucoes" />
                    <span className="text-sm">Só Evoluções</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Label htmlFor="conteudo">Conteúdo do Relatório</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAIDraft}
                    disabled={loadingAIDraft}
                    className="gap-2"
                  >
                    {loadingAIDraft ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Gerar com IA
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBuildContent}
                    disabled={loadingBuild}
                    className="gap-2"
                  >
                    {loadingBuild ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Import className="h-4 w-4" />
                    )}
                    Importar conteúdo
                  </Button>
                </div>
              </div>
              <Textarea
                id="conteudo"
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Escreva livremente o conteúdo do relatório fisioterapêutico...

Pode incluir:
• Diagnóstico e queixa principal
• Objetivos do tratamento
• Evolução e progresso
• Resultados obtidos
• Recomendações
• Observações"
                rows={18}
                className="min-h-[350px]"
              />
            </TabsContent>

            {/* Tab 3: Preview */}
            <TabsContent value="preview" className="mt-0">
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Visualize e faça download do PDF antes de finalizar o relatório.
                  </AlertDescription>
                </Alert>

                <div className="border rounded-lg p-6 bg-muted/30 space-y-4">
                  <div className="text-center border-b pb-4">
                    <h3 className="text-lg font-bold text-primary">
                      {clinicInfo?.name || "Clínica"}
                    </h3>
                    <p className="text-sm text-muted-foreground">RELATÓRIO FISIOTERAPÊUTICO</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Título:</p>
                      <p className="text-muted-foreground">{titulo || "-"}</p>
                    </div>
                    <div>
                      <p className="font-medium">Tipo:</p>
                      <p className="text-muted-foreground">{REPORT_TYPE_LABELS[tipo]}</p>
                    </div>
                  </div>

                  {conteudo && (
                    <div className="border-t pt-4">
                      <p className="font-medium text-sm text-primary mb-2">Conteúdo:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{conteudo}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Rascunho
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Finalizar Relatório
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
