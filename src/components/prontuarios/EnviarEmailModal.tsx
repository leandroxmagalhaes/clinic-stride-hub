import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Mail, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Modelos de email. Textos facilmente editáveis.
 * {primeiro_nome} é substituído pelo primeiro nome do utente.
 */
export const MODELOS_EMAIL: Record<string, { label: string; assunto: string; corpo: string }> = {
  branco: {
    label: "Mensagem em branco",
    assunto: "",
    corpo: "",
  },
  lapso: {
    label: "Lapso administrativo numa marcação",
    assunto: "Lapso administrativo numa marcação",
    corpo:
      "Olá {primeiro_nome},\n\nDetetámos um lapso administrativo numa marcação em seu nome. A marcação foi anulada e não existe qualquer encargo associado.\n\nFicamos disponíveis para qualquer esclarecimento.",
  },
  horario: {
    label: "Alteração de horário",
    assunto: "Alteração de horário da sua marcação",
    corpo:
      "Olá {primeiro_nome},\n\nPrecisamos de alterar o horário da sua próxima marcação. Indique-nos, por favor, a sua disponibilidade para encontrarmos uma alternativa.\n\nObrigado pela compreensão.",
  },
  documento: {
    label: "Pedido de documento em falta",
    assunto: "Documento em falta",
    corpo:
      "Olá {primeiro_nome},\n\nPara completarmos o seu processo, falta-nos ainda um documento. Agradecemos o envio quando lhe for possível.\n\nQualquer dúvida, estamos disponíveis.",
  },
  seguimento: {
    label: "Seguimento após consulta",
    assunto: "Seguimento após a consulta",
    corpo:
      "Olá {primeiro_nome},\n\nEsperamos que esteja tudo bem após a última consulta. Se surgir alguma dúvida ou queixa, diga-nos algo.\n\nAté breve.",
  },
};

interface EnviarEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: { id: string; nome: string; email?: string | null };
}

export function EnviarEmailModal({ isOpen, onClose, patient }: EnviarEmailModalProps) {
  const [modelo, setModelo] = useState<string>("branco");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const primeiroNome = (patient.nome || "").trim().split(" ").filter(Boolean)[0] || "";

  const aplicarModelo = (key: string) => {
    const m = MODELOS_EMAIL[key];
    if (!m) return;
    if ((assunto.trim() || corpo.trim()) && key !== "branco") {
      const ok = window.confirm("Já existe texto escrito. Substituir pelo modelo selecionado?");
      if (!ok) return;
    }
    setModelo(key);
    setAssunto(m.assunto);
    setCorpo(m.corpo.replace(/\{primeiro_nome\}/g, primeiroNome));
    setPreview(false);
  };

  const handleClose = () => {
    setPreview(false);
    onClose();
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-email-manual", {
        body: { pacienteId: patient.id, assunto: assunto.trim(), corpo: corpo.trim() },
      });
      const err = error
        ? (error as any)?.context
          ? await (error as any).context.text().catch(() => error.message)
          : error.message
        : (data as any)?.error;
      if (err || (data && (data as any).success === false)) {
        let msg = err || "Falha ao enviar o email";
        try {
          const parsed = JSON.parse(msg);
          msg = parsed?.error || msg;
        } catch {
          /* texto simples */
        }
        toast.error(msg);
        return;
      }
      toast.success("Email enviado");
      setAssunto("");
      setCorpo("");
      setModelo("branco");
      handleClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar o email");
    } finally {
      setSending(false);
    }
  };

  if (!patient.email) {
    return (
      <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Não é possível enviar
            </DialogTitle>
            <DialogDescription>
              Este utente não tem email registado. Adicione um email na ficha para poder enviar mensagens.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Enviar email
          </DialogTitle>
          <DialogDescription className="text-xs">
            Para: {patient.nome} &lt;{patient.email}&gt;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select value={modelo} onValueChange={aplicarModelo}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher modelo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODELOS_EMAIL).map(([key, m]) => (
                  <SelectItem key={key} value={key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-assunto">Assunto</Label>
            <Input
              id="email-assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Assunto do email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-corpo">Mensagem</Label>
            <Textarea
              id="email-corpo"
              rows={10}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder="Escreva a mensagem..."
              className="min-h-[200px]"
            />
          </div>

          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setPreview((v) => !v)}>
            <Eye className="h-4 w-4" />
            {preview ? "Ocultar pré-visualização" : "Pré-visualizar"}
          </Button>

          {preview && (
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
              <p className="text-sm font-medium mb-2">{assunto || "(sem assunto)"}</p>
              <p className="text-sm whitespace-pre-line">{corpo || "(sem texto)"}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || !assunto.trim() || !corpo.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "A enviar..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
