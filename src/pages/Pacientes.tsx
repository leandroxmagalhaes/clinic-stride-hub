import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Phone, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Services and Context (SRP Architecture)
import { useData } from "@/contexts/DataContext";
import { PatientService, Patient } from "@/services/PatientService";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { CreditBalanceBadge } from "@/components/ui/credit-balance-badge";
import { PatientDetailModal } from "@/components/patients/PatientDetailModal";
import { HealthTag } from "@/services/HealthTagService";

export default function Pacientes() {
  const { patients, addPatient, getCreditBalance, addCredits } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    cpf: "",
    birth_date: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
    health_insurance: "",
    notes: "",
  });

  // Use service for filtering
  const filteredPatients = PatientService.filterBySearch(patients, searchTerm);

  // Mock transactions for demo (in production, fetch from Supabase)
  const patientTransactions = useMemo(() => {
    if (!selectedPatient) return [];
    // Demo transactions - in production, call CreditService.getTransactionHistory
    return [];
  }, [selectedPatient]);

  const handleOpenPatient = (patient: Patient) => {
    setSelectedPatient(patient);
  };

  const handleAddCredits = (patientId: string, amount: number, description: string) => {
    addCredits(patientId, amount);
    // In production: await CreditService.purchaseCredits(clinicId, patientId, amount, description);
  };

  const handleCreatePatient = () => {
    const validation = PatientService.validate(formData);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    try {
      const newPatient = PatientService.create(formData);
      addPatient(newPatient);
      toast.success("Paciente cadastrado com sucesso!");
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar paciente");
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      cpf: "",
      birth_date: "",
      gender: "",
      phone: "",
      email: "",
      address: "",
      emergency_contact: "",
      emergency_phone: "",
      health_insurance: "",
      notes: "",
    });
  };

  return (
    <AppLayout
      title="Pacientes"
      subtitle={`${patients.length} pacientes cadastrados`}
      actions={
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Paciente
        </Button>
      }
    >
      <div className="space-y-4 animate-fade-in">
        {/* Search */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Patients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => {
            const healthTags = (patient.health_tags as HealthTag[]) || [];
            const balance = getCreditBalance(patient.id);
            
            return (
              <Card
                key={patient.id}
                className="shadow-card hover:shadow-medium transition-shadow cursor-pointer"
                onClick={() => handleOpenPatient(patient)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{patient.full_name}</h3>
                        {patient.is_active ? (
                          <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{patient.phone}</span>
                        </div>
                        {patient.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{patient.email}</span>
                          </div>
                        )}
                      </div>
                      {/* Health Tags & Credits */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <CreditBalanceBadge balance={balance} size="sm" showTooltip={false} />
                        {healthTags.length > 0 && (
                          <HealthTagList tags={healthTags} maxVisible={2} size="sm" showTooltip={false} />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredPatients.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-1">Nenhum paciente encontrado</h3>
              <p className="text-sm text-muted-foreground">
                Tente ajustar sua busca ou cadastre um novo paciente
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Patient Details Modal with Tabs */}
      <PatientDetailModal
        patient={selectedPatient}
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        creditBalance={selectedPatient ? getCreditBalance(selectedPatient.id) : 0}
        transactions={patientTransactions}
        onAddCredits={handleAddCredits}
      />

      {/* New Patient Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Paciente</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nome completo do paciente"
                />
              </div>

              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>

              <div className="space-y-2">
                <Label>Contato de Emergência</Label>
                <Input
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  placeholder="Nome do contato"
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone de Emergência</Label>
                <Input
                  value={formData.emergency_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Convênio</Label>
                <Input
                  value={formData.health_insurance}
                  onChange={(e) => setFormData({ ...formData, health_insurance: e.target.value })}
                  placeholder="Nome do convênio (se houver)"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais sobre o paciente..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePatient}>
              Cadastrar Paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
