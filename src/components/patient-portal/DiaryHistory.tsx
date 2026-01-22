import { format, parseISO, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Frown, Meh, Smile } from "lucide-react";
import { DiaryEntry } from "@/services/PatientDiaryService";
import { cn } from "@/lib/utils";

interface DiaryHistoryProps {
  entries: DiaryEntry[];
  isLoading: boolean;
}

export function DiaryHistory({ entries, isLoading }: DiaryHistoryProps) {
  const getPainVisuals = (level: number) => {
    if (level <= 3) return { icon: Smile, color: "text-success", variant: "default" as const };
    if (level <= 6) return { icon: Meh, color: "text-warning", variant: "secondary" as const };
    return { icon: Frown, color: "text-destructive", variant: "destructive" as const };
  };

  const formatEntryDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "EEEE, d 'de' MMM", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Últimos 7 Dias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-display flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Últimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum registro encontrado</p>
            <p className="text-sm">Comece registrando seu diário de hoje!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const painVisuals = getPainVisuals(entry.pain_level);
              const PainIcon = painVisuals.icon;

              return (
                <Card key={entry.id} className="overflow-hidden border-l-4" style={{
                  borderLeftColor: entry.pain_level <= 3 
                    ? 'hsl(var(--success))' 
                    : entry.pain_level <= 6 
                      ? 'hsl(var(--warning))' 
                      : 'hsl(var(--destructive))'
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Date and Activity */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-muted-foreground capitalize">
                          {formatEntryDate(entry.entry_date)}
                        </p>
                        <p className="mt-1 text-base">
                          {entry.activity_description}
                        </p>
                        {entry.notes && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            "{entry.notes}"
                          </p>
                        )}
                      </div>

                      {/* Right: Pain Level */}
                      <div className="flex flex-col items-center shrink-0">
                        <PainIcon className={cn("h-8 w-8", painVisuals.color)} />
                        <Badge variant={painVisuals.variant} className="mt-1 text-lg px-3">
                          {entry.pain_level}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
