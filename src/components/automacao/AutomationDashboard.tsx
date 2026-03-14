import { useState, useEffect } from "react";
import { Zap, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AutomationFlow, AutomationService } from "@/services/AutomationService";

interface AutomationDashboardProps {
  flows: AutomationFlow[];
}

export function AutomationDashboard({ flows }: AutomationDashboardProps) {
  const [metrics, setMetrics] = useState({ activeFlows: 0, messagesSent: 0, successRate: 0 });

  useEffect(() => {
    AutomationService.getMetrics().then(setMetrics).catch(() => {});
  }, [flows]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-lg">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Fluxos Ativos</p>
              <p className="text-2xl font-bold text-foreground">{metrics.activeFlows}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-lg">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Mensagens Enviadas</p>
              <p className="text-2xl font-bold text-foreground">{metrics.messagesSent.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-foreground">{metrics.successRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
