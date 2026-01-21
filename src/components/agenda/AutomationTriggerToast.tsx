import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, X, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AutomationTriggerResult } from "@/services/AutomationEngine";

interface AutomationTriggerToastProps {
  triggerResult: AutomationTriggerResult | null;
  onDismiss: () => void;
}

export function AutomationTriggerToast({ 
  triggerResult, 
  onDismiss 
}: AutomationTriggerToastProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openAttempted, setOpenAttempted] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (triggerResult?.shouldTrigger) {
      setIsOpen(true);
      setOpenAttempted(false);
    }
  }, [triggerResult]);

  const handleSendWhatsApp = () => {
    if (!triggerResult?.whatsappUrl) return;
    
    console.debug('[WhatsApp] Attempting to open:', triggerResult.whatsappUrl);
    setOpenAttempted(true);
    
    // Method 1: Anchor click (more compatible with browser security)
    if (anchorRef.current) {
      anchorRef.current.href = triggerResult.whatsappUrl;
      anchorRef.current.click();
      console.debug('[WhatsApp] Used anchor click method');
      toast.success("Abrindo WhatsApp...", { duration: 3000 });
      return;
    }
    
    // Method 2: Fallback to window.open
    console.debug('[WhatsApp] Anchor not available, trying window.open');
    const newWindow = window.open(triggerResult.whatsappUrl, '_blank', 'noopener,noreferrer');
    
    if (newWindow) {
      toast.success("WhatsApp aberto!", { duration: 3000 });
    } else {
      toast.info("Se não abriu, use 'Copiar link' abaixo.", { duration: 5000 });
    }
  };

  const handleCopyMessage = async () => {
    if (triggerResult?.processedMessage) {
      try {
        await navigator.clipboard.writeText(triggerResult.processedMessage);
        toast.success("Mensagem copiada!");
      } catch {
        toast.error("Não foi possível copiar.");
      }
    }
  };

  const handleCopyLink = async () => {
    if (triggerResult?.whatsappUrl) {
      try {
        await navigator.clipboard.writeText(triggerResult.whatsappUrl);
        toast.success("Link copiado! Cole no navegador.");
      } catch {
        toast.error("Não foi possível copiar o link.");
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setOpenAttempted(false);
    onDismiss();
  };

  if (!triggerResult?.shouldTrigger) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Hidden anchor for reliable opening */}
        <a
          ref={anchorRef}
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="sr-only"
          aria-hidden="true"
        >
          WhatsApp
        </a>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5" />
            Enviar Mensagem Automática?
          </DialogTitle>
          <DialogDescription>
            Agendamento criado! Escolha como enviar a mensagem:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Flow info */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fluxo: {triggerResult.flow?.name}
            </p>
          </div>

          {/* Message preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mensagem:
            </p>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
              {triggerResult.processedMessage}
            </div>
          </div>

          {/* Phone info */}
          <p className="text-xs text-muted-foreground">
            📱 Para: {triggerResult.patientPhone}
          </p>

          {/* Always show all action options */}
          <div className="grid grid-cols-1 gap-2">
            <Button 
              onClick={handleSendWhatsApp}
              className="gap-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white w-full"
            >
              <Send className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMessage}
                className="gap-2 min-h-[40px]"
              >
                <Copy className="h-4 w-4" />
                Copiar msg
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 min-h-[40px]"
              >
                <Link2 className="h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </div>

          {/* Help text after first attempt */}
          {openAttempted && (
            <p className="text-xs text-muted-foreground text-center">
              Se não abriu, use "Copiar link" e cole no navegador.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={handleClose}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
