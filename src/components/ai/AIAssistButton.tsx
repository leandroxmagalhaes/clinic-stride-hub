import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AIAssistButtonProps {
  onClick: () => Promise<void>;
  label?: string;
  tooltip?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  disabled?: boolean;
}

export function AIAssistButton({
  onClick,
  label,
  tooltip = 'Assistente IA',
  variant = 'ghost',
  size = 'sm',
  className,
  disabled,
}: AIAssistButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      await onClick();
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const icon = isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : hasError ? (
    <RotateCcw className="h-4 w-4" />
  ) : (
    <Sparkles className="h-4 w-4" />
  );

  const buttonLabel = hasError ? 'Tentar novamente' : label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(
            'gap-1.5 text-primary hover:text-primary/80 hover:bg-primary/10',
            hasError && 'text-destructive hover:text-destructive/80 hover:bg-destructive/10',
            className,
          )}
          onClick={handleClick}
          disabled={disabled || isLoading}
        >
          {icon}
          {buttonLabel && <span className="text-xs font-medium">{buttonLabel}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{hasError ? 'Clique para tentar novamente' : tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
