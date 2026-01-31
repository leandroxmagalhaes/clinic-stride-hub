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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarIcon,
  FileText,
  ClipboardList,
  Eye,
  Loader2,
  Download,
  Import,
  Info,
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
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<ReportType>("evolucao_periodica");
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>();
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>();
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [destinatarioEspecialidade, setDestinatarioEspecialidade] = useState("");
  const [destinatarioIdentificacao, setDestinatarioIdentificacao] = useState("");
  const [dataValidade, setDataValidade] = useState<Date | undefined>();
  const [diasAviso, setDiasAviso] = useState("7");

  // Clinical content - simplified to single field
  const [conteudo, setConteudo] = useState("");

  // Professional selection
  const [professionalId, setProfessionalId] = useState("");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editingReport) {
        // Populate form with existing report data
        setTitulo(editingReport.titulo);
        setTipo(editingReport.tipo);
        setPeriodoInicio(new Date(editingReport.periodo_inicio));
        setPeriodoFim(new Date(editingReport.periodo_fim));
        setDestinatarioNome(editingReport.destinatario_nome || "");
        setDestinatarioEspecialidade(editingReport.destinatario_especialidade || "");
        setDestinatarioIdentificacao(editingReport.destinatario_identificacao || "");
        setDataValidade(editingReport.data_validade ? new Date(editingReport.data_validade) : undefined);
        setDiasAviso(String(editingReport.dias_aviso_antecedencia));
        // Handle both new format (conteudo) and legacy format
        if (editingReport.conteudo) {
          setConteudo(editingReport.conteudo);
        } else {
          // Build content from legacy fields for backward compatibility
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
        setSessionsCount(editingReport.sessoes_realizadas || null);
      } else {
        // Reset to defaults
        setTitulo("");
        setTipo("evolucao_periodica");
        setPeriodoInicio(undefined);
        setPeriodoFim(undefined);
        setDestinatarioNome("");
        setDestinatarioEspecialidade("");
        setDestinatarioIdentificacao("");
        setDataValidade(undefined);
        setDiasAviso("7");
        setConteudo("");
        setProfessionalId(professionals[0]?.id || "");
        setSessionsCount(null);
      }
      setActiveTab("dados");
    }
  }, [open, editingReport, professionals]);

  // Count sessions when period changes
  useEffect(() => {
    const countSessions = async () => {
      if (periodoInicio && periodoFim) {
        const count = await ClinicalReportService.countSessionsInPeriod(
          patientId,
          format(periodoInicio, "yyyy-MM-dd"),
          format(periodoFim, "yyyy-MM-dd")
        );
        setSessionsCount(count);
      }
    };
    countSessions();
  }, [periodoInicio, periodoFim, patientId]);

  const handleImportEvolutions = async () => {
    if (!periodoInicio || !periodoFim) {
      toast.error("Selecione o período primeiro");
      return;
    }

    setLoadingEvolutions(true);
    try {
      const evolutionsText = await ClinicalReportService.getEvolutionsForPeriod(
        prontuarioId,
        format(periodoInicio, "yyyy-MM-dd"),
        format(periodoFim, "yyyy-MM-dd")
      );

      if (evolutionsText) {
        setConteudo(prev => 
          prev ? `${prev}\n\n--- Evoluções Importadas ---\n\n${evolutionsText}` : evolutionsText
        );
        toast.success("Evoluções importadas com sucesso!");
      } else {
        toast.info("Nenhuma evolução encontrada no período");
      }
    } catch (error) {
      console.error("Error importing evolutions:", error);
      toast.error("Erro ao importar evoluções");
    } finally {
      setLoadingEvolutions(false);
    }
  };

  const validateForm = (): boolean => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      setActiveTab("dados");
      return false;
    }
    if (!periodoInicio || !periodoFim) {
      toast.error("Período é obrigatório");
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
      const reportData = {
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        titulo,
        tipo,
        periodo_inicio: format(periodoInicio!, "yyyy-MM-dd"),
        periodo_fim: format(periodoFim!, "yyyy-MM-dd"),
        conteudo: conteudo || undefined,
        sessoes_realizadas: sessionsCount || 0,
        destinatario_nome: destinatarioNome || undefined,
        destinatario_especialidade: destinatarioEspecialidade || undefined,
        destinatario_identificacao: destinatarioIdentificacao || undefined,
        data_validade: dataValidade ? format(dataValidade, "yyyy-MM-dd") : undefined,
        dias_aviso_antecedencia: parseInt(diasAviso),
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

    // Create a temporary report object for PDF generation
    const tempReport: ClinicalReport = {
      id: editingReport?.id || "temp",
      clinic_id: clinicId,
      patient_id: patientId,
      professional_id: professionalId,
      titulo,
      tipo,
      periodo_inicio: format(periodoInicio!, "yyyy-MM-dd"),
      periodo_fim: format(periodoFim!, "yyyy-MM-dd"),
      conteudo: conteudo,
      sessoes_realizadas: sessionsCount,
      destinatario_nome: destinatarioNome,
      destinatario_especialidade: destinatarioEspecialidade,
      destinatario_identificacao: destinatarioIdentificacao,
      data_validade: dataValidade ? format(dataValidade, "yyyy-MM-dd") : null,
      dias_aviso_antecedencia: parseInt(diasAviso),
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
            {editingReport ? "Editar Relatório Clínico" : "Novo Relatório Clínico"}
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

                <div>
                  <Label>Período Início *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !periodoInicio && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {periodoInicio ? format(periodoInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodoInicio}
                        onSelect={setPeriodoInicio}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Período Fim *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !periodoFim && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {periodoFim ? format(periodoFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodoFim}
                        onSelect={setPeriodoFim}
                        locale={ptBR}
                        disabled={(date) => periodoInicio ? date < periodoInicio : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {sessionsCount !== null && (
                  <div className="col-span-2">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{sessionsCount}</strong> sessão(ões) realizada(s) no período selecionado
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Destinatário do Relatório</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="destinatarioNome">Nome</Label>
                    <Input
                      id="destinatarioNome"
                      value={destinatarioNome}
                      onChange={(e) => setDestinatarioNome(e.target.value)}
                      placeholder="Dr. João Oliveira"
                    />
                  </div>
                  <div>
                    <Label htmlFor="destinatarioEspecialidade">Especialidade</Label>
                    <Input
                      id="destinatarioEspecialidade"
                      value={destinatarioEspecialidade}
                      onChange={(e) => setDestinatarioEspecialidade(e.target.value)}
                      placeholder="Ortopedista"
                    />
                  </div>
                  <div>
                    <Label htmlFor="destinatarioIdentificacao">CRM/NIF</Label>
                    <Input
                      id="destinatarioIdentificacao"
                      value={destinatarioIdentificacao}
                      onChange={(e) => setDestinatarioIdentificacao(e.target.value)}
                      placeholder="CRM 12345"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Prazo de Entrega</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Limite</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !dataValidade && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataValidade ? format(dataValidade, "dd/MM/yyyy", { locale: ptBR }) : "Opcional"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataValidade}
                          onSelect={setDataValidade}
                          locale={ptBR}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="diasAviso">Avisar com antecedência de</Label>
                    <Select value={diasAviso} onValueChange={setDiasAviso}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 dias</SelectItem>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="15">15 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Conteúdo Clínico */}
            <TabsContent value="conteudo" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="conteudo">Conteúdo do Relatório</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImportEvolutions}
                  disabled={loadingEvolutions || !periodoInicio || !periodoFim}
                  className="gap-2"
                >
                  {loadingEvolutions ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4" />
                  )}
                  Importar Evoluções
                </Button>
              </div>
              <Textarea
                id="conteudo"
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Escreva livremente o conteúdo do relatório clínico...

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
                    <p className="text-sm text-muted-foreground">RELATÓRIO CLÍNICO</p>
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
                    <div>
                      <p className="font-medium">Período:</p>
                      <p className="text-muted-foreground">
                        {periodoInicio && periodoFim
                          ? `${format(periodoInicio, "dd/MM/yyyy")} a ${format(periodoFim, "dd/MM/yyyy")}`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Sessões:</p>
                      <p className="text-muted-foreground">{sessionsCount || 0}</p>
                    </div>
                  </div>

                  {destinatarioNome && (
                    <div className="border-t pt-4">
                      <p className="font-medium text-sm">Destinatário:</p>
                      <p className="text-sm text-muted-foreground">
                        {destinatarioNome}
                        {destinatarioEspecialidade && ` - ${destinatarioEspecialidade}`}
                        {destinatarioIdentificacao && ` (${destinatarioIdentificacao})`}
                      </p>
                    </div>
                  )}

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
