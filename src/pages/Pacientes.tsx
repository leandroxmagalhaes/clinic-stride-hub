import { useState } from "react";
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
import { Plus, Search, Phone, Mail, MapPin, AlertCircle } from "lucide-react";
import { mockPacientes } from "@/lib/mock-data";
import { toast } from "sonner";

export default function Pacientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<typeof mockPacientes[0] | null>(null);

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

  const filteredPatients = mockPacientes.filter(
    (p) =>
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  const handleOpenPatient = (patient: typeof mockPacientes[0]) => {
    setSelectedPatient(patient);
  };

  const handleCreatePatient = () => {
    if (!formData.full_name || !formData.phone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    toast.success("Paciente cadastrado com sucesso!");
    setIsModalOpen(false);
    resetForm();
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
      subtitle={`${mockPacientes.length} pacientes cadastrados`}
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
          {filteredPatients.map((patient) => (
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
                    {patient.health_insurance && (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {patient.health_insurance}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

      {/* Patient Details Modal */}
      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedPatient?.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {selectedPatient?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">CPF</p>
                  <p className="font-medium">{selectedPatient.cpf || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Data de Nascimento</p>
                  <p className="font-medium">{selectedPatient.birth_date || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Telefone</p>
                  <p className="font-medium">{selectedPatient.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Email</p>
                  <p className="font-medium truncate">{selectedPatient.email || "-"}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-start gap-2 text-sm mb-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p>{selectedPatient.address || "Endereço não informado"}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Contato de Emergência</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">{selectedPatient.emergency_contact || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium">{selectedPatient.emergency_phone || "-"}</p>
                  </div>
                </div>
              </div>

              {selectedPatient.notes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Observações</p>
                  <p className="text-sm">{selectedPatient.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPatient(null)}>
              Fechar
            </Button>
            <Button>Ver Prontuário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
