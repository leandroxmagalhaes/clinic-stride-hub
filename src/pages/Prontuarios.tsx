import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  ClipboardList,
  ArrowLeft,
  Sparkles,
  ArrowDown,
  ArrowUp,
  Paperclip,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { EvolutionService } from "@/services/EvolutionService";
import { EditClinicalDataModal } from "@/components/prontuarios/EditClinicalDataModal";
import { NewEvolutionModal } from "@/components/prontuarios/NewEvolutionModal";
import { EditEvolutionModal, type EvolutionToEdit } from "@/components/prontuarios/EditEvolutionModal";
import { StructuredDataViewer } from "@/components/prontuarios/StructuredDataViewer";
import { ClinicalReportsList } from "@/components/prontuarios/ClinicalReportsList";
import { PatientDocuments } from "@/components/prontuarios/PatientDocuments";
import { SpecialtyService, type SpecialtyTemplate, type StructuredData } from "@/services/SpecialtyService";
import { supabase } from "@/integrations/supabase/client";
import { useClinicInfo } from "@/hooks/useClinicInfo";
import { AIService, type AIClinicalSummary } from "@/services/AIService";
import { AIAssistButton } from "@/components/ai/AIAssistButton";
import { PreSessionBriefingCard } from "@/components/agenda/PreSessionBriefingCard";
import { usePreSessionBriefing } from "@/hooks/usePreSessionBriefing";
import { PatientDiaryTab } from "@/components/prontuarios/PatientDiaryTab";

interface ProntuarioData {
  id: string;
  clinic_id: string;
  paciente_id: string;
  anamnese: string;
  diagnostico: string;
  objetivos: string;
  observacoes: string;
  primary_specialty_id: string | null;
  initial_assessment_data: StructuredData | null;
  paciente?: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
    primary_specialty_id?: string | null;
  };
}

type SortOrder = "desc" | "asc";

export default function Prontuarios() {
  const { patients, patientsLoading, professionals, evolutions, addEvolution } = useData();
  const { data: clinicInfo } = useClinicInfo();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProntuario, setSelectedProntuario] = useState<ProntuarioData | null>(null);
  const [isNewEvolucaoOpen, setIsNewEvolucaoOpen] = useState(false);
  const [isEditClinicalOpen, setIsEditClinicalOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
  const [editingEvolution, setEditingEvolution] = useState<EvolutionToEdit | null>(null);
  const [isEditEvolutionOpen, setIsEditEvolutionOpen] = useState(false);
  const [prontuariosData, setProntuariosData] = useState<Record<string, ProntuarioData>>({});
  const [prontuariosLoading, setProntuariosLoading] = useState(true);
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);
  const [aiSummary, setAiSummary] = useState<AIClinicalSummary | null>(null);
  const [upcomingSession, setUpcomingSession] = useState<{ id: string; patientId: string } | null>(null);

  useEffect(() => {
    SpecialtyService.getTemplates().then(setTemplates).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchProntuarios = async () => {
      setProntuariosLoading(true);
      try {
        const { data, error } = await supabase.from("prontuarios").select("*");
        if (error) {
          console.error("Error fetching prontuarios:", error);
          return;
        }
        const prontuarios: Record<string, ProntuarioData> = {};
        (data || []).forEach((p: any) => {
          prontuarios[p.paciente_id] = {
            id: p.id,
            clinic_id: p.clinic_id,
            paciente_id: p.paciente_id,
            anamnese: p.anamnese || "",
            diagnostico: p.diagnostico || "",
            objetivos: p.objetivos || "",
            observacoes: p.observacoes || "",
            primary_specialty_id: null,
            initial_assessment_data: null,
          };
        });
        setProntuariosData(prontuarios);
      } catch (err) {
        console.error("Exception fetching prontuarios:", err);
      } finally {
        setProntuariosLoading(false);
      }
    };
    fetchProntuarios();
  }, []);

  useEffect(() => {
    const pacienteId = searchParams.get("paciente");
    const sessaoData = searchParams.get("sessao_data");
    const autoEvolucao = searchParams.get("auto_evolucao");
    if (pacienteId && patients.length > 0 && !prontuariosLoading && !selectedProntuario) {
      if (sessaoData) setPrefilledDate(sessaoData);
      handleSelectPatient(pacienteId).then(() => {
        if (autoEvolucao === "1") setTimeout(() => setIsNewEvolucaoOpen(true), 300);
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, patients, prontuariosLoading]);

  useEffect(() => {
    if (!selectedProntuario?.paciente_id) {
      setUpcomingSession(null);
      return;
    }
    const fetchUpcoming = async () => {
      const now = new Date().toISOString();
      const inHours = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("sessoes")
        .select("id, paciente_id")
        .eq("paciente_id", selectedProntuario.paciente_id)
        .gte("start_time", now)
        .lte("start_time", inHours)
        .eq("status", "agendado")
        .order("start_time", { ascending: true })
        .limit(1);
      setUpcomingSession(data?.[0] ? { id: data[0].id, patientId: data[0].paciente_id } : null);
    };
    fetchUpcoming();
  }, [selectedProntuario?.paciente_id]);

  const {
    briefing: prontuarioBriefing,
    isLoading: briefingLoading,
    refresh: refreshBriefing,
  } = usePreSessionBriefing(upcomingSession?.id || null, upcomingSession?.patientId || null);

  const filteredPacientes = patients.filter((p) => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getProntuarioForPatient = (pacienteId: string) => prontuariosData[pacienteId];
  const getEvolucoesForProntuario = (prontuarioId: string) =>
    EvolutionService.getByProntuario(evolutions, prontuarioId);

  const handleSelectPatient = async (pacienteId: string) => {
    const existingProntuario = getProntuarioForPatient(pacienteId);
    const paciente = patients.find((p) => p.id === pacienteId);
    if (existingProntuario) {
      setSelectedProntuario({
        ...existingProntuario,
        paciente: { ...(paciente as any), primary_specialty_id: existingProntuario.primary_specialty_id },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (paciente) {
      try {
        const { getAuthContext } = await import("@/lib/auth-helpers");
        const { clinicId } = await getAuthContext();
        const { data: newPront, error } = await supabase
          .from("prontuarios")
          .insert({
            clinic_id: clinicId,
            paciente_id: pacienteId,
            anamnese: "",
            diagnostico: "",
            objetivos: "",
            observacoes: "",
          })
          .select()
          .single();
        if (error) {
          console.error("Error creating prontuario:", error);
          return;
        }
        const newProntuario: ProntuarioData = {
          id: newPront.id,
          clinic_id: newPront.clinic_id,
          paciente_id: pacienteId,
          anamnese: "",
          diagnostico: "",
          objetivos: "",
          observacoes: "",
          primary_specialty_id: null,
          initial_assessment_data: null,
          paciente: { ...(paciente as any), primary_specialty_id: null },
        };
        setProntuariosData((prev) => ({ ...prev, [pacienteId]: newProntuario }));
        setSelectedProntuario(newProntuario);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        console.error("Exception creating prontuario:", err);
      }
    }
  };

  const handleCreateEvolucao = async (data: {
    descricao: string;
    escala_dor: number;
    specialty_id: string | null;
    structured_data: StructuredData | null;
    evolution_date?: string | null;
  }) => {
    if (!selectedProntuario) {
      toast.error("Selecione um utente primeiro");
      return;
    }
    const defaultProfessional = professionals[0];
    if (!defaultProfessional) {
      toast.error("Nenhum profissional disponível");
      return;
    }
    try {
      const createdAt = data.evolution_date
        ? new Date(data.evolution_date + "T12:00:00").toISOString()
        : new Date().toISOString();
      const { data: newEvol, error } = await supabase
        .from("evolucoes_clinicas")
        .insert({
          clinic_id: selectedProntuario.clinic_id,
          prontuario_id: selectedProntuario.id,
          profissional_id: defaultProfessional.id,
          descricao: data.descricao,
          escala_dor: data.escala_dor,
          specialty_id: data.specialty_id,
          structured_data: data.structured_data,
          created_at: createdAt,
        })
        .select("*")
        .single();
      if (error) {
        console.error("Error creating evolution:", error);
        toast.error("Erro ao registar evolução");
        return;
      }
      addEvolution({
        id: newEvol.id,
        clinic_id: newEvol.clinic_id,
        prontuario_id: newEvol.prontuario_id,
        sessao_id: newEvol.sessao_id,
        profissional_id: newEvol.profissional_id,
        descricao: newEvol.descricao,
        escala_dor: newEvol.escala_dor,
        anexos_urls: newEvol.anexos_urls,
        created_at: newEvol.created_at,
        specialty_id: newEvol.specialty_id,
        structured_data: newEvol.structured_data as Record<string, unknown> | null,
        profissional: { id: defaultProfessional.id, full_name: defaultProfessional.full_name },
      });
      toast.success("Evolução registada com sucesso!");
      setIsNewEvolucaoOpen(false);
      setPrefilledDate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registar evolução");
    }
  };

  const handleEditEvolucao = async (
    evolutionId: string,
    data: {
      descricao: string;
      escala_dor: number;
      specialty_id: string | null;
      structured_data: StructuredData | null;
    },
  ) => {
    try {
      const { error } = await supabase
        .from("evolucoes_clinicas")
        .update({
          descricao: data.descricao,
          escala_dor: data.escala_dor,
          specialty_id: data.specialty_id,
          structured_data: data.structured_data,
        })
        .eq("id", evolutionId);
      if (error) {
        toast.error("Erro ao guardar evolução");
        return;
      }
      toast.success("Evolução atualizada com sucesso!");
      setIsEditEvolutionOpen(false);
      setEditingEvolution(null);
      window.location.reload();
    } catch (err) {
      toast.error("Erro ao guardar evolução");
    }
  };

  const getTemplateForEvolution = (specialtyId: string | null | undefined): SpecialtyTemplate | null => {
    if (!specialtyId) return null;
    return templates.find((t) => t.id === specialtyId) || null;
  };

  const handleSaveClinicalData = async (
    _prontuarioId: string,
    data: {
      anamnese: string;
      diagnostico: string;
      objetivos: string;
      observacoes: string;
      primary_specialty_id: string | null;
      initial_assessment_data: StructuredData | null;
    },
  ) => {
    if (!selectedProntuario) return;
    try {
      const { error } = await supabase
        .from("prontuarios")
        .update({
          anamnese: data.anamnese,
          diagnostico: data.diagnostico,
          objetivos: data.objetivos,
          observacoes: data.observacoes,
        })
        .eq("id", selectedProntuario.id);
      if (error) {
        toast.error("Erro ao guardar dados clínicos");
        return;
      }
      const updated: ProntuarioData = {
        ...selectedProntuario,
        ...data,
        paciente: selectedProntuario.paciente
          ? { ...selectedProntuario.paciente, primary_specialty_id: data.primary_specialty_id }
          : undefined,
      };
      setProntuariosData((prev) => ({ ...prev, [selectedProntuario.paciente_id]: updated }));
      setSelectedProntuario(updated);
      toast.success("Dados clínicos guardados!");
    } catch (err) {
      toast.error("Erro ao guardar dados clínicos");
    }
  };

  const prontuarioEvolutions = selectedProntuario
    ? getEvolucoesForProntuario(selectedProntuario.id)
        .slice()
        .sort((a, b) => {
          const tA = new Date(a.created_at).getTime();
          const tB = new Date(b.created_at).getTime();
          return sortOrder === "desc" ? tB - tA : tA - tB;
        })
    : [];

  const handleGenerateAISummary = async () => {
    if (!selectedProntuario || prontuarioEvolutions.length === 0) {
      toast.error("Sem evoluções para analisar");
      return;
    }
    const result = await AIService.generateClinicalSummary({
      prontuarioId: selectedProntuario.id,
      patientName: selectedProntuario.paciente?.full_name || "",
      anamnese: selectedProntuario.anamnese,
      diagnostico: selectedProntuario.diagnostico,
      objetivos: selectedProntuario.objetivos,
      evolutions: prontuarioEvolutions.map((e) => ({
        descricao: e.descricao,
        escala_dor: e.escala_dor,
        created_at: e.created_at,
        structured_data: e.structured_data as Record<string, unknown> | null,
      })),
    });
    setAiSummary(result.data);
    toast.success("Resumo IA gerado!");
  };

  useEffect(() => {
    setAiSummary(null);
  }, [selectedProntuario?.id]);

  const getPainColor = (level: number) => {
    if (level <= 3) return "text-success";
    if (level <= 6) return "text-warning";
    return "text-destructive";
  };

  if (patientsLoading || prontuariosLoading) {
    return (
      <AppLayout title="Prontuários" subtitle="Histórico clínico dos pacientes">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Prontuários" subtitle="Histórico clínico dos pacientes">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Lista de pacientes */}
        <div className={cn("lg:col-span-4 space-y-4", selectedProntuario && "hidden lg:block")}>
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
              {filteredPacientes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum paciente encontrado</p>
                </div>
              ) : (
                <div className="divide-y max-h-[500px] overflow-y-auto scrollbar-thin">
                  {filteredPacientes.map((patient) => {
                    const hasProntuario = !!getProntuarioForPatient(patient.id);
                    const isSelected = selectedProntuario?.paciente_id === patient.id;
                    return (
                      <div
                        key={patient.id}
                        className={cn(
                          "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                          isSelected && "bg-primary/5 border-l-2 border-l-primary",
                        )}
                        onClick={() => handleSelectPatient(patient.id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {(patient.full_name ?? "")
                              .split(" ")
                              .filter(Boolean)
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2) || "?"}
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detalhe */}
        <div className="lg:col-span-8">
          {selectedProntuario ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden gap-2 mb-2"
                onClick={() => setSelectedProntuario(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar à lista
              </Button>

              {/* Header do paciente */}
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {(selectedProntuario.paciente?.full_name ?? "")
                            .split(" ")
                            .filter(Boolean)
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-display text-xl font-semibold">{selectedProntuario.paciente?.full_name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedProntuario.paciente?.phone} • {selectedProntuario.paciente?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditClinicalOpen(true)} className="gap-2">
                        <Pencil className="h-4 w-4" />
                        Editar Dados Clínicos
                      </Button>
                      <Button
                        onClick={() => {
                          setPrefilledDate(null);
                          setIsNewEvolucaoOpen(true);
                        }}
                        className="gap-2"
                      >
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
                  <TabsTrigger value="relatorios" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Relatórios
                  </TabsTrigger>
                  <TabsTrigger value="documentos" className="gap-2">
                    <Paperclip className="h-4 w-4" />
                    Documentos
                  </TabsTrigger>
                  <TabsTrigger value="prontuario" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Anamnese
                  </TabsTrigger>
                  <TabsTrigger value="diario" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    📖 Diário
                  </TabsTrigger>
                </TabsList>

                {/* Evoluções */}
                <TabsContent value="evolucoes">
                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-display text-lg">Histórico de Evoluções</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                          >
                            {sortOrder === "desc" ? (
                              <>
                                <ArrowDown className="h-3 w-3" />
                                Recente
                              </>
                            ) : (
                              <>
                                <ArrowUp className="h-3 w-3" />
                                Antigo
                              </>
                            )}
                          </Button>
                          {prontuarioEvolutions.length > 0 && (
                            <AIAssistButton
                              onClick={handleGenerateAISummary}
                              label="Resumo IA"
                              tooltip="Gerar resumo clínico com IA"
                              variant="outline"
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(prontuarioBriefing || briefingLoading) && upcomingSession && (
                        <div className="mb-6">
                          <PreSessionBriefingCard
                            briefing={prontuarioBriefing!}
                            isLoading={briefingLoading}
                            onRefresh={refreshBriefing}
                          />
                        </div>
                      )}
                      {aiSummary && (
                        <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Sparkles className="h-4 w-4" />
                            Resumo Clínico IA
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiSummary.resumo_progresso}</p>
                          {aiSummary.tendencia_dor && (
                            <div className="text-sm">
                              <span className="font-medium text-muted-foreground">Tendência de dor: </span>
                              {aiSummary.tendencia_dor}
                            </div>
                          )}
                          {aiSummary.alertas_clinicos.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-destructive">Alertas:</span>
                              <ul className="list-disc list-inside text-sm mt-1">
                                {aiSummary.alertas_clinicos.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiSummary.focos_terapeuticos.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-primary">Focos terapêuticos:</span>
                              <ul className="list-disc list-inside text-sm mt-1">
                                {aiSummary.focos_terapeuticos.map((f, i) => (
                                  <li key={i}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground italic">
                            ⚠ Sugestão assistida — não substitui o julgamento clínico profissional.
                          </p>
                        </div>
                      )}
                      {prontuarioEvolutions.length > 0 ? (
                        <div className="space-y-4">
                          {prontuarioEvolutions.map((evolucao) => {
                            const template = getTemplateForEvolution(evolucao.specialty_id);
                            const hasStructuredData =
                              evolucao.structured_data && template && Object.keys(evolucao.structured_data).length > 0;
                            return (
                              <div
                                key={evolucao.id}
                                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors group"
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
                                      <Badge
                                        variant="outline"
                                        className={cn("text-xs", getPainColor(evolucao.escala_dor))}
                                      >
                                        Dor: {evolucao.escala_dor}/10
                                      </Badge>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => {
                                        setEditingEvolution({
                                          id: evolucao.id,
                                          descricao: evolucao.descricao,
                                          escala_dor: evolucao.escala_dor,
                                          specialty_id: evolucao.specialty_id || null,
                                          structured_data: evolucao.structured_data as Record<string, unknown> | null,
                                          created_at: evolucao.created_at,
                                        });
                                        setIsEditEvolutionOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                {hasStructuredData && template && (
                                  <div className="mb-3 p-3 bg-muted/20 rounded-md">
                                    <StructuredDataViewer
                                      schema={template.schema}
                                      data={
                                        evolucao.structured_data as Record<string, string | number | string[] | null>
                                      }
                                      compact
                                    />
                                  </div>
                                )}
                                <p className="text-sm leading-relaxed mb-3">{evolucao.descricao}</p>
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

                {/* Relatórios */}
                <TabsContent value="relatorios">
                  <ClinicalReportsList
                    patientId={selectedProntuario.paciente_id}
                    prontuarioId={selectedProntuario.id}
                    clinicId={selectedProntuario.clinic_id}
                    clinicInfo={
                      clinicInfo
                        ? {
                            name: clinicInfo.name,
                            address: clinicInfo.address || undefined,
                            phone: clinicInfo.phone || undefined,
                            email: clinicInfo.email || undefined,
                          }
                        : undefined
                    }
                  />
                </TabsContent>

                {/* ── DOCUMENTOS (nova tab) ── */}
                <TabsContent value="documentos">
                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-lg">Documentos Clínicos</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Exames, relatórios médicos e documentos de outros profissionais
                      </p>
                    </CardHeader>
                    <CardContent>
                      <PatientDocuments
                        pacienteId={selectedProntuario.paciente_id}
                        prontuarioId={selectedProntuario.id}
                        clinicId={selectedProntuario.clinic_id}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Anamnese (antigo Prontuário) */}
                <TabsContent value="prontuario">
                  <div className="space-y-4">
                    {/* Questionnaire Summary */}
                    <QuestionnaireHealthSummary pacienteId={selectedProntuario.paciente_id} />

                    <Card className="shadow-card">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="font-display text-lg">Dados Clínicos</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditClinicalOpen(true)} className="gap-2">
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {selectedProntuario.primary_specialty_id && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {templates.find((t) => t.id === selectedProntuario.primary_specialty_id)?.name ||
                                "Especialidade"}
                            </Badge>
                          </div>
                        )}
                        {selectedProntuario.initial_assessment_data && selectedProntuario.primary_specialty_id && (
                          <div className="p-4 rounded-lg border bg-muted/20">
                            <h4 className="font-medium text-sm mb-3">Avaliação Inicial</h4>
                            {(() => {
                              const template = templates.find((t) => t.id === selectedProntuario.primary_specialty_id);
                              return template ? (
                                <StructuredDataViewer
                                  schema={template.schema}
                                  data={
                                    selectedProntuario.initial_assessment_data as Record<
                                      string,
                                      string | number | string[] | null
                                    >
                                  }
                                />
                              ) : null;
                            })()}
                          </div>
                        )}
                        {[
                          { label: "Anamnese", key: "anamnese" },
                          { label: "Diagnóstico", key: "diagnostico" },
                          { label: "Objetivos", key: "objetivos" },
                          { label: "Observações", key: "observacoes" },
                        ].map(({ label, key }) => (
                          <div key={key}>
                            <h4 className="font-medium text-sm mb-2 text-muted-foreground">{label}</h4>
                            <p className="text-sm leading-relaxed">
                              {(selectedProntuario as any)[key] || (
                                <span className="text-muted-foreground italic">Não preenchido</span>
                              )}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Diário do Paciente */}
                <TabsContent value="diario">
                  <PatientDiaryTab
                    pacienteId={selectedProntuario.paciente_id}
                    patientName={selectedProntuario.paciente?.full_name || "Paciente"}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <Card className="shadow-card hidden lg:block">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">Selecione um Utente</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Escolha um utente na lista para visualizar ou criar o prontuário clínico
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <NewEvolutionModal
        isOpen={isNewEvolucaoOpen}
        onClose={() => {
          setIsNewEvolucaoOpen(false);
          setPrefilledDate(null);
        }}
        onSubmit={handleCreateEvolucao}
        patientName={selectedProntuario?.paciente?.full_name || ""}
        prontuarioId={selectedProntuario?.id || ""}
        patientSpecialtyId={selectedProntuario?.primary_specialty_id}
        prefilledDate={prefilledDate}
      />

      <EditEvolutionModal
        isOpen={isEditEvolutionOpen}
        onClose={() => {
          setIsEditEvolutionOpen(false);
          setEditingEvolution(null);
        }}
        onSubmit={handleEditEvolucao}
        patientName={selectedProntuario?.paciente?.full_name || ""}
        evolution={editingEvolution}
        patientSpecialtyId={selectedProntuario?.primary_specialty_id}
      />

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
            initial_assessment_data: selectedProntuario.initial_assessment_data,
          }}
          onSave={handleSaveClinicalData}
        />
      )}
    </AppLayout>
  );
}
