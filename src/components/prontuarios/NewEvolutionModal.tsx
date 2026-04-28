// NewEvolutionModal - Modal for creating clinical evolutions with specialty templates
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DynamicFormRenderer } from "./DynamicFormRenderer";
import { VoiceRecordButton } from "./VoiceRecordButton";
import { AISuggestionPanel } from "@/components/ai/AISuggestionPanel";
import { AIService } from "@/services/AIService";
import { SpecialtyService, type SpecialtyTemplate, type StructuredData } from "@/services/SpecialtyService";

interface NewEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  prontuarioId: string;
  patientSpecialtyId?: string | null;
  prefilledDate?: string | null; // ── Data pré-preenchida vinda da agenda
  onSubmit: (data: {
    descricao: string;
    escala_dor: number;
    specialty_id: string | null;
    structured_data: StructuredData | null;
    evolution_date?: string | null;
    created_at?: string | null;
  }) => void;
}

// Helpers para data/hora
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTimeString(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function NewEvolutionModal({
  isOpen,
  onClose,
  patientName,
  prontuarioId,
  patientSpecialtyId,
  prefilledDate,
  onSubmit,
}: NewEvolutionModalProps) {
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialtyTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPatientSpecialty = !!patientSpecialtyId;

  const [descricao, setDescricao] = useState("");
  const [escalaDor, setEscalaDor] = useState(0);
  const [structuredData, setStructuredData] = useState<StructuredData>({});
  const [evolutionDate, setEvolutionDate] = useState<string>(prefilledDate || todayDateString());
  const [evolutionTime, setEvolutionTime] = useState<string>(nowTimeString());

  const [isStructuring, setIsStructuring] = useState(false);
  const [soapSuggestion, setSoapSuggestion] = useState<string | null>(null);
  const [rawTranscription, setRawTranscription] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setEvolutionDate(prefilledDate || todayDateString());
      setEvolutionTime(nowTimeString());
    }
  }, [isOpen, prefilledDate]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
      if (template && template.schema.length > 0) {
        setStructuredData(SpecialtyService.createEmptyStructuredData(template.schema));
      } else {
        setStructuredData({});
      }
    } else {
      setSelectedTemplate(null);
      setStructuredData({});
    }
  }, [selectedTemplateId, templates]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await SpecialtyService.getTemplates();
      setTemplates(data);
      if (patientSpecialtyId) {
        setSelectedTemplateId(patientSpecialtyId);
      } else {
        const geralTemplate = data.find((t) => t.name === "Geral");
        if (geralTemplate) setSelectedTemplateId(geralTemplate.id);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Erro ao carregar especialidades");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
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

      let finalStructuredData: StructuredData | null = hasStructuredData ? { ...structuredData } : null;
      if (rawTranscription) {
        finalStructuredData = {
          ...(finalStructuredData || {}),
          voice_recording_at: new Date().toISOString(),
          raw_transcription: rawTranscription,
          soap_structured: "true",
        } as StructuredData;
      }

      onSubmit({
        descricao,
        escala_dor: escalaDor,
        specialty_id: selectedTemplate?.name !== "Geral" ? selectedTemplateId : null,
        structured_data: finalStructuredData,
        evolution_date: prefilledDate || null, // ── passa data da sessão
        created_at: combineDateTime(evolutionDate, evolutionTime),
      });

      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDescricao("");
    setEscalaDor(0);
    setStructuredData({});
    setSoapSuggestion(null);
    setRawTranscription(null);
    setIsStructuring(false);
    setEvolutionDate(prefilledDate || todayDateString());
    setEvolutionTime(nowTimeString());
    if (patientSpecialtyId) {
      setSelectedTemplateId(patientSpecialtyId);
    } else {
      const geralTemplate = templates.find((t) => t.name === "Geral");
      if (geralTemplate) setSelectedTemplateId(geralTemplate.id);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleVoiceTranscription = async (rawText: string) => {
    setRawTranscription(rawText);
    try {
      const result = await AIService.structureVoiceEvolution({
        rawTranscription: rawText,
        patientName,
        painLevel: escalaDor,
      });
      setSoapSuggestion(result.data.formattedText);
    } catch (err) {
      console.error("Error structuring voice:", err);
      toast.error("Erro ao estruturar texto com IA. O texto bruto foi mantido.");
      setDescricao(rawText);
      setSoapSuggestion(null);
    } finally {
      setIsStructuring(false);
    }
  };

  const handleAcceptSoap = (text: string) => {
    setDescricao(text);
    setSoapSuggestion(null);
    toast.success("Texto SOAP aceite!");
  };

  const handleRejectSoap = () => {
    if (rawTranscription) setDescricao(rawTranscription);
    setSoapSuggestion(null);
    setRawTranscription(null);
    toast.info("Sugestão rejeitada. Transcrição bruta aplicada.");
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
            Nova Evolução Clínica
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {patientName}
            {/* ── Mostra data da sessão se veio da agenda ── */}
            {prefilledDate && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Sessão de {new Date(prefilledDate + "T12:00:00").toLocaleDateString("pt-PT")}
              </span>
            )}
          </p>
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
                <Label htmlFor="new-evolution-date">Data da evolução *</Label>
                <Input
                  id="new-evolution-date"
                  type="date"
                  value={evolutionDate}
                  max={todayDateString()}
                  onChange={(e) => setEvolutionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-evolution-time">Hora da evolução *</Label>
                <Input
                  id="new-evolution-time"
                  type="time"
                  value={evolutionTime}
                  onChange={(e) => setEvolutionTime(e.target.value)}
                />
              </div>
            </div>

            {/* Specialty Selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Especialidade
                {hasPatientSpecialty && (
                  <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Padrão (Anamnese)</span>
                )}
              </Label>
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
              {hasPatientSpecialty ? (
                <p className="text-xs text-muted-foreground">
                  ℹ️ Pode alterar a especialidade para esta sessão específica
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  💡 Defina a especialidade na Anamnese para pré-carregar automaticamente
                </p>
              )}
            </div>

            {showDynamicForm && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <DynamicFormRenderer
                  schema={selectedTemplate.schema}
                  value={structuredData}
                  onChange={setStructuredData}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descrição do Atendimento *</Label>
                <VoiceRecordButton
                  onTranscriptionComplete={handleVoiceTranscription}
                  onStructuringStart={() => setIsStructuring(true)}
                  disabled={isSubmitting || isStructuring}
                />
              </div>

              {soapSuggestion && (
                <AISuggestionPanel
                  suggestion={soapSuggestion}
                  onAccept={handleAcceptSoap}
                  onReject={handleRejectSoap}
                  title="Evolução SOAP (por voz)"
                />
              )}

              {isStructuring && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />A estruturar transcrição em formato SOAP...
                </div>
              )}

              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva a evolução do utente, procedimentos realizados, observações... ou use o microfone para ditar."
                rows={showDynamicForm ? 4 : 6}
                className="resize-none"
              />
            </div>

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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />A registar...
              </>
            ) : (
              "Registar Evolução"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
