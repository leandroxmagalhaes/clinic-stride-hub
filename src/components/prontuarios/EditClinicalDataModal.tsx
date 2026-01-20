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
import { FileText } from "lucide-react";
import { toast } from "sonner";

interface ClinicalData {
  anamnese: string;
  diagnostico: string;
  objetivos: string;
  observacoes: string;
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

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setFormData(currentData);
    }
  }, [isOpen, currentData]);

  const handleSave = () => {
    onSave(prontuarioId, formData);
    toast.success("Dados clínicos atualizados com sucesso!");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Editar Dados Clínicos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{patientName}</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
