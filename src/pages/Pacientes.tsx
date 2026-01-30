import { useState, useMemo, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Phone, Mail, AlertCircle, ExternalLink, FileUp } from "lucide-react";
import { ImportPatientsModal } from "@/components/patients/ImportPatientsModal";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

// Services and Context (SRP Architecture)
import { useData } from "@/contexts/DataContext";
import { PatientService, Patient } from "@/services/PatientService";
import { CreditService } from "@/services/CreditService";
import { HealthTagList } from "@/components/ui/health-tag-badge";
import { CreditBalanceBadge } from "@/components/ui/credit-balance-badge";
import { PatientDetailModal } from "@/components/patients/PatientDetailModal";
import { CreditPurchaseData } from "@/components/patients/AddCreditsModal";
import { HealthTag } from "@/services/HealthTagService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TableSkeleton } from "@/components/skeletons/PageSkeletons";

export default function Pacientes() {
  const { patients, refreshPatients, getCreditBalance, addCredits, deletePatient, updatePatient, isLoading } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [clinicId, setClinicId] = useState<string | null>(null);
  
  // Fetch clinic_id for the current user
  useEffect(() => {
    async function fetchClinicId() {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("ERRO SUPABASE (fetch clinic_id):", error);
        toast.error(`Erro ao identificar clínica: ${error.message}`);
        setClinicId(null);
        return;
      }

      if (!data?.clinic_id) {
        toast.error("Clínica não identificada para este usuário.");
        setClinicId(null);
        return;
      }

      setClinicId(data.clinic_id);
    }

    fetchClinicId();
  }, [user]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
    privacy_consent: false,
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

  const handleAddCredits = async (patientId: string, data: CreditPurchaseData) => {
    // Basic UUID sanity check (helps catch undefined / wrong IDs)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(patientId)) {
      const msg = `patient_id inválido (UUID esperado): ${patientId}`;
      console.error(msg);
      toast.error(msg);
      throw new Error(msg);
    }

    if (!clinicId) {
      const msg = "Clínica não identificada. Faça login novamente.";
      toast.error(msg);
      throw new Error(msg);
    }

    const result = await CreditService.purchaseCredits(clinicId, patientId, data.amount, {
      description: data.description,
      monetaryValue: data.monetaryValue,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
    });

    if (!result.success) {
      const msg = result.error || "Erro ao adicionar créditos";
      toast.error(msg);
      throw new Error(msg);
    }

    // Also update local state for immediate UI feedback
    addCredits(patientId, data.amount);
  };

  const handleUpdatePatient = async (patientId: string, data: Partial<Patient>) => {
    const { error } = await supabase
      .from("pacientes")
      .update(data)
      .eq("id", patientId);

    if (error) {
      toast.error(`Erro ao atualizar paciente: ${error.message}`);
      throw error;
    }

    updatePatient(patientId, data);
    
    // Also update selectedPatient if it's the one being edited
    if (selectedPatient?.id === patientId) {
      setSelectedPatient({ ...selectedPatient, ...data } as Patient);
    }
    
    toast.success("Dados do paciente atualizados!");
  };

  const handleNavigateToProntuario = (patientId: string) => {
    setSelectedPatient(null);
    navigate(`/prontuarios?paciente=${patientId}`);
  };

  const handleCreatePatient = async () => {
    const validation = PatientService.validate(formData);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    // Check privacy consent
    if (!formData.privacy_consent) {
      toast.error("Você deve aceitar a Política de Privacidade para cadastrar o paciente.");
      return;
    }

    try {
      if (!clinicId) {
        toast.error("Clínica não identificada. Faça login novamente.");
        return;
      }

      const payload = {
        clinic_id: clinicId,
        full_name: formData.full_name.trim(),
        cpf: formData.cpf || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact: formData.emergency_contact || null,
        emergency_phone: formData.emergency_phone || null,
        health_insurance: formData.health_insurance || null,
        notes: formData.notes || null,
        health_tags: [],
        is_active: true,
        privacy_consent_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("pacientes")
        .insert(payload);

      if (error) {
        console.error("ERRO SUPABASE (pacientes INSERT):", error);
        toast.error(`Erro ao cadastrar paciente: ${error.message}`);
        return;
      }

      await refreshPatients();
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
      privacy_consent: false,
    });
  };

  // Show skeleton while loading
  if (isLoading) {
    return (
      <AppLayout
        title="Pacientes"
        subtitle="Carregando..."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled className="gap-2">
              <FileUp className="h-4 w-4" />
              <span className="hidden sm:inline">Importar Planilha</span>
            </Button>
            <Button disabled className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Paciente</span>
            </Button>
          </div>
        }
      >
        <TableSkeleton rows={6} />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Pacientes"
      subtitle={`${patients.length} pacientes cadastrados`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="gap-2">
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">Importar Planilha</span>
            <span className="sm:hidden">Importar</span>
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Paciente</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
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
        onDeletePatient={deletePatient}
        onUpdatePatient={handleUpdatePatient}
        onNavigateToProntuario={handleNavigateToProntuario}
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
                <Label>NIF / CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="Número fiscal (9-14 dígitos)"
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
                  placeholder="+351 912 345 678"
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
                <Label>Morada</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Morada, número, localidade, código postal"
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
                  placeholder="+351 912 345 678"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Seguradora / Entidade</Label>
                <Input
                  value={formData.health_insurance}
                  onChange={(e) => setFormData({ ...formData, health_insurance: e.target.value })}
                  placeholder="Nome da seguradora (se aplicável)"
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

              {/* Privacy Consent Checkbox */}
              <div className="col-span-2 space-y-3 pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privacy_consent"
                    checked={formData.privacy_consent}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, privacy_consent: checked === true })
                    }
                    className="mt-0.5"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="privacy_consent"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Aceito a Política de Privacidade *
                    </label>
                    <p className="text-xs text-muted-foreground">
                      O paciente foi informado e concorda com o tratamento dos seus dados pessoais 
                      conforme descrito na{" "}
                      <Link 
                        to="/privacy" 
                        target="_blank" 
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Política de Privacidade
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      .
                    </p>
                  </div>
                </div>
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

      {/* Import Patients Modal */}
      {clinicId && (
        <ImportPatientsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          clinicId={clinicId}
          onImportComplete={() => {
            refreshPatients();
            toast.success("Pacientes importados com sucesso!");
          }}
        />
      )}
    </AppLayout>
  );
}
