import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { CreditBalanceBadge } from "@/components/ui/credit-balance-badge";
import { ScheduleWarningAlert } from "@/components/agenda/ScheduleWarningAlert";
import { HealthTagService, HealthTag } from "@/services/HealthTagService";

interface Patient {
  id: string;
  full_name: string;
  health_tags?: HealthTag[];
}

interface Professional {
  id: string;
  full_name: string;
}

interface Service {
  id: string;
  name: string;
  color: string;
  duration_minutes: number;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlot: { date: Date; hour: number } | null;
  patients: Patient[];
  professionals: Professional[];
  services: Service[];
  onSubmit: (data: {
    pacienteId: string;
    profissionalId: string;
    servicoId: string;
    notes: string;
  }) => void;
  selectedPaciente: string;
  setSelectedPaciente: (value: string) => void;
  selectedProfissional: string;
  setSelectedProfissional: (value: string) => void;
  selectedServico: string;
  setSelectedServico: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  getCreditBalance?: (patientId: string) => number;
}

export function NewSessionModal({
  isOpen,
  onClose,
  selectedSlot,
  patients,
  professionals,
  services,
  onSubmit,
  selectedPaciente,
  setSelectedPaciente,
  selectedProfissional,
  setSelectedProfissional,
  selectedServico,
  setSelectedServico,
  notes,
  setNotes,
  getCreditBalance,
}: NewSessionModalProps) {
  const handleSubmit = () => {
    onSubmit({
      pacienteId: selectedPaciente,
      profissionalId: selectedProfissional,
      servicoId: selectedServico,
      notes,
    });
  };

  // Get selected patient data
  const selectedPatientData = useMemo(() => {
    return patients.find(p => p.id === selectedPaciente);
  }, [patients, selectedPaciente]);

  // Get health tags for selected patient
  const patientHealthTags = useMemo(() => {
    return HealthTagService.parseTags(selectedPatientData?.health_tags as string[] | undefined);
  }, [selectedPatientData]);

  // Get schedule warnings based on health tags and selected time
  const scheduleWarnings = useMemo(() => {
    if (!selectedSlot || patientHealthTags.length === 0) return [];
    return HealthTagService.validateScheduling(patientHealthTags, selectedSlot.hour);
  }, [patientHealthTags, selectedSlot]);

  // Get credit balance for selected patient
  const patientBalance = useMemo(() => {
    if (!selectedPaciente || !getCreditBalance) return null;
    return getCreditBalance(selectedPaciente);
  }, [selectedPaciente, getCreditBalance]);

  const hasInsufficientCredits = patientBalance !== null && patientBalance <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {selectedSlot && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium">
                {format(selectedSlot.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-muted-foreground">
                {String(selectedSlot.hour).padStart(2, '0')}:00
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Select value={selectedPaciente} onValueChange={setSelectedPaciente}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Patient info: Health Tags + Credit Balance */}
            {selectedPatientData && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {patientHealthTags.length > 0 && (
                  <HealthTagList tags={patientHealthTags} maxVisible={3} size="sm" />
                )}
                {patientBalance !== null && (
                  <CreditBalanceBadge balance={patientBalance} size="sm" />
                )}
              </div>
            )}
          </div>

          {/* Schedule Warnings */}
          {scheduleWarnings.length > 0 && (
            <ScheduleWarningAlert warnings={scheduleWarnings} />
          )}

          {/* Insufficient credits warning */}
          {hasInsufficientCredits && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              <p className="font-medium">⚠️ Créditos insuficientes</p>
              <p className="text-xs mt-1">Sessão será agendada com status "Pagamento Pendente".</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Profissional *</Label>
            <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Serviço *</Label>
            <Select value={selectedServico} onValueChange={setSelectedServico}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name} ({s.duration_minutes}min)
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a sessão..."
              rows={3}
              className="min-h-[88px]"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {hasInsufficientCredits ? "Agendar (Pendente)" : "Agendar Sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
