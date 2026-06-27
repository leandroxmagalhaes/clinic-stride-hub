import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BirthdayPanel } from "@/components/engajamento/BirthdayPanel";
import { ChurnRiskPanel } from "@/components/engajamento/ChurnRiskPanel";
import { FeedbackPanel } from "@/components/engajamento/FeedbackPanel";
import { AutomationDashboard } from "@/components/automacao/AutomationDashboard";
import { AutomationFlowsList } from "@/components/automacao/AutomationFlowsList";
import { 
  EngagementService, 
  BirthdayPatient, 
  ChurnRiskPatient, 
  PatientFeedback 
} from "@/services/EngagementService";
import { AutomationService, AutomationFlow } from "@/services/AutomationService";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, AlertTriangle, Star, Users, Zap, Heart, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Engajamento() {
  const { user } = useAuth();
  const [birthdayPatients, setBirthdayPatients] = useState<BirthdayPatient[]>([]);
  const [churnRiskPatients, setChurnRiskPatients] = useState<ChurnRiskPatient[]>([]);
  const [feedback, setFeedback] = useState<PatientFeedback[]>([]);
  const [automationFlows, setAutomationFlows] = useState<AutomationFlow[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEngagementData = async () => {
    try {
      const [birthdays, churnRisk, feedbackData] = await Promise.all([
        EngagementService.getBirthdayPatients(),
        EngagementService.getChurnRiskPatients(),
        EngagementService.getFeedback()
      ]);
      
      setBirthdayPatients(birthdays);
      setChurnRiskPatients(churnRisk);
      setFeedback(feedbackData);
    } catch (error) {
      console.error('Error fetching engagement data:', error);
    }
  };

  const fetchAutomationData = async () => {
    try {
      const flows = await AutomationService.getFlows();
      setAutomationFlows(flows);
    } catch (error) {
      console.error('Error fetching automation flows:', error);
    }
  };

  const fetchClinicId = async () => {
    if (!user) return null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();
      return data?.clinic_id || null;
    } catch (err) {
      console.error('Error fetching clinic id:', err);
      return null;
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const cId = await fetchClinicId();
      setClinicId(cId);
      await Promise.all([fetchEngagementData(), fetchAutomationData()]);
    } catch (err) {
      console.error('Error fetching engagement data:', err);
      toast.error('Erro ao carregar dados de engajamento');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const handleToggleFlow = async (id: string, isActive: boolean) => {
    const success = await AutomationService.toggleFlowStatus(id, isActive);
    if (success) {
      setAutomationFlows(prev => 
        prev.map(f => f.id === id ? { ...f, is_active: isActive } : f)
      );
      toast.success(isActive ? 'Fluxo ativado' : 'Fluxo desativado');
    } else {
      toast.error('Erro ao alterar status do fluxo');
    }
  };

  const handleSaveFlow = async (
    data: Omit<AutomationFlow, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>,
    existingId?: string
  ) => {
    if (existingId) {
      const success = await AutomationService.updateFlow(existingId, data);
      if (success) {
        await fetchAutomationData();
        toast.success('Fluxo atualizado com sucesso');
      } else {
        toast.error('Erro ao atualizar fluxo');
      }
    } else {
      if (!clinicId) {
        toast.error('Clínica não encontrada');
        return;
      }
      const flow = await AutomationService.createFlow(clinicId, data);
      if (flow) {
        setAutomationFlows(prev => [flow, ...prev]);
        toast.success('Fluxo criado com sucesso');
      } else {
        toast.error('Erro ao criar fluxo');
      }
    }
  };

  const handleDeleteFlow = async (id: string) => {
    const success = await AutomationService.deleteFlow(id);
    if (success) {
      setAutomationFlows(prev => prev.filter(f => f.id !== id));
      toast.success('Fluxo eliminado com sucesso');
    } else {
      toast.error('Erro ao eliminar fluxo');
    }
  };

  const npsData = EngagementService.calculateNPS(feedback);

  // Stats for engagement header
  const engagementStats = [
    {
      label: 'Aniversariantes',
      value: birthdayPatients.length,
      icon: Gift,
      color: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-100 dark:bg-pink-900/30'
    },
    {
      label: 'Em Risco',
      value: churnRiskPatients.length,
      icon: AlertTriangle,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30'
    },
    {
      label: 'NPS Score',
      value: npsData.nps,
      icon: Star,
      color: npsData.nps >= 50 ? 'text-green-600 dark:text-green-400' : npsData.nps >= 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
      bg: npsData.nps >= 50 ? 'bg-green-100 dark:bg-green-900/30' : npsData.nps >= 0 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'
    },
    {
      label: 'Total Feedback',
      value: feedback.length,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30'
    }
  ];

  return (
    <AppLayout 
      title="Engajamento" 
      subtitle="Fidelização, automação e sucesso do cliente"
    >
      <Tabs defaultValue="engagement" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="engagement" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Fidelização
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automação
          </TabsTrigger>
        </TabsList>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          {/* Stats Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {engagementStats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Main Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BirthdayPanel 
              patients={birthdayPatients} 
              isLoading={isLoading} 
            />
            <ChurnRiskPanel 
              patients={churnRiskPatients} 
              isLoading={isLoading} 
            />
            <FeedbackPanel 
              feedback={feedback}
              npsData={npsData}
              isLoading={isLoading}
              onFeedbackAdded={fetchEngagementData}
            />
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Definições do lembrete</p>
                <p className="text-sm text-muted-foreground">
                  Editar saudação, antecedência e dados de pagamento do e-mail automático.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/configuracoes/lembrete">Abrir</Link>
            </Button>
          </Card>
          <AutomationDashboard flows={automationFlows} />
          <AutomationFlowsList
            flows={automationFlows}
            onToggle={handleToggleFlow}
            onSave={handleSaveFlow}
            onDelete={handleDeleteFlow}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
