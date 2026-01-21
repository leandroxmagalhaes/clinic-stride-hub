import { useState } from "react";
import { Star, Plus, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PatientFeedback, EngagementService } from "@/services/EngagementService";
import { NewFeedbackModal } from "./NewFeedbackModal";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface FeedbackPanelProps {
  feedback: PatientFeedback[];
  npsData: { nps: number; avg: number; promoters: number; passives: number; detractors: number };
  isLoading: boolean;
  onFeedbackAdded: () => void;
}

export function FeedbackPanel({ feedback, npsData, isLoading, onFeedbackAdded }: FeedbackPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getScoreColor = (score: number): string => {
    if (score >= 9) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (score >= 7) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  const getNPSColor = (nps: number): string => {
    if (nps >= 50) return 'text-green-600 dark:text-green-400';
    if (nps >= 0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Star className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              Feedback & NPS
            </CardTitle>
            <Button 
              size="sm" 
              onClick={() => setIsModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Novo Feedback
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* NPS Score Card */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground mb-1">NPS Score</p>
              <p className={`text-3xl font-bold ${getNPSColor(npsData.nps)}`}>
                {npsData.nps}
              </p>
            </div>
            <div className="col-span-2 p-4 rounded-lg bg-muted/50">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <ThumbsUp className="h-3 w-3" />
                    <span className="text-lg font-semibold">{npsData.promoters}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Promotores</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-yellow-600">
                    <Minus className="h-3 w-3" />
                    <span className="text-lg font-semibold">{npsData.passives}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Neutros</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-red-600">
                    <ThumbsDown className="h-3 w-3" />
                    <span className="text-lg font-semibold">{npsData.detractors}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Detratores</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback List */}
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Últimos feedbacks
            </p>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-6">
                A carregar...
              </div>
            ) : feedback.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Star className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum feedback registado</p>
                <p className="text-xs mt-1">Comece a recolher opiniões dos utentes</p>
              </div>
            ) : (
              feedback.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                      {getInitials(item.patient_name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.patient_name}</p>
                      <Badge className={`${getScoreColor(item.score)} text-xs px-1.5`}>
                        {item.score}/10
                      </Badge>
                    </div>
                    {item.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        "{item.comment}"
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(item.created_at), "d 'de' MMM, HH:mm", { locale: pt })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <NewFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={onFeedbackAdded}
      />
    </>
  );
}
