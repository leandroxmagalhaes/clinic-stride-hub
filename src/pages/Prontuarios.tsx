import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  FileText, 
  Activity,
  Clock,
  User,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { mockProntuarios } from "@/lib/mock-data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { EvolutionService } from "@/services/EvolutionService";
import { EditClinicalDataModal } from "@/components/prontuarios/EditClinicalDataModal";
import { NewEvolutionModal } from "@/components/prontuarios/NewEvolutionModal";
import { StructuredDataViewer } from "@/components/prontuarios/StructuredDataViewer";
import { SpecialtyService, type SpecialtyTemplate, type StructuredData } from "@/services/SpecialtyService";

// Local state for prontuarios (will be moved to DataContext later)
interface ProntuarioData {
  id: string;
  clinic_id: string;
  paciente_id: string;
  anamnese: string;
  diagnostico: string;
  objetivos: string;
  observacoes: string;
  primary_specialty_id: string | null;
  paciente?: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
    primary_specialty_id?: string | null;
  };
}

export default function Prontuarios() {
  const { patients, professionals, evolutions, addEvolution } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProntuario, setSelectedProntuario] = useState<ProntuarioData | null>(null);
  const [isNewEvolucaoOpen, setIsNewEvolucaoOpen] = useState(false);
  const [isEditClinicalOpen, setIsEditClinicalOpen] = useState(false);
  
  // Specialty templates cache for displaying structured data
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);

  // Load templates on mount
  useEffect(() => {
    SpecialtyService.getTemplates()
      .then(setTemplates)
      .catch(console.error);
  }, []);

  // Local state for prontuarios data (persisted changes)
  const [prontuariosData, setProntuariosData] = useState<Record<string, ProntuarioData>>(() => {
    // Initialize from mock data
    const initial: Record<string, ProntuarioData> = {};
    mockProntuarios.forEach(p => {
      const data: ProntuarioData = {
        id: p.id,
        clinic_id: p.clinic_id,
        paciente_id: p.paciente_id,
        anamnese: p.anamnese,
        diagnostico: p.diagnostico,
        objetivos: p.objetivos,
        observacoes: p.observacoes,
        primary_specialty_id: null,
      };
      initial[p.paciente_id] = data;
    });
    return initial;
  });

  const filteredPacientes = patients.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProntuarioForPatient = (pacienteId: string): ProntuarioData | undefined => {
    return prontuariosData[pacienteId];
  };

  const getEvolucoesForProntuario = (prontuarioId: string) => {
    return EvolutionService.getByProntuario(evolutions, prontuarioId);
  };

  const handleSelectPatient = (pacienteId: string) => {
    const existingProntuario = getProntuarioForPatient(pacienteId);
    const paciente = patients.find((p) => p.id === pacienteId);
    
    if (existingProntuario) {
      setSelectedProntuario({
        ...existingProntuario,
        paciente: {
          ...paciente as any,
          primary_specialty_id: existingProntuario.primary_specialty_id,
        },
      });
    } else if (paciente) {
      // Create new prontuario for patient
      const newProntuario: ProntuarioData = {
        id: `pront-new-${pacienteId}`,
        clinic_id: "demo-clinic-001",
        paciente_id: pacienteId,
        anamnese: "",
        diagnostico: "",
        objetivos: "",
        observacoes: "",
        primary_specialty_id: null,
        paciente: {
          ...paciente as any,
          primary_specialty_id: null,
        },
      };
      setProntuariosData(prev => ({
        ...prev,
        [pacienteId]: newProntuario,
      }));
      setSelectedProntuario(newProntuario);
    }
  };

  const handleCreateEvolucao = (data: {
    descricao: string;
    escala_dor: number;
    specialty_id: string | null;
    structured_data: StructuredData | null;
  }) => {
    if (!selectedProntuario) {
      toast.error("Selecione um utente primeiro");
      return;
    }

    // Get first professional as default (in real app, would be the logged user)
    const defaultProfessional = professionals[0];

    try {
      const newEvolution = EvolutionService.create(
        {
          prontuario_id: selectedProntuario.id,
          profissional_id: defaultProfessional.id,
          descricao: data.descricao,
          escala_dor: data.escala_dor,
          specialty_id: data.specialty_id,
          structured_data: data.structured_data,
        },
        defaultProfessional.full_name
      );

      addEvolution(newEvolution);
      toast.success("Evolução registada com sucesso!");
      setIsNewEvolucaoOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registar evolução");
    }
  };

  // Get template for an evolution
  const getTemplateForEvolution = (specialtyId: string | null | undefined): SpecialtyTemplate | null => {
    if (!specialtyId) return null;
    return templates.find(t => t.id === specialtyId) || null;
  };

  const handleSaveClinicalData = (prontuarioId: string, data: {
    anamnese: string;
    diagnostico: string;
    objetivos: string;
    observacoes: string;
    primary_specialty_id: string | null;
  }) => {
    if (!selectedProntuario) return;

    const updated: ProntuarioData = {
      ...selectedProntuario,
      ...data,
      paciente: selectedProntuario.paciente ? {
        ...selectedProntuario.paciente,
        primary_specialty_id: data.primary_specialty_id,
      } : undefined,
    };

    setProntuariosData(prev => ({
      ...prev,
      [selectedProntuario.paciente_id]: updated,
    }));
    setSelectedProntuario(updated);
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
                  placeholder="Buscar utente..."
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
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsEditClinicalOpen(true)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar Dados Clínicos
                      </Button>
                      <Button onClick={() => setIsNewEvolucaoOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Evolução
                      </Button>
                    </div>
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
                          {prontuarioEvolutions.map((evolucao) => {
                            const template = getTemplateForEvolution(evolucao.specialty_id);
                            const hasStructuredData = evolucao.structured_data && 
                              template && 
                              Object.keys(evolucao.structured_data).length > 0;

                            return (
                              <div
                                key={evolucao.id}
                                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    {format(new Date(evolucao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {template && (
                                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                        {template.name}
                                      </Badge>
                                    )}
                                    {evolucao.escala_dor !== null && (
                                      <Badge variant="outline" className={cn("text-xs", getPainColor(evolucao.escala_dor))}>
                                        Dor: {evolucao.escala_dor}/10
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Structured Data Display */}
                                {hasStructuredData && template && (
                                  <div className="mb-3 p-3 bg-muted/20 rounded-md">
                                    <StructuredDataViewer
                                      schema={template.schema}
                                      data={evolucao.structured_data as Record<string, string | number | string[] | null>}
                                      compact
                                    />
                                  </div>
                                )}

                                <p className="text-sm leading-relaxed mb-3">
                                  {evolucao.descricao}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  {evolucao.profissional?.full_name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                          <h3 className="font-semibold mb-1">Nenhuma evolução registada</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Registe a primeira evolução clínica deste utente
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
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="font-display text-lg">Dados Clínicos</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsEditClinicalOpen(true)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Specialty Badge */}
                      {selectedProntuario.primary_specialty_id && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {templates.find(t => t.id === selectedProntuario.primary_specialty_id)?.name || "Especialidade"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Especialidade de tratamento definida
                          </span>
                        </div>
                      )}

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                          Anamnese
                        </Label>
                        <p className="mt-2 text-sm whitespace-pre-wrap">
                          {selectedProntuario.anamnese || (
                            <span className="text-muted-foreground italic">Não informada</span>
                          )}
                        </p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                          Diagnóstico
                        </Label>
                        <p className="mt-2 text-sm whitespace-pre-wrap">
                          {selectedProntuario.diagnostico || (
                            <span className="text-muted-foreground italic">Não informado</span>
                          )}
                        </p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                          Objetivos do Tratamento
                        </Label>
                        <p className="mt-2 text-sm whitespace-pre-wrap">
                          {selectedProntuario.objetivos || (
                            <span className="text-muted-foreground italic">Não informados</span>
                          )}
                        </p>
                      </div>

                      {selectedProntuario.observacoes && (
                        <div>
                          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                            Observações
                          </Label>
                          <p className="mt-2 text-sm whitespace-pre-wrap">
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
                  Selecione um Utente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Clique num utente para ver o seu prontuário
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New Evolution Modal */}
      {selectedProntuario && (
        <NewEvolutionModal
          isOpen={isNewEvolucaoOpen}
          onClose={() => setIsNewEvolucaoOpen(false)}
          patientName={selectedProntuario.paciente?.full_name || ""}
          prontuarioId={selectedProntuario.id}
          patientSpecialtyId={selectedProntuario.primary_specialty_id}
          onSubmit={handleCreateEvolucao}
        />
      )}

      {/* Edit Clinical Data Modal */}
      {selectedProntuario && (
        <EditClinicalDataModal
          isOpen={isEditClinicalOpen}
          onClose={() => setIsEditClinicalOpen(false)}
          patientName={selectedProntuario.paciente?.full_name || ""}
          prontuarioId={selectedProntuario.id}
          currentData={{
            anamnese: selectedProntuario.anamnese,
            diagnostico: selectedProntuario.diagnostico,
            objetivos: selectedProntuario.objetivos,
            observacoes: selectedProntuario.observacoes,
            primary_specialty_id: selectedProntuario.primary_specialty_id,
          }}
          onSave={handleSaveClinicalData}
        />
      )}
    </AppLayout>
  );
}
