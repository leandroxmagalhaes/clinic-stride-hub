import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  Download,
  Mail,
  CheckCircle,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { format, differenceInDays, isPast, isWithinInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ClinicalReportService,
  type ClinicalReport,
  type ReportStatus,
  REPORT_TYPE_LABELS,
  REPORT_STATUS_CONFIG,
} from "@/services/ClinicalReportService";
import { NewClinicalReportModal } from "./NewClinicalReportModal";
import { generateClinicalReportPDF } from "./ClinicalReportPDF";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";

interface ClinicalReportsListProps {
  patientId: string;
  prontuarioId: string;
  clinicId: string;
  clinicInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export function ClinicalReportsList({ 
  patientId, 
  prontuarioId, 
  clinicId,
  clinicInfo 
}: ClinicalReportsListProps) {
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ClinicalReport | null>(null);
  const [deletingReport, setDeletingReport] = useState<ClinicalReport | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<string>("all");

  // Load reports
  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await ClinicalReportService.getByPatient(patientId);
      setReports(data);
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [patientId]);

  // Calculate deadline alerts
  const today = new Date();
  const expiredReports = reports.filter(r => 
    r.data_validade && 
    r.status !== 'entregue' && 
    isPast(new Date(r.data_validade))
  );
  const expiringReports = reports.filter(r => 
    r.data_validade && 
    r.status !== 'entregue' && 
    !isPast(new Date(r.data_validade)) &&
    isWithinInterval(new Date(r.data_validade), { 
      start: today, 
      end: addDays(today, 7) 
    })
  );

  // Filter reports
  const filteredReports = reports.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    
    if (deadlineFilter !== "all" && r.data_validade) {
      const deadline = new Date(r.data_validade);
      if (deadlineFilter === "expired" && (!isPast(deadline) || r.status === 'entregue')) return false;
      if (deadlineFilter === "expiring") {
        const isExpiring = !isPast(deadline) && isWithinInterval(deadline, { 
          start: today, 
          end: addDays(today, 7) 
        });
        if (!isExpiring || r.status === 'entregue') return false;
      }
    } else if (deadlineFilter !== "all" && !r.data_validade) {
      return false;
    }
    
    return true;
  });

  const getDeadlineBadge = (report: ClinicalReport) => {
    if (!report.data_validade || report.status === 'entregue') return null;
    
    const deadline = new Date(report.data_validade);
    const daysUntil = differenceInDays(deadline, today);
    
    if (isPast(deadline)) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Vencido há {Math.abs(daysUntil)} dias
        </Badge>
      );
    }
    
    if (daysUntil <= 7) {
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Vence em {daysUntil} dias
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        {format(deadline, "dd/MM/yyyy", { locale: ptBR })}
      </Badge>
    );
  };

  const handleDownloadPDF = async (report: ClinicalReport) => {
    try {
      await generateClinicalReportPDF(report, clinicInfo);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleMarkAsDelivered = async (report: ClinicalReport) => {
    try {
      const updated = await ClinicalReportService.markAsDelivered(report.id);
      setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success("Relatório marcado como entregue!");
    } catch (error) {
      console.error("Error marking as delivered:", error);
      toast.error("Erro ao atualizar relatório");
    }
  };

  const handleDelete = async () => {
    if (!deletingReport) return;
    try {
      await ClinicalReportService.delete(deletingReport.id);
      setReports(prev => prev.filter(r => r.id !== deletingReport.id));
      toast.success("Relatório eliminado!");
      setDeletingReport(null);
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("Erro ao eliminar relatório");
    }
  };

  const handleSaveReport = (report: ClinicalReport) => {
    if (editingReport) {
      setReports(prev => prev.map(r => r.id === report.id ? report : r));
    } else {
      setReports(prev => [report, ...prev]);
    }
    setEditingReport(null);
    setIsNewModalOpen(false);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setDeadlineFilter("all");
  };

  const hasActiveFilters = statusFilter !== "all" || deadlineFilter !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Relatórios Fisioterapêuticos</h3>
        <Button onClick={() => setIsNewModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Relatório
        </Button>
      </div>

      {/* Alerts */}
      {expiredReports.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {expiredReports.length} relatório{expiredReports.length > 1 ? 's' : ''} com prazo vencido
          </AlertDescription>
        </Alert>
      )}
      {expiringReports.length > 0 && (
        <Alert className="border-warning/50 bg-warning/10">
          <Clock className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            {expiringReports.length} relatório{expiringReports.length > 1 ? 's' : ''} vence{expiringReports.length > 1 ? 'm' : ''} em 7 dias
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="finalizado">Finalizado</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os prazos</SelectItem>
            <SelectItem value="expiring">Vencendo em 7 dias</SelectItem>
            <SelectItem value="expired">Vencidos</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {hasActiveFilters 
                ? "Nenhum relatório encontrado com os filtros aplicados"
                : "Nenhum relatório criado. Crie o primeiro relatório fisioterapêutico."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <Card key={report.id} className="shadow-card hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate">{report.titulo}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {REPORT_TYPE_LABELS[report.tipo]}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", REPORT_STATUS_CONFIG[report.status].className)}
                      >
                        {REPORT_STATUS_CONFIG[report.status].label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span>
                        Período: {format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} 
                        {" - "} 
                        {format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {report.sessoes_realizadas !== null && (
                        <span>• {report.sessoes_realizadas} sessões</span>
                      )}
                    </div>

                    {report.destinatario_nome && (
                      <p className="text-sm text-muted-foreground">
                        Para: {report.destinatario_nome}
                        {report.destinatario_especialidade && ` - ${report.destinatario_especialidade}`}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {getDeadlineBadge(report)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {report.status !== 'rascunho' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadPDF(report)}
                        className="gap-1"
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    )}
                    
                    {report.status !== 'entregue' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingReport(report)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {report.status === 'finalizado' && (
                            <DropdownMenuItem onClick={() => handleMarkAsDelivered(report)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marcar como Entregue
                            </DropdownMenuItem>
                          )}
                          {report.status === 'enviado' && (
                            <DropdownMenuItem onClick={() => handleMarkAsDelivered(report)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marcar como Entregue
                            </DropdownMenuItem>
                          )}
                          {report.status === 'rascunho' && (
                            <DropdownMenuItem 
                              onClick={() => setDeletingReport(report)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <NewClinicalReportModal
        open={isNewModalOpen || !!editingReport}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewModalOpen(false);
            setEditingReport(null);
          }
        }}
        patientId={patientId}
        prontuarioId={prontuarioId}
        clinicId={clinicId}
        clinicInfo={clinicInfo}
        editingReport={editingReport}
        onSave={handleSaveReport}
      />

      <DeleteConfirmationDialog
        isOpen={!!deletingReport}
        onClose={() => setDeletingReport(null)}
        title="Eliminar Relatório"
        description="Esta ação não pode ser desfeita."
        entityName={deletingReport?.titulo || "Relatório"}
        onConfirm={handleDelete}
      />
    </div>
  );
}
