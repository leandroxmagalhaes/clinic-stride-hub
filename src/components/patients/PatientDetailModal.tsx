import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Phone, Coins, History, User, Tag } from "lucide-react";
import { Patient } from "@/services/PatientService";
import { HealthTag } from "@/services/HealthTagService";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { CreditBalanceBadge } from "@/components/ui/credit-balance-badge";
import { AddCreditsModal, CreditPurchaseData } from "./AddCreditsModal";
import { TransactionHistory, Transaction } from "./TransactionHistory";

interface PatientDetailModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  creditBalance: number;
  transactions: Transaction[];
  onAddCredits: (patientId: string, data: CreditPurchaseData) => void | Promise<void>;
}

export function PatientDetailModal({
  patient,
  isOpen,
  onClose,
  creditBalance,
  transactions,
  onAddCredits,
}: PatientDetailModalProps) {
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("info");
    }
  }, [isOpen]);

  if (!patient) return null;

  const healthTags = (patient.health_tags as HealthTag[]) || [];
  const initials = patient.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const handleAddCredits = async (data: CreditPurchaseData) => {
    await onAddCredits(patient.id, data);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <span>{patient.full_name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <CreditBalanceBadge balance={creditBalance} size="sm" />
                </div>
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
              <TabsTrigger value="credits" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Créditos</span>
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">CPF</p>
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

            {/* Health Tags Tab */}
            <TabsContent value="tags" className="py-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Etiquetas de saúde ajudam a personalizar o atendimento e gerar alertas
                    durante o agendamento.
                  </p>
                  {healthTags.length > 0 ? (
                    <HealthTagList tags={healthTags} maxVisible={10} size="md" />
                  ) : (
                    <div className="text-center py-6 bg-muted/30 rounded-lg">
                      <Tag className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma etiqueta atribuída
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Credits Tab */}
            <TabsContent value="credits" className="py-4">
              <div className="space-y-4">
                {/* Credit Summary */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo atual</p>
                    <p className="text-2xl font-bold">{creditBalance}</p>
                  </div>
                  <Button
                    onClick={() => setIsAddCreditsOpen(true)}
                    className="gap-2"
                  >
                    <Coins className="h-4 w-4" />
                    Adicionar Créditos
                  </Button>
                </div>

                {/* Transaction History */}
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Extrato de Transações
                  </p>
                  <TransactionHistory transactions={transactions} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button>Ver Prontuário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits Sub-Modal */}
      <AddCreditsModal
        isOpen={isAddCreditsOpen}
        onClose={() => setIsAddCreditsOpen(false)}
        patientName={patient.full_name}
        patientId={patient.id}
        onAddCredits={handleAddCredits}
      />
    </>
  );
}
