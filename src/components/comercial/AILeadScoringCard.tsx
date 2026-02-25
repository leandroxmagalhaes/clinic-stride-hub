import { useState } from "react";
import { Sparkles, Loader2, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIService, AILeadScore } from "@/services/AIService";
import { SalesLead } from "@/services/LeadService";
import { toast } from "sonner";

interface AILeadScoringCardProps {
  leads: SalesLead[];
}

const SCORE_CONFIG = {
  alto: { label: "Alto", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  medio: { label: "Médio", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  baixo: { label: "Baixo", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export function AILeadScoringCard({ leads }: AILeadScoringCardProps) {
  const [scores, setScores] = useState<AILeadScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const activeLeads = leads.filter(l => !['ganho', 'perdido'].includes(l.status));

  const handleGenerate = async () => {
    if (activeLeads.length === 0) {
      toast.info("Nenhum lead ativo para classificar");
      return;
    }
    setLoading(true);
    try {
      const result = await AIService.scoreLeads({
        leads: activeLeads.map(l => ({
          name: l.name,
          status: l.status,
          estimated_value: l.estimated_value,
          source: l.source,
          created_at: l.created_at,
          notes: l.notes,
        })),
      });
      setScores(result.data?.scores || []);
      setGenerated(true);
    } catch (error: any) {
      toast.error(error.message || "Erro ao classificar leads");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Lead Scoring IA
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={loading || activeLeads.length === 0}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generated ? "Atualizar" : "Classificar"}
        </Button>
      </CardHeader>
      <CardContent>
        {!generated ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Classificar" para que a IA analise e priorize seus leads ativos ({activeLeads.length}).
          </p>
        ) : scores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sem resultados.</p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {scores.map((s, i) => {
              const config = SCORE_CONFIG[s.score] || SCORE_CONFIG.medio;
              return (
                <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{s.lead_name}</p>
                    <Badge variant="secondary" className={`text-[10px] ${config.className}`}>
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.justification}</p>
                  <p className="text-xs text-primary font-medium">→ {s.next_step}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
