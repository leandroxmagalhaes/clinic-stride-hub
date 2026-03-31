import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DiaryReply {
  id: string;
  diario_id: string;
  autor_nome: string;
  autor_tipo: string;
  texto: string;
  created_at: string;
}

interface DiaryReplyThreadProps {
  replies: DiaryReply[];
  onReply: (texto: string) => Promise<void>;
  autorTipo: "patient" | "professional";
}

export function DiaryReplyThread({ replies, onReply, autorTipo }: DiaryReplyThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(replyText.trim());
      setReplyText("");
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {replies.map((reply) => (
        <div
          key={reply.id}
          className={cn(
            "flex gap-2 p-2.5 rounded-lg text-sm",
            reply.autor_tipo === "professional"
              ? "bg-primary/10 ml-2"
              : "bg-muted ml-2"
          )}
        >
          <div
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              reply.autor_tipo === "professional"
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/30 text-foreground"
            )}
          >
            {reply.autor_tipo === "professional" ? "C" : reply.autor_nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-xs">{reply.autor_nome}</span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(reply.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>
            <p className="text-xs mt-0.5 whitespace-pre-wrap">{reply.texto}</p>
          </div>
        </div>
      ))}

      {showReplyForm ? (
        <div className="ml-2 space-y-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escreva a sua resposta..."
            className="min-h-[60px] text-sm resize-none"
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !replyText.trim()}>
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Enviar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowReplyForm(false); setReplyText(""); }}>
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 text-xs gap-1 text-muted-foreground"
          onClick={() => setShowReplyForm(true)}
        >
          <MessageCircle className="h-3 w-3" /> Responder
        </Button>
      )}
    </div>
  );
}
