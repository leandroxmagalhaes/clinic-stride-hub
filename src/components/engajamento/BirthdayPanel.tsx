import { Gift, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BirthdayPatient, EngagementService } from "@/services/EngagementService";

interface BirthdayPanelProps {
  patients: BirthdayPatient[];
  isLoading: boolean;
}

export function BirthdayPanel({ patients, isLoading }: BirthdayPanelProps) {
  const handleSendMessage = (patient: BirthdayPatient) => {
    const message = EngagementService.getBirthdayMessage(patient.full_name);
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

  const currentMonth = new Date().toLocaleDateString('pt-PT', { month: 'long' });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
            <Gift className="h-5 w-5 text-pink-600 dark:text-pink-400" />
          </div>
          Aniversariantes de {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}
          {patients.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
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
            <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum aniversariante este mês</p>
          </div>
        ) : (
          patients.map((patient) => (
            <div
              key={patient.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-pink-200">
                  <AvatarFallback className="bg-pink-100 text-pink-700 text-sm">
                    {getInitials(patient.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{patient.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Dia {patient.day}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                onClick={() => handleSendMessage(patient)}
                disabled={!patient.phone}
                title={patient.phone ? 'Enviar parabéns via WhatsApp' : 'Sem telefone cadastrado'}
              >
                <MessageCircle className="h-4 w-4" />
                Parabéns
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
