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
import { Plus, Search, Phone, Mail, Award, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { ProfessionalService } from "@/services/ProfessionalService";
import { supabase } from "@/integrations/supabase/client";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";

export default function Profissionais() {
  const { professionals, addProfessional, deleteProfessional } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<typeof professionals[0] | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "fisioterapeuta",
    specialty: "",
    crefito: "",
  });

  const filteredProfessionals = ProfessionalService.filter(professionals, searchTerm);

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: "Administrador",
      fisioterapeuta: "Fisioterapeuta",
      recepcionista: "Recepcionista",
    };
    return roles[role] || role;
  };

  const handleCreateProfessional = async () => {
    try {
      // Get clinic_id from user profile
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Utilizador não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!profile?.clinic_id) throw new Error("Clínica não identificada");

      // Insert into database
      const { data: newProf, error } = await supabase
        .from("profissionais")
        .insert({
          clinic_id: profile.clinic_id,
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone?.trim() || null,
          specialty: formData.specialty?.trim() || null,
          council_number: formData.crefito?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newProfessional = {
        id: newProf.id,
        clinic_id: newProf.clinic_id,
        full_name: newProf.full_name,
        email: newProf.email,
        phone: newProf.phone,
        role: formData.role,
        specialty: newProf.specialty,
        crefito: newProf.council_number,
        avatar_url: newProf.avatar_url,
        is_active: newProf.is_active,
      };

      addProfessional(newProfessional);
      toast.success("Profissional cadastrado com sucesso!");
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar profissional");
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      role: "fisioterapeuta",
      specialty: "",
      crefito: "",
    });
  };

  const handleDeleteProfessional = async () => {
    if (!selectedProfessional) return;
    await deleteProfessional(selectedProfessional.id);
    toast.success("Profissional desativado com sucesso");
    setSelectedProfessional(null);
  };
  return (
    <AppLayout
      title="Profissionais"
      subtitle={`${professionals.length} profissionais ativos`}
      actions={
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Profissional
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
                placeholder="Buscar por nome, email ou especialidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Professionals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProfessionals.map((professional) => (
            <Card
              key={professional.id}
              className="shadow-card hover:shadow-medium transition-shadow cursor-pointer"
              onClick={() => setSelectedProfessional(professional)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {professional.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">{professional.full_name}</h3>
                      {professional.is_active ? (
                        <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {getRoleLabel(professional.role)}
                      </Badge>
                      {professional.specialty && (
                        <span className="text-sm text-muted-foreground">
                          {professional.specialty}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{professional.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{professional.phone}</span>
                      </div>
                      {professional.crefito && (
                        <div className="flex items-center gap-2">
                          <Award className="h-3 w-3" />
                          <span>{professional.crefito}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProfessionals.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-1">Nenhum profissional encontrado</h3>
              <p className="text-sm text-muted-foreground">
                Tente ajustar sua busca ou cadastre um novo profissional
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Professional Details Modal */}
      <Dialog open={!!selectedProfessional} onOpenChange={(open) => !open && setSelectedProfessional(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedProfessional?.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {selectedProfessional?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedProfessional && (
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Badge>{getRoleLabel(selectedProfessional.role)}</Badge>
                {selectedProfessional.specialty && (
                  <Badge variant="outline">{selectedProfessional.specialty}</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedProfessional.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">{selectedProfessional.phone}</p>
                  </div>
                </div>

                {selectedProfessional.crefito && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Cédula / Registro Profissional</p>
                      <p className="font-medium">{selectedProfessional.crefito}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Apagar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedProfessional(null)}>
                Fechar
              </Button>
              <Button>Editar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {selectedProfessional && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteProfessional}
          title="Apagar Profissional"
          description="O profissional será desativado e não aparecerá mais nas listagens, mas o histórico será mantido."
          entityName={selectedProfessional.full_name}
        />
      )}

      {/* New Professional Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Profissional</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+351 912 345 678"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="fisioterapeuta">Fisioterapeuta</SelectItem>
                    <SelectItem value="recepcionista">Recepcionista</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Ex: Pilates Clínico"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cédula / Registro Profissional</Label>
              <Input
                value={formData.crefito}
                onChange={(e) => setFormData({ ...formData, crefito: e.target.value })}
                placeholder="Número da cédula profissional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProfessional}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
