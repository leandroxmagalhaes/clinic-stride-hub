import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface DiaryBriefingSectionProps {
  pacienteId: string;
  lastSessionDate?: string | null;
}

const MOOD_EMOJIS: Record<string, string> = {
  great: "😄", good: "🙂", neutral: "😐", bad: "😟", terrible: "😢",
};

const CATEGORY_LABELS: Record<string, string> = {
  improvement: "📈 Melhora",
  worsening: "📉 Piora",
  pain: "🔥 Dor",
  fall: "⚡ Queda",
  exercise: "💪 Exercício",
  observation: "👀 Observação",
  milestone: "⭐ Marco",
  school: "🎒 Escola",
  gait: "🚶 Marcha",
  running: "🏃 Exercícios",
};

export function DiaryBriefingSection({ pacienteId, lastSessionDate }: DiaryBriefingSectionProps) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      let query = (supabase as any)
        .from("portal_diario")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (lastSessionDate) {
        query = query.gt("created_at", lastSessionDate);
      }

      const { data } = await query;
      setEntries(data || []);
      setIsLoading(false);
    })();
  }, [pacienteId, lastSessionDate]);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (entries.length === 0) return null;

  const moodCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  let hasUrgent = false;

  entries.forEach((e: any) => {
    if (e.humor) moodCounts[e.humor] = (moodCounts[e.humor] || 0) + 1;
    if (e.categoria) categoryCounts[e.categoria] = (categoryCounts[e.categoria] || 0) + 1;
    if (e.categoria === "worsening" || e.categoria === "fall" || (e.nivel_dor != null && e.nivel_dor >= 6)) {
      hasUrgent = true;
    }
  });

  const recentEntries = entries.slice(0, 3);

  return (
    <Card className={cn("border", hasUrgent ? "border-destructive/50 bg-destructive/5" : "border-primary/20 bg-primary/5")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Briefing Pré-Sessão</span>
          <Badge variant="secondary" className="text-[10px]">{entries.length} registos</Badge>
        </div>

        {/* Mini-cards */}
        <div className="grid grid-cols-3 gap-2">
          {/* Moods */}
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="flex justify-center gap-0.5 mb-1">
              {Object.entries(moodCounts).slice(0, 3).map(([mood, count]) => (
                <span key={mood} className="text-lg" title={`${MOOD_EMOJIS[mood]} x${count}`}>
                  {MOOD_EMOJIS[mood]}
                </span>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">Humor</span>
          </div>
          {/* Categories */}
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="flex justify-center gap-0.5 mb-1 flex-wrap">
              {Object.entries(categoryCounts).slice(0, 3).map(([cat]) => (
                <span key={cat} className="text-xs">{CATEGORY_LABELS[cat]?.split(" ")[0]}</span>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">Categorias</span>
          </div>
          {/* Count */}
          <div className="bg-background rounded-lg p-2 text-center">
            <span className="text-lg font-bold text-primary">{entries.length}</span>
            <span className="text-[10px] text-muted-foreground block">Registos</span>
          </div>
        </div>

        {/* Alert */}
        {hasUrgent && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            <span>Existem registos de piora, queda ou dor elevada</span>
          </div>
        )}

        {/* Recent entries (compact) */}
        <div className="space-y-1.5">
          {recentEntries.map((e: any) => (
            <div key={e.id} className="flex items-center gap-2 text-xs bg-background rounded p-1.5">
              <span>{e.humor ? MOOD_EMOJIS[e.humor] : "📝"}</span>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
              <span className="truncate flex-1">{e.texto?.slice(0, 60)}</span>
              {e.categoria && (
                <span className="text-[10px]">{CATEGORY_LABELS[e.categoria]?.split(" ")[0]}</span>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-primary"
          onClick={() => navigate(`/prontuarios?paciente=${pacienteId}&tab=diario`)}
        >
          <BookOpen className="h-3 w-3 mr-1" /> Ver diário completo →
        </Button>
      </CardContent>
    </Card>
  );
}
