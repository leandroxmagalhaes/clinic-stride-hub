import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, X } from "lucide-react";
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

  useEffect(() => {
    if (triggerResult?.shouldTrigger) {
      setIsOpen(true);
    }
  }, [triggerResult]);

  const handleSendWhatsApp = () => {
    if (triggerResult?.whatsappUrl) {
      window.open(triggerResult.whatsappUrl, '_blank');
      toast.success("WhatsApp aberto! Complete o envio no seu navegador.", {
        duration: 4000,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
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
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="gap-2 min-h-[44px]"
          >
            <X className="h-4 w-4" />
            Não enviar
          </Button>
          <Button 
            onClick={handleSendWhatsApp}
            className="gap-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
