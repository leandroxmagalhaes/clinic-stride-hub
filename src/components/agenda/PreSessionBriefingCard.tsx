import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface BriefingData {
  last_evolution_summary: string;
  today_plan: string;
  absence_alert: boolean;
  absence_count: number;
  last_pain_level: number | null;
  session_number: string;
  patient_name: string;
  last_evolution_date: string | null;
}

interface PreSessionBriefingCardProps {
  briefing: BriefingData;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const getPainColor = (level: number) => {
  if (level <= 3) return "text-success bg-success/10";
  if (level <= 6) return "text-warning bg-warning/10";
  return "text-destructive bg-destructive/10";
};

export function PreSessionBriefingCard({
  briefing,
  isLoading = false,
  onRefresh,
}: PreSessionBriefingCardProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5 animate-fade-in">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">A gerar briefing pré-sessão...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5 animate-fade-in">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Briefing Pré-Sessão
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {briefing.session_number}
            </Badge>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Absence Alert */}
        {briefing.absence_alert && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              ⚠ Paciente faltou {briefing.absence_count} vez(es) nas últimas sessões
            </span>
          </div>
        )}

        {/* Last Evolution Summary */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Última evolução
            {briefing.last_evolution_date && (
              <span className="font-normal">
                ({format(new Date(briefing.last_evolution_date), "dd/MM", { locale: ptBR })})
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{briefing.last_evolution_summary}</p>
        </div>

        {/* Today's Plan */}
        {briefing.today_plan && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
              Plano para hoje
            </div>
            <p className="text-sm leading-relaxed">{briefing.today_plan}</p>
          </div>
        )}

        {/* Pain Level */}
        {briefing.last_pain_level !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Dor última sessão:</span>
            <Badge
              variant="outline"
              className={cn("text-xs", getPainColor(briefing.last_pain_level))}
            >
              {briefing.last_pain_level}/10
            </Badge>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic">
          ⚠ Briefing gerado por IA — confirme com o prontuário.
        </p>
      </CardContent>
    </Card>
  );
}
