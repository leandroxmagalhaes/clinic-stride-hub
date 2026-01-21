import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BirthdayPanel } from "@/components/engajamento/BirthdayPanel";
import { ChurnRiskPanel } from "@/components/engajamento/ChurnRiskPanel";
import { FeedbackPanel } from "@/components/engajamento/FeedbackPanel";
import { 
  EngagementService, 
  BirthdayPatient, 
  ChurnRiskPatient, 
  PatientFeedback 
} from "@/services/EngagementService";
import { Card } from "@/components/ui/card";
import { Gift, AlertTriangle, Star, Users } from "lucide-react";

export default function Engajamento() {
  const [birthdayPatients, setBirthdayPatients] = useState<BirthdayPatient[]>([]);
  const [churnRiskPatients, setChurnRiskPatients] = useState<ChurnRiskPatient[]>([]);
  const [feedback, setFeedback] = useState<PatientFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const npsData = EngagementService.calculateNPS(feedback);

  // Stats for header
  const stats = [
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
      subtitle="Fidelização e sucesso do cliente"
    >
      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
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
          onFeedbackAdded={fetchData}
        />
      </div>
    </AppLayout>
  );
}
