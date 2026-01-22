import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiaryEntryForm } from "@/components/patient-portal/DiaryEntryForm";
import { DiaryHistory } from "@/components/patient-portal/DiaryHistory";
import { PatientDiaryService, DiaryEntry } from "@/services/PatientDiaryService";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";

export default function PatientPortal() {
  const { user, loading: authLoading } = useAuth();
  const { isPatient, isLoading: roleLoading } = useUserRole();
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [hasTodayEntry, setHasTodayEntry] = useState(false);

  const loadEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    const [recentEntries, hasToday] = await Promise.all([
      PatientDiaryService.getRecentEntries(7),
      PatientDiaryService.hasTodayEntry(),
    ]);
    setEntries(recentEntries);
    setHasTodayEntry(hasToday);
    setIsLoadingEntries(false);
  }, []);

  useEffect(() => {
    if (user) {
      loadEntries();
    }
  }, [user, loadEntries]);

  const handleSubmit = async (data: { pain_level: number; activity_description: string; notes?: string }) => {
    setIsSubmitting(true);
    try {
      const result = await PatientDiaryService.createEntry(data);
      
      if (result.success) {
        toast.success(hasTodayEntry ? "Registro atualizado!" : "Registro salvo com sucesso!");
        setShowForm(false);
        await loadEntries();
      } else {
        toast.error(result.error || "Erro ao salvar registro");
      }
    } catch (error) {
      toast.error("Erro inesperado ao salvar");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not a patient - redirect to main dashboard
  if (!isPatient) {
    return <Navigate to="/" replace />;
  }

  // Get today's entry for pre-filling form
  const todayEntry = entries.find(e => {
    const today = new Date().toISOString().split('T')[0];
    return e.entry_date === today;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold">Meu Diário</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Show Form or CTA Button */}
        {showForm ? (
          <>
            <DiaryEntryForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              initialData={todayEntry ? {
                pain_level: todayEntry.pain_level,
                activity_description: todayEntry.activity_description,
                notes: todayEntry.notes || undefined,
              } : undefined}
            />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed border-primary/30 hover:border-primary/50"
            onClick={() => setShowForm(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {hasTodayEntry ? "Atualizar Registro de Hoje" : "Registrar Diário de Hoje"}
              </h2>
              <p className="text-muted-foreground">
                {hasTodayEntry 
                  ? "Você já registrou hoje. Clique para atualizar."
                  : "Como você está se sentindo?"
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <DiaryHistory entries={entries} isLoading={isLoadingEntries} />
      </main>
    </div>
  );
}
