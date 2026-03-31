import { Badge } from "@/components/ui/badge";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DiaryReplyThread, type DiaryReply } from "./DiaryReplyThread";

export interface DiaryEntry {
  id: string;
  paciente_id: string;
  autor_nome: string;
  humor: string | null;
  categoria: string | null;
  texto: string;
  nivel_dor: number | null;
  tem_foto: boolean;
  foto_url: string | null;
  created_at: string;
  replies?: DiaryReply[];
}

const MOOD_EMOJIS: Record<string, { emoji: string; label: string }> = {
  great: { emoji: "😄", label: "Muito bem" },
  good: { emoji: "🙂", label: "Bem" },
  neutral: { emoji: "😐", label: "Normal" },
  bad: { emoji: "😟", label: "Mal" },
  terrible: { emoji: "😢", label: "Muito mal" },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  improvement: { emoji: "📈", label: "Melhora", color: "bg-green-100 text-green-800" },
  worsening: { emoji: "📉", label: "Piora", color: "bg-red-100 text-red-800" },
  milestone: { emoji: "⭐", label: "Marco", color: "bg-yellow-100 text-yellow-800" },
  observation: { emoji: "👀", label: "Observação", color: "bg-blue-100 text-blue-800" },
  exercise: { emoji: "💪", label: "Exercícios", color: "bg-purple-100 text-purple-800" },
  school: { emoji: "🎒", label: "Escola", color: "bg-orange-100 text-orange-800" },
  pain: { emoji: "🔥", label: "Dor", color: "bg-red-100 text-red-800" },
  fall: { emoji: "⚡", label: "Queda", color: "bg-red-100 text-red-800" },
  gait: { emoji: "🚶", label: "Marcha", color: "bg-teal-100 text-teal-800" },
  running: { emoji: "🏃", label: "Exercícios", color: "bg-purple-100 text-purple-800" },
};

interface DiaryEntryCardProps {
  entry: DiaryEntry;
  onReply: (diarioId: string, texto: string) => Promise<void>;
  autorTipo: "patient" | "professional";
  showAlertStyle?: boolean;
}

export function DiaryEntryCard({ entry, onReply, autorTipo, showAlertStyle }: DiaryEntryCardProps) {
  const mood = entry.humor ? MOOD_EMOJIS[entry.humor] : null;
  const category = entry.categoria ? CATEGORY_CONFIG[entry.categoria] : null;
  const isUrgent = entry.categoria === "worsening" || entry.categoria === "fall" || (entry.nivel_dor != null && entry.nivel_dor >= 6);

  const painColor = entry.nivel_dor != null
    ? entry.nivel_dor <= 3 ? "bg-green-100 text-green-800"
    : entry.nivel_dor <= 6 ? "bg-yellow-100 text-yellow-800"
    : "bg-red-100 text-red-800"
    : "";

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      showAlertStyle && isUrgent ? "bg-destructive/5 border-l-4 border-l-destructive" : "bg-card"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {mood && <span className="text-xl" title={mood.label}>{mood.emoji}</span>}
          <span className="text-sm font-medium">{entry.autor_nome}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {category && (
          <Badge variant="outline" className={cn("text-xs gap-1", category.color)}>
            {category.emoji} {category.label}
          </Badge>
        )}
        {entry.nivel_dor != null && (
          <Badge variant="outline" className={cn("text-xs", painColor)}>
            🔥 Dor {entry.nivel_dor}/10
          </Badge>
        )}
        {entry.tem_foto && (
          <Badge variant="outline" className="text-xs gap-1">
            <Camera className="h-3 w-3" /> Foto
          </Badge>
        )}
      </div>

      {/* Text */}
      <p className="text-sm whitespace-pre-wrap">{entry.texto}</p>

      {/* Photo */}
      {entry.tem_foto && entry.foto_url && (
        <a
          href={entry.foto_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <Camera className="h-3 w-3" /> Ver foto/vídeo
        </a>
      )}

      {/* Replies */}
      <DiaryReplyThread
        replies={entry.replies || []}
        onReply={(texto) => onReply(entry.id, texto)}
        autorTipo={autorTipo}
      />
    </div>
  );
}

export { MOOD_EMOJIS, CATEGORY_CONFIG };
