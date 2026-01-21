import { AlertTriangle, MessageCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChurnRiskPatient, EngagementService } from "@/services/EngagementService";

interface ChurnRiskPanelProps {
  patients: ChurnRiskPatient[];
  isLoading: boolean;
}

export function ChurnRiskPanel({ patients, isLoading }: ChurnRiskPanelProps) {
  const handleSendMessage = (patient: ChurnRiskPatient) => {
    const message = EngagementService.getReactivationMessage(patient.full_name);
    const link = EngagementService.generateWhatsAppLink(patient.phone, message);
    
    if (link) {
      window.open(link, '_blank');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRiskLevel = (days: number): { color: string; label: string } => {
    if (days >= 90) {
      return { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Crítico' };
    } else if (days >= 60) {
      return { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Alto' };
    } else {
      return { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Moderado' };
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          Radar de Resgate
          {patients.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {patients.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            A carregar...
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum utente em risco de churn</p>
            <p className="text-xs mt-1">Todos os utentes ativos estão frequentes!</p>
          </div>
        ) : (
          patients.map((patient) => {
            const risk = getRiskLevel(patient.days_since_last_session);
            
            return (
              <div
                key={patient.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-orange-200">
                    <AvatarFallback className="bg-orange-100 text-orange-700 text-sm">
                      {getInitials(patient.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{patient.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {patient.days_since_last_session} dias
                      </div>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${risk.color}`}>
                        {risk.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  onClick={() => handleSendMessage(patient)}
                  disabled={!patient.phone}
                  title={patient.phone ? 'Enviar mensagem de reativação' : 'Sem telefone cadastrado'}
                >
                  <MessageCircle className="h-4 w-4" />
                  Reativar
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
