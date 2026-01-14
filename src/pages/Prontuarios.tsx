import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  FileText, 
  Activity,
  Clock,
  User,
  ChevronRight,
} from "lucide-react";
import { mockProntuarios } from "@/lib/mock-data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { EvolutionService } from "@/services/EvolutionService";

export default function Prontuarios() {
  const { patients, professionals, evolutions, addEvolution } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProntuario, setSelectedProntuario] = useState<typeof mockProntuarios[0] | null>(null);
  const [isNewEvolucaoOpen, setIsNewEvolucaoOpen] = useState(false);

  // Form state for new evolution
  const [evolucaoForm, setEvolucaoForm] = useState({
    descricao: "",
    escala_dor: 5,
  });

  const filteredPacientes = patients.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProntuarioForPatient = (pacienteId: string) => {
    return mockProntuarios.find((p) => p.paciente_id === pacienteId);
  };

  const getEvolucoesForProntuario = (prontuarioId: string) => {
    return EvolutionService.getByProntuario(evolutions, prontuarioId);
  };

  const handleSelectPatient = (pacienteId: string) => {
    const prontuario = getProntuarioForPatient(pacienteId);
    if (prontuario) {
      setSelectedProntuario(prontuario);
    } else {
      // Create mock prontuario for patients without one
      const paciente = patients.find((p) => p.id === pacienteId);
      if (paciente) {
        setSelectedProntuario({
          id: `pront-new-${pacienteId}`,
          clinic_id: "demo-clinic-001",
          paciente_id: pacienteId,
          anamnese: "",
          diagnostico: "",
          objetivos: "",
          observacoes: "",
          paciente: paciente as any,
        });
      }
    }
  };

  const handleCreateEvolucao = () => {
    if (!selectedProntuario) {
      toast.error("Selecione um paciente primeiro");
      return;
    }

    // Get first professional as default (in real app, would be the logged user)
    const defaultProfessional = professionals[0];

    try {
      const newEvolution = EvolutionService.create(
        {
          prontuario_id: selectedProntuario.id,
          profissional_id: defaultProfessional.id,
          descricao: evolucaoForm.descricao,
          escala_dor: evolucaoForm.escala_dor,
        },
        defaultProfessional.full_name
      );

      addEvolution(newEvolution);
      toast.success("Evolução registrada com sucesso!");
      setIsNewEvolucaoOpen(false);
      setEvolucaoForm({ descricao: "", escala_dor: 5 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar evolução");
    }
  };

  const prontuarioEvolutions = selectedProntuario 
    ? getEvolucoesForProntuario(selectedProntuario.id)
    : [];

  const getPainColor = (level: number) => {
    if (level <= 3) return "text-success";
    if (level <= 6) return "text-warning";
    return "text-destructive";
  };

  return (
    <AppLayout
      title="Prontuários"
      subtitle="Histórico clínico dos pacientes"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Patient List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-0">
              <div className="divide-y max-h-[500px] overflow-y-auto scrollbar-thin">
                {filteredPacientes.map((patient) => {
                  const hasProntuario = !!getProntuarioForPatient(patient.id);
                  const isSelected = selectedProntuario?.paciente_id === patient.id;

                  return (
                    <div
                      key={patient.id}
                      className={cn(
                        "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                        isSelected && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                      onClick={() => handleSelectPatient(patient.id)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{patient.full_name}</p>
                        <p className="text-xs text-muted-foreground">{patient.phone}</p>
                      </div>
                      {hasProntuario && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">
                          <FileText className="h-3 w-3 mr-1" />
                          Prontuário
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prontuario Detail */}
        <div className="lg:col-span-8">
          {selectedProntuario ? (
            <div className="space-y-4">
              {/* Patient Header */}
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {selectedProntuario.paciente?.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-display text-xl font-semibold">
                          {selectedProntuario.paciente?.full_name}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedProntuario.paciente?.phone} • {selectedProntuario.paciente?.email}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => setIsNewEvolucaoOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nova Evolução
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="evolucoes" className="space-y-4">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="evolucoes" className="gap-2">
                    <Activity className="h-4 w-4" />
                    Evoluções
                  </TabsTrigger>
                  <TabsTrigger value="prontuario" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Prontuário
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="evolucoes">
                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-lg">
                        Histórico de Evoluções
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {prontuarioEvolutions.length > 0 ? (
                        <div className="space-y-4">
                          {prontuarioEvolutions.map((evolucao) => (
                            <div
                              key={evolucao.id}
                              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {format(new Date(evolucao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </div>
                                {evolucao.escala_dor !== null && (
                                  <Badge variant="outline" className={cn("text-xs", getPainColor(evolucao.escala_dor))}>
                                    Dor: {evolucao.escala_dor}/10
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm leading-relaxed mb-3">
                                {evolucao.descricao}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {evolucao.profissional?.full_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                          <h3 className="font-semibold mb-1">Nenhuma evolução registrada</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Registre a primeira evolução clínica deste paciente
                          </p>
                          <Button onClick={() => setIsNewEvolucaoOpen(true)} variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Evolução
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="prontuario">
                  <Card className="shadow-card">
                    <CardContent className="p-6 space-y-6">
                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                          Anamnese
                        </Label>
                        <p className="mt-2 text-sm">
                          {selectedProntuario.anamnese || "Não informada"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                          Diagnóstico
                        </Label>
                        <p className="mt-2 text-sm">
                          {selectedProntuario.diagnostico || "Não informado"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                          Objetivos do Tratamento
                        </Label>
                        <p className="mt-2 text-sm">
                          {selectedProntuario.objetivos || "Não informados"}
                        </p>
                      </div>

                      {selectedProntuario.observacoes && (
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                            Observações
                          </Label>
                          <p className="mt-2 text-sm">
                            {selectedProntuario.observacoes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <Card className="shadow-card h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-display text-lg font-semibold mb-1">
                  Selecione um Paciente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Clique em um paciente para ver seu prontuário
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New Evolution Modal */}
      <Dialog open={isNewEvolucaoOpen} onOpenChange={setIsNewEvolucaoOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Nova Evolução Clínica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Descrição do Atendimento *</Label>
              <Textarea
                value={evolucaoForm.descricao}
                onChange={(e) => setEvolucaoForm({ ...evolucaoForm, descricao: e.target.value })}
                placeholder="Descreva a evolução do paciente, procedimentos realizados, observações..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Escala de Dor (EVA)</Label>
                <span className={cn("font-semibold text-lg", getPainColor(evolucaoForm.escala_dor))}>
                  {evolucaoForm.escala_dor}/10
                </span>
              </div>
              <Slider
                value={[evolucaoForm.escala_dor]}
                onValueChange={([value]) => setEvolucaoForm({ ...evolucaoForm, escala_dor: value })}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewEvolucaoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEvolucao}>
              Registrar Evolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
