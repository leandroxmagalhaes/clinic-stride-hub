import { useState } from "react";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AIService, AIFinancialInsight } from "@/services/AIService";
import { FinancialKPIs } from "@/services/FinancialService";
import { toast } from "sonner";

interface AIFinancialInsightsCardProps {
  kpis: FinancialKPIs | null;
}

const INSIGHT_ICONS = {
  positivo: TrendingUp,
  alerta: AlertTriangle,
  neutro: Minus,
};

const INSIGHT_COLORS = {
  positivo: "text-green-600 dark:text-green-400",
  alerta: "text-orange-600 dark:text-orange-400",
  neutro: "text-muted-foreground",
};

export function AIFinancialInsightsCard({ kpis }: AIFinancialInsightsCardProps) {
  const [insights, setInsights] = useState<AIFinancialInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!kpis) {
      toast.error("Dados financeiros ainda não carregados");
      return;
    }
    setLoading(true);
    try {
      const result = await AIService.generateFinancialInsights({ kpis });
      setInsights(result.data?.insights || []);
      setGenerated(true);
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar insights");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Insights IA
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={loading || !kpis}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generated ? "Atualizar" : "Gerar"}
        </Button>
      </CardHeader>
      <CardContent>
        {!generated ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Gerar" para obter insights inteligentes sobre as finanças do mês.
          </p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem insights disponíveis.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, i) => {
              const Icon = INSIGHT_ICONS[insight.type] || Minus;
              const color = INSIGHT_COLORS[insight.type] || "";
              return (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
