import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Sparkles, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface AISuggestionPanelProps {
  suggestion: string;
  onAccept: (text: string) => void;
  onReject: () => void;
  title?: string;
}

export function AISuggestionPanel({
  suggestion,
  onAccept,
  onReject,
  title = 'Sugestão IA',
}: AISuggestionPanelProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(suggestion);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <Card className="border-primary/30 bg-primary/5 animate-fade-in">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          {title}
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{suggestion}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => onAccept(suggestion)}>
            <Check className="h-3.5 w-3.5" />
            Aceitar
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onReject}>
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
