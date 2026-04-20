// EditEvolutionModal - Modal for editing existing clinical evolutions
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DynamicFormRenderer } from "./DynamicFormRenderer";
import { SpecialtyService, type SpecialtyTemplate, type StructuredData } from "@/services/SpecialtyService";

export interface EvolutionToEdit {
  id: string;
  descricao: string;
  escala_dor: number;
  specialty_id: string | null;
  structured_data: Record<string, unknown> | null;
  created_at: string;
}

interface EditEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  evolution: EvolutionToEdit | null;
  patientSpecialtyId?: string | null;
  onSubmit: (
    evolutionId: string,
    data: {
      descricao: string;
      escala_dor: number;
      specialty_id: string | null;
      structured_data: StructuredData | null;
      created_at: string;
    },
  ) => Promise<void>;
}

// Helpers para separar/juntar data e hora a partir de ISO local
function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineDateTime(date: string, time: string): string {
  // Constrói um Date local e devolve ISO (UTC)
  return new Date(`${date}T${time}:00`).toISOString();
}

function todayDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EditEvolutionModal({
  isOpen,
  onClose,
  patientName,
  evolution,
  patientSpecialtyId,
  onSubmit,
}: EditEvolutionModalProps) {
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialtyTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [evolutionDate, setEvolutionDate] = useState<string>("");
  const [evolutionTime, setEvolutionTime] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [escalaDor, setEscalaDor] = useState(5);
  const [structuredData, setStructuredData] = useState<StructuredData>({});

  // Carrega templates e pré-preenche com dados da evolução existente
  useEffect(() => {
    if (isOpen && evolution) {
      loadTemplatesAndFill();
    }
  }, [isOpen, evolution?.id]);

  // Atualiza template selecionado
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, templates]);

  const loadTemplatesAndFill = async () => {
    if (!evolution) return;
    setIsLoading(true);
    try {
      const data = await SpecialtyService.getTemplates();
      setTemplates(data);

      // Pré-preenche com dados existentes
      setDescricao(evolution.descricao || "");
      setEscalaDor(evolution.escala_dor ?? 5);

      // Data e hora a partir do created_at existente
      const { date, time } = splitDateTime(evolution.created_at);
      setEvolutionDate(date);
      setEvolutionTime(time);

      // Especialidade
      const specialtyId = evolution.specialty_id || patientSpecialtyId || "";
      setSelectedTemplateId(specialtyId);

      // Dados estruturados
      if (evolution.structured_data && Object.keys(evolution.structured_data).length > 0) {
        setStructuredData(evolution.structured_data as StructuredData);
      } else {
        setStructuredData({});
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Erro ao carregar especialidades");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!evolution) return;
    if (!evolutionDate || !evolutionTime) {
      toast.error("Data e hora são obrigatórias");
      return;
    }
    if (evolutionDate > todayDateString()) {
      toast.error("A data não pode ser futura");
      return;
    }
    if (!descricao.trim()) {
      toast.error("A descrição do atendimento é obrigatória");
      return;
    }

    if (selectedTemplate && selectedTemplate.schema.length > 0) {
      const validation = SpecialtyService.validateStructuredData(selectedTemplate.schema, structuredData);
      if (!validation.valid) {
        toast.error(validation.errors[0]);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const hasStructuredData =
        selectedTemplate && selectedTemplate.schema.length > 0 && Object.keys(structuredData).length > 0;

      await onSubmit(evolution.id, {
        descricao,
        escala_dor: escalaDor,
        specialty_id: selectedTemplate?.name !== "Geral" ? selectedTemplateId || null : null,
        structured_data: hasStructuredData ? { ...structuredData } : null,
        created_at: combineDateTime(evolutionDate, evolutionTime),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDescricao("");
    setEscalaDor(5);
    setStructuredData({});
    setSelectedTemplateId("");
    setEvolutionDate("");
    setEvolutionTime("");
    onClose();
  };

  const getPainColor = (level: number) => {
    if (level <= 3) return "text-success";
    if (level <= 6) return "text-warning";
    return "text-destructive";
  };

  const showDynamicForm = selectedTemplate && selectedTemplate.schema.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Editar Evolução Clínica
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{patientName}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Data e Hora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-evolution-date">Data da evolução *</Label>
                <Input
                  id="edit-evolution-date"
                  type="date"
                  value={evolutionDate}
                  max={todayDateString()}
                  onChange={(e) => setEvolutionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-evolution-time">Hora da evolução *</Label>
                <Input
                  id="edit-evolution-time"
                  type="time"
                  value={evolutionTime}
                  onChange={(e) => setEvolutionTime(e.target.value)}
                />
              </div>
            </div>

            {/* Specialty Selector */}
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.description && (
                          <span className="text-xs text-muted-foreground">{template.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Form Fields */}
            {showDynamicForm && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <DynamicFormRenderer
                  schema={selectedTemplate.schema}
                  value={structuredData}
                  onChange={setStructuredData}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição do Atendimento *</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva a evolução do utente, procedimentos realizados, observações..."
                rows={showDynamicForm ? 4 : 6}
                className="resize-none"
              />
            </div>

            {/* Pain Scale */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Escala de Dor (EVA)</Label>
                <span className={cn("font-semibold text-lg", getPainColor(escalaDor))}>{escalaDor}/10</span>
              </div>
              <Slider
                value={[escalaDor]}
                onValueChange={([value]) => setEscalaDor(value)}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sem dor</span>
                <span>Dor moderada</span>
                <span>Dor intensa</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || isSubmitting} className="min-h-[44px] w-full sm:w-auto">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />A guardar...
              </>
            ) : (
              "Guardar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
