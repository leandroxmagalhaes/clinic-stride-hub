import { useState } from "react";
import { Sparkles, Loader2, Calendar, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AIService, AIDailyBriefing } from "@/services/AIService";
import { toast } from "sonner";

interface AIBriefingCardProps {
  todaySessions: number;
  activePatients: number;
  churnRiskCount: number;
  pendingLeads: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  calendar: Calendar,
  alert: AlertTriangle,
  trending: TrendingUp,
  users: Users,
};

export function AIBriefingCard({ todaySessions, activePatients, churnRiskCount, pendingLeads }: AIBriefingCardProps) {
  const [briefing, setBriefing] = useState<AIDailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await AIService.generateDailyBriefing({
        todaySessions,
        activePatients,
        churnRiskCount,
        pendingLeads,
      });
      setBriefing(result.data);
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar briefing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Briefing do Dia
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {briefing ? "Atualizar" : "Gerar"}
        </Button>
      </CardHeader>
      <CardContent>
        {!briefing ? (
          <p className="text-sm text-muted-foreground">
            Gere um resumo inteligente do seu dia com base nos dados atuais da clínica.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">{briefing.greeting}</p>
            <div className="space-y-2">
              {briefing.highlights.map((h, i) => {
                const Icon = ICON_MAP[h.icon] || Sparkles;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{h.text}</p>
                  </div>
                );
              })}
            </div>
            {briefing.priority && (
              <div className="mt-3 p-2 rounded bg-primary/10 border border-primary/20">
                <p className="text-xs font-medium text-primary">🎯 Prioridade: {briefing.priority}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
