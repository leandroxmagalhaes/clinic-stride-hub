import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, Stethoscope, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { SpecialtyService, type SpecialtyTemplate, type StructuredData, type SectionSchema } from "@/services/SpecialtyService";
import { DynamicFormRenderer } from "./DynamicFormRenderer";

interface ClinicalData {
  anamnese: string;
  diagnostico: string;
  objetivos: string;
  observacoes: string;
  primary_specialty_id: string | null;
  initial_assessment_data: StructuredData | null;
}

interface EditClinicalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  prontuarioId: string;
  currentData: ClinicalData;
  onSave: (prontuarioId: string, data: ClinicalData) => void;
}

export function EditClinicalDataModal({
  isOpen,
  onClose,
  patientName,
  prontuarioId,
  currentData,
  onSave,
}: EditClinicalDataModalProps) {
  const [formData, setFormData] = useState<ClinicalData>(currentData);
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialtyTemplate | null>(null);
  const [initialAssessmentData, setInitialAssessmentData] = useState<StructuredData>({});

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setFormData(currentData);
      setInitialAssessmentData(currentData.initial_assessment_data || {});
    }
  }, [isOpen, currentData]);

  // Update selected template when specialty changes
  useEffect(() => {
    if (formData.primary_specialty_id && templates.length > 0) {
      const template = templates.find(t => t.id === formData.primary_specialty_id);
      setSelectedTemplate(template || null);
      
      // Initialize structured data if switching specialty and no existing data
      if (template && template.schema.length > 0) {
        // Keep existing data if same specialty, otherwise initialize empty
        if (currentData.primary_specialty_id !== formData.primary_specialty_id) {
          setInitialAssessmentData(SpecialtyService.createEmptyStructuredData(template.schema));
        }
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [formData.primary_specialty_id, templates, currentData.primary_specialty_id]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await SpecialtyService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleSave = () => {
    // Include structured assessment data
    const hasStructuredData = 
      selectedTemplate && 
      selectedTemplate.schema.length > 0 && 
      Object.keys(initialAssessmentData).length > 0;

    onSave(prontuarioId, {
      ...formData,
      initial_assessment_data: hasStructuredData ? initialAssessmentData : null,
    });
    toast.success("Dados clínicos atualizados com sucesso!");
    onClose();
  };

  // Get non-general templates for specialty selection
  const specialtyTemplates = templates.filter(t => t.name !== "Geral");
  const showDynamicForm = selectedTemplate && selectedTemplate.schema.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Editar Dados Clínicos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{patientName}</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Specialty Selector - Primary focus */}
          <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Label htmlFor="specialty" className="flex items-center gap-2 font-medium">
              <Stethoscope className="h-4 w-4 text-primary" />
              Especialidade de Tratamento
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Define o template de avaliação utilizado nas evoluções clínicas
            </p>
            {isLoadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando especialidades...
              </div>
            ) : (
              <Select
                value={formData.primary_specialty_id || "none"}
                onValueChange={(value) => 
                  setFormData({ 
                    ...formData, 
                    primary_specialty_id: value === "none" ? null : value 
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sem especialidade definida</span>
                  </SelectItem>
                  {specialtyTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.description && (
                          <span className="text-xs text-muted-foreground">
                            {template.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Initial Assessment Dynamic Form */}
          {showDynamicForm && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <Label className="font-medium">Avaliação Inicial ({selectedTemplate.name})</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Registre o estado inicial do utente para comparar com as evoluções futuras
              </p>
              <DynamicFormRenderer
                schema={selectedTemplate.schema}
                value={initialAssessmentData}
                onChange={setInitialAssessmentData}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="anamnese">Anamnese</Label>
            <Textarea
              id="anamnese"
              value={formData.anamnese}
              onChange={(e) => setFormData({ ...formData, anamnese: e.target.value })}
              placeholder="Histórico clínico, queixas principais, histórico familiar..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnostico">Diagnóstico</Label>
            <Textarea
              id="diagnostico"
              value={formData.diagnostico}
              onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
              placeholder="Diagnóstico clínico, CID..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetivos">Objetivos do Tratamento</Label>
            <Textarea
              id="objetivos"
              value={formData.objetivos}
              onChange={(e) => setFormData({ ...formData, objetivos: e.target.value })}
              placeholder="Objetivos terapêuticos a serem alcançados..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Gerais</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Outras observações relevantes..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="min-h-[44px] w-full sm:w-auto">
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
