import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, X, Copy, ExternalLink } from "lucide-react";
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
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (triggerResult?.shouldTrigger) {
      setIsOpen(true);
      setShowFallback(false);
    }
  }, [triggerResult]);

  const handleSendWhatsApp = () => {
    if (triggerResult?.whatsappUrl) {
      const newWindow = window.open(triggerResult.whatsappUrl, '_blank');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Popup blocked - show fallback
        setShowFallback(true);
        toast.info("Popup bloqueado. Use o link abaixo ou copie a mensagem.", {
          duration: 5000,
        });
      } else {
        toast.success("WhatsApp aberto!", { duration: 3000 });
        handleClose();
      }
    }
  };

  const handleCopyMessage = async () => {
    if (triggerResult?.processedMessage) {
      try {
        await navigator.clipboard.writeText(triggerResult.processedMessage);
        toast.success("Mensagem copiada para a área de transferência!");
      } catch {
        toast.error("Não foi possível copiar a mensagem.");
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowFallback(false);
    onDismiss();
  };

  if (!triggerResult?.shouldTrigger) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5" />
            Enviar Mensagem Automática?
          </DialogTitle>
          <DialogDescription>
            Agendamento criado com sucesso! Deseja enviar uma mensagem via WhatsApp para o paciente?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Flow info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fluxo: {triggerResult.flow?.name}
            </p>
          </div>

          {/* Message preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mensagem a enviar:
            </p>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm whitespace-pre-wrap">
              {triggerResult.processedMessage}
            </div>
          </div>

          {/* Phone info */}
          <p className="text-xs text-muted-foreground">
            📱 Será aberto no WhatsApp Web para: {triggerResult.patientPhone}
          </p>

          {/* Fallback UI when popup is blocked */}
          {showFallback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                ⚠️ O popup foi bloqueado. Use uma das opções abaixo:
              </p>
              
              <div className="space-y-2">
                <a
                  href={triggerResult.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Clique aqui para abrir o WhatsApp
                </a>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="gap-2 w-full"
                >
                  <Copy className="h-4 w-4" />
                  Copiar mensagem
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Se o link não abrir, copie a mensagem e cole manualmente no WhatsApp.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="gap-2 min-h-[44px]"
          >
            <X className="h-4 w-4" />
            {showFallback ? "Fechar" : "Não enviar"}
          </Button>
          {!showFallback && (
            <Button 
              onClick={handleSendWhatsApp}
              className="gap-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
