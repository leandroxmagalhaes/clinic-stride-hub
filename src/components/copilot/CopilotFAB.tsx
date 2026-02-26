import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopilotFABProps {
  onClick: () => void;
  isOpen: boolean;
}

export function CopilotFAB({ onClick, isOpen }: CopilotFABProps) {
  if (isOpen) return null;

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'transition-transform hover:scale-105 active:scale-95'
      )}
      aria-label="Abrir Copiloto (Ctrl+K)"
    >
      <Bot className="h-6 w-6" />
    </Button>
  );
}
