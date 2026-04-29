import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  recipientFirstName?: string;
  link: string;
  codigo: string;
  phone?: string | null;
}

function buildDefaultMessage(opts: { firstName: string; patientName: string; link: string; codigo: string }) {
  return `Olá ${opts.firstName},

Aqui está o seu acesso ao Portal Physione para preencher o questionário do/a ${opts.patientName}:

🔗 ${opts.link}
🔢 Código: ${opts.codigo}

⚠️ Importante: o link expira em 48h e tem 3 tentativas.
Se já tinha começado a preencher noutro dispositivo, o sistema vai detetar e oferecer continuar.

Qualquer dúvida, responda a esta mensagem.`;
}

function normalizeWaPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // pt-PT default: 9 digits → prefix 351
  if (digits.length === 9) return `351${digits}`;
  return digits;
}

export function WhatsAppMessageDialog({ open, onOpenChange, patientName, recipientFirstName, link, codigo, phone }: Props) {
  const defaultFirstName = useMemo(() => {
    if (recipientFirstName && recipientFirstName.trim()) return recipientFirstName.split(" ")[0];
    return patientName?.split(" ")[0] || "";
  }, [recipientFirstName, patientName]);

  const [message, setMessage] = useState(() =>
    buildDefaultMessage({ firstName: defaultFirstName, patientName, link, codigo })
  );
  const [copied, setCopied] = useState(false);

  // Reset message when dialog reopens
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setMessage(buildDefaultMessage({ firstName: defaultFirstName, patientName, link, codigo }));
      setCopied(false);
    }
    onOpenChange(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar.");
    }
  };

  const waPhone = normalizeWaPhone(phone);
  const waUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Mensagem para WhatsApp</DialogTitle>
          <DialogDescription className="text-xs">
            Edite se quiser, depois copie ou abra diretamente no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={12}
            className="font-mono text-xs leading-relaxed"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopy} className="gap-2 flex-1 min-w-[160px]">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar mensagem"}
            </Button>
            <Button variant="outline" asChild className="gap-2 flex-1 min-w-[160px]">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                {waPhone ? "Abrir WhatsApp" : "Abrir WhatsApp (sem nº)"}
              </a>
            </Button>
          </div>

          {!waPhone && (
            <p className="text-[11px] text-muted-foreground">
              Sem telemóvel registado para este utente — o WhatsApp vai abrir sem destinatário pré-preenchido.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
