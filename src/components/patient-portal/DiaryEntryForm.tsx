import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Frown, Meh, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiaryEntryFormProps {
  onSubmit: (data: { pain_level: number; activity_description: string; notes?: string }) => Promise<void>;
  isSubmitting: boolean;
  initialData?: {
    pain_level: number;
    activity_description: string;
    notes?: string;
  };
}

export function DiaryEntryForm({ onSubmit, isSubmitting, initialData }: DiaryEntryFormProps) {
  const [painLevel, setPainLevel] = useState(initialData?.pain_level ?? 5);
  const [activity, setActivity] = useState(initialData?.activity_description ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity.trim()) return;
    
    await onSubmit({
      pain_level: painLevel,
      activity_description: activity.trim(),
      notes: notes.trim() || undefined,
    });
  };

  // Get pain emoji and color based on level
  const getPainVisuals = (level: number) => {
    if (level <= 3) return { icon: Smile, color: "text-success", bg: "bg-success/10", label: "Leve" };
    if (level <= 6) return { icon: Meh, color: "text-warning", bg: "bg-warning/10", label: "Moderada" };
    return { icon: Frown, color: "text-destructive", bg: "bg-destructive/10", label: "Intensa" };
  };

  const painVisuals = getPainVisuals(painLevel);
  const PainIcon = painVisuals.icon;

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-display">Registrar Diário de Hoje</CardTitle>
        <CardDescription className="text-base">
          Como você está se sentindo?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pain Level Slider */}
          <div className="space-y-4">
            <Label className="text-lg font-medium">Nível de Dor</Label>
            
            {/* Pain Level Display */}
            <div className={cn(
              "flex items-center justify-center gap-4 p-6 rounded-2xl transition-colors",
              painVisuals.bg
            )}>
              <PainIcon className={cn("h-16 w-16", painVisuals.color)} />
              <div className="text-center">
                <span className={cn("text-5xl font-bold", painVisuals.color)}>
                  {painLevel}
                </span>
                <p className={cn("text-lg font-medium", painVisuals.color)}>
                  {painVisuals.label}
                </p>
              </div>
            </div>

            {/* Slider */}
            <div className="px-2">
              <Slider
                value={[painLevel]}
                onValueChange={([value]) => setPainLevel(value)}
                min={0}
                max={10}
                step={1}
                className="py-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>0 - Sem dor</span>
                <span>10 - Pior dor</span>
              </div>
            </div>
          </div>

          {/* Activity Description */}
          <div className="space-y-3">
            <Label htmlFor="activity" className="text-lg font-medium">
              O que estava fazendo? *
            </Label>
            <Textarea
              id="activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Ex: Caminhando, sentado no trabalho, fazendo exercícios..."
              className="min-h-[100px] text-base resize-none"
              maxLength={500}
              required
            />
            <p className="text-xs text-muted-foreground text-right">
              {activity.length}/500 caracteres
            </p>
          </div>

          {/* Optional Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-lg font-medium">
              Observações adicionais (opcional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observação adicional sobre como se sentiu..."
              className="min-h-[80px] text-base resize-none"
              maxLength={1000}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg font-semibold"
            disabled={isSubmitting || !activity.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Salvar Registro
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
