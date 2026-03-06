import { useState, useEffect } from "react";
import { getPublicBaseUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Phone, User, Tag, Mail, Loader2, Trash2, Pencil, Package } from "lucide-react";
import { PatientStatementButton } from "./PatientStatementButton";
import { Patient } from "@/services/PatientService";
import { HealthTag } from "@/services/HealthTagService";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { EditPatientModal } from "./EditPatientModal";
import { PackManagerModal } from "@/components/agenda/PackManagerModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClinicInfo } from "@/hooks/useClinicInfo";

interface PatientDetailModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  creditBalance?: number;
  transactions?: any[];
  onAddCredits?: (patientId: string, data: any) => void | Promise<void>;
  onDeletePatient?: (patientId: string) => Promise<void>;
  onUpdatePatient?: (patientId: string, data: Partial<Patient>) => Promise<void>;
  onNavigateToProntuario?: (patientId: string) => void;
}

export function PatientDetailModal({
  patient,
  isOpen,
  onClose,
  onDeletePatient,
  onUpdatePatient,
  onNavigateToProntuario,
}: PatientDetailModalProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [isSendingPortalLink, setIsSendingPortalLink] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { data: clinicInfo } = useClinicInfo();

  useEffect(() => {
    if (isOpen) setActiveTab("info");
  }, [isOpen]);

  if (!patient) return null;

  const healthTags = (patient.health_tags as HealthTag[]) || [];
  const initials = patient.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const handleSendPortalLink = async () => {
    if (!patient.email) {
      toast.error("Este paciente não possui email cadastrado.");
      return;
    }
    setIsSendingPortalLink(true);
    try {
      const portalUrl = `${getPublicBaseUrl()}/patient-portal`;
      const { data, error } = await supabase.functions.invoke("send-patient-portal-link", {
        body: {
          patientEmail: patient.email,
          patientName: patient.full_name,
          portalUrl,
          clinicName: clinicInfo?.name || "Clínica",
          clinicPhone: clinicInfo?.phone,
          clinicEmail: clinicInfo?.email,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Link do portal enviado para ${patient.email}`);
      } else {
        throw new Error(data?.error || "Erro ao enviar email");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar link do portal");
    } finally {
      setIsSendingPortalLink(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!patient || !onDeletePatient) return;
    await onDeletePatient(patient.id);
    toast.success("Paciente desativado com sucesso");
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <span>{patient.full_name}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dados</span>
              </TabsTrigger>
              <TabsTrigger value="tags" className="gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Etiquetas</span>
              </TabsTrigger>
              <TabsTrigger value="packs" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Packs</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Tab Dados ──────────────────────────────────────────── */}
            <TabsContent value="info" className="space-y-4 py-4">
              {onUpdatePatient && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Editar Dados
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">NIF / CPF</p>
                  <p className="font-medium">{patient.cpf || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Data de Nascimento</p>
                  <p className="font-medium">{patient.birth_date || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Telefone</p>
                  <p className="font-medium flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {patient.phone}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Email</p>
                  <p className="font-medium truncate">{patient.email || "-"}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-start gap-2 text-sm mb-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p>{patient.address || "Endereço não informado"}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Contato de Emergência</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">{patient.emergency_contact || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium">{patient.emergency_phone || "-"}</p>
                  </div>
                </div>
              </div>
              {patient.notes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Observações</p>
                  <p className="text-sm">{patient.notes}</p>
                </div>
              )}
            </TabsContent>

            {/* ── Tab Etiquetas ──────────────────────────────────────── */}
            <TabsContent value="tags" className="py-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Etiquetas de saúde ajudam a personalizar o atendimento e gerar alertas durante o agendamento.
                </p>
                {healthTags.length > 0 ? (
                  <HealthTagList tags={healthTags} maxVisible={10} size="md" />
                ) : (
                  <div className="text-center py-6 bg-muted/30 rounded-lg">
                    <Tag className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma etiqueta atribuída</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab Packs ──────────────────────────────────────────── */}
            <TabsContent value="packs" className="py-2">
              <PackManagerModal pacienteId={patient.id} pacienteNome={patient.full_name} />
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-wrap">
              {onDeletePatient && (
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Apagar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleSendPortalLink}
                disabled={!patient.email || isSendingPortalLink}
                className="gap-2"
              >
                {isSendingPortalLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar Link do Portal
              </Button>
              <PatientStatementButton patientId={patient.id} patientName={patient.full_name} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  if (onNavigateToProntuario && patient) {
                    onClose();
                    onNavigateToProntuario(patient.id);
                  }
                }}
                disabled={!onNavigateToProntuario}
              >
                Ver Prontuário
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeletePatient}
        title="Apagar Paciente"
        description="O paciente não aparecerá mais nas listagens, mas os dados serão mantidos para histórico."
        entityName={patient.full_name}
        warnings={[]}
      />

      {onUpdatePatient && (
        <EditPatientModal
          patient={patient}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={onUpdatePatient}
        />
      )}
    </>
  );
}
