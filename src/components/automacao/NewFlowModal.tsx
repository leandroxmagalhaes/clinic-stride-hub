import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Paperclip } from "lucide-react";
import {
  AutomationFlow,
  TRIGGER_OPTIONS,
  CHANNEL_OPTIONS,
  MESSAGE_VARIABLES,
  TriggerType,
} from "@/services/AutomationService";

interface NewFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<AutomationFlow, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editingFlow?: AutomationFlow | null;
}

export function NewFlowModal({ open, onOpenChange, onSave, editingFlow }: NewFlowModalProps) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("appointment_created");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingFlow) {
      setName(editingFlow.name);
      setTriggerType(editingFlow.trigger_type);
      setChannel(editingFlow.channel);
      setMessageTemplate(editingFlow.message_template);
      setAttachmentUrl(editingFlow.attachment_url || "");
      setIsActive(editingFlow.is_active);
    } else {
      resetForm();
    }
  }, [editingFlow, open]);

  const resetForm = () => {
    setName("");
    setTriggerType("appointment_created");
    setChannel("whatsapp");
    setMessageTemplate("");
    setAttachmentUrl("");
    setIsActive(true);
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newText = before + variable + after;
    setMessageTemplate(newText);

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !messageTemplate.trim()) return;

    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        trigger_type: triggerType,
        channel,
        message_template: messageTemplate.trim(),
        attachment_url: attachmentUrl.trim() || null,
        is_active: isActive,
        priority: 0,
      });
      onOpenChange(false);
      resetForm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingFlow ? "Editar Fluxo" : "Novo Fluxo de Automação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Fluxo</Label>
            <Input
              id="name"
              placeholder="Ex: Lembrete 24h antes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Trigger */}
          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>Canal de Envio</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Template */}
          <div className="space-y-2">
            <Label htmlFor="message">Modelo de Mensagem</Label>
            <Textarea
              ref={textareaRef}
              id="message"
              placeholder="Olá {{patient_name}}, lembramos que tem uma consulta amanhã às {{time}}..."
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="min-h-[120px] resize-none"
            />

            {/* Variable Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              {MESSAGE_VARIABLES.map((variable) => (
                <Badge
                  key={variable.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => insertVariable(variable.key)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {variable.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label htmlFor="attachment">Anexo (URL)</Label>
            <div className="relative">
              <Paperclip className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="attachment"
                placeholder="https://exemplo.com/documento.pdf"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="active">Status do Fluxo</Label>
              <p className="text-xs text-muted-foreground">
                {isActive ? "O fluxo está ativo e enviará mensagens" : "O fluxo está desativado"}
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !messageTemplate.trim() || isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingFlow ? "Guardar Alterações" : "Criar Fluxo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
