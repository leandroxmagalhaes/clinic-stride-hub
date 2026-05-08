import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopilotFABProps {
  onClick: () => void;
  isOpen: boolean;
  hidden?: boolean;
}

export function CopilotFAB({ onClick, isOpen, hidden }: CopilotFABProps) {
  if (isOpen || hidden) return null;

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        'fixed bottom-[88px] right-6 z-[90] h-[52px] w-[52px] rounded-full shadow-lg',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'transition-transform hover:scale-105 active:scale-95'
      )}
      aria-label="Abrir Copiloto (Ctrl+K)"
      title="Copiloto (Ctrl+K)"
    >
      <Bot className="h-6 w-6" />
    </Button>
  );
}
