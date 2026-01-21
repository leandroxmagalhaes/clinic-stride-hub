import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { EngagementService } from "@/services/EngagementService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface NewFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Patient {
  id: string;
  full_name: string;
}

export function NewFeedbackModal({ isOpen, onClose, onSuccess }: NewFeedbackModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [score, setScore] = useState<number>(8);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPatients();
      fetchClinicId();
    }
  }, [isOpen]);

  const fetchPatients = async () => {
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');
    
    if (!error && data) {
      setPatients(data);
    }
  };

  const fetchClinicId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();
      
      if (data?.clinic_id) {
        setClinicId(data.clinic_id);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast.error('Selecione um utente');
      return;
    }

    if (!clinicId) {
      toast.error('Clínica não encontrada');
      return;
    }

    setIsLoading(true);

    const success = await EngagementService.addFeedback(
      selectedPatient,
      score,
      comment || null,
      clinicId
    );

    setIsLoading(false);

    if (success) {
      toast.success('Feedback registado com sucesso!');
      onSuccess();
      handleClose();
    } else {
      toast.error('Erro ao registar feedback');
    }
  };

  const handleClose = () => {
    setSelectedPatient('');
    setScore(8);
    setComment('');
    onClose();
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 9) return 'Excelente! 🌟';
    if (score >= 7) return 'Bom 👍';
    if (score >= 5) return 'Regular 😐';
    if (score >= 3) return 'Fraco 😕';
    return 'Muito insatisfeito 😞';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 9) return 'text-green-600';
    if (score >= 7) return 'text-yellow-600';
    if (score >= 5) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-600" />
            Registar Feedback
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Utente</Label>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o utente..." />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>
              Pontuação NPS: <span className={`font-bold ${getScoreColor(score)}`}>{score}</span>
            </Label>
            <div className="px-2">
              <Slider
                value={[score]}
                onValueChange={([value]) => setScore(value)}
                min={0}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
            <p className={`text-center text-sm ${getScoreColor(score)}`}>
              {getScoreLabel(score)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Comentário (opcional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="O que o utente disse sobre a clínica..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'A guardar...' : 'Guardar Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
