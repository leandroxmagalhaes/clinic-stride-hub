import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, Send, Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinicInfo } from "@/hooks/useClinicInfo";
import { toast } from "sonner";
import { UnifiedThread, useUnifiedThread, enviarMensagemUnificada } from "@/components/messages/UnifiedThread";

interface Props {
  pacienteId: string;
  patientName: string;
  patientEmail?: string | null;
}

export function PatientMessagesTab({ pacienteId, patientName, patientEmail }: Props) {
  const { user } = useAuth();
  const { data: clinic } = useClinicInfo();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [authorName, setAuthorName] = useState("Profissional");
  const [portalAtivo, setPortalAtivo] = useState<boolean | null>(null);
  const [showActivate, setShowActivate] = useState(false);
  const [welcomeText, setWelcomeText] = useState("");
  const [activating, setActivating] = useState(false);
  const { refresh } = useUnifiedThread(pacienteId);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setAuthorName(data.full_name); });
  }, [user]);

  const checkPortal = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("portal_contas")
      .select("auth_user_id")
      .eq("paciente_id", pacienteId)
      .maybeSingle();
    setPortalAtivo(!!data?.auth_user_id);
  }, [pacienteId]);

  useEffect(() => { checkPortal(); }, [checkPortal]);

  const firstName = patientName.split(" ")[0] || patientName;
  const clinicName = clinic?.name || "a sua clínica";

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await enviarMensagemUnificada({
        paciente_id: pacienteId,
        texto: draft.trim(),
        autor_tipo: "professional",
        autor_nome: authorName,
        tipo: "mensagem",
      });
      setDraft("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const openActivate = () => {
    setWelcomeText(
      `Olá ${firstName}!\n\nBem-vindo ao seu Diário de Acompanhamento na Physione. Aqui pode comunicar connosco entre sessões, registar como se sente e partilhar o seu progresso.\n\nEstamos consigo a cada passo. Qualquer dúvida, é só responder a esta mensagem.\n\n${clinicName}`
    );
    setShowActivate(true);
  };

  const handleActivate = async () => {
    if (!welcomeText.trim()) return;
    setActivating(true);
    try {
      // 1. Generate magic link / invite
      if (patientEmail) {
        const { error } = await supabase.functions.invoke("generate-portal-magic-link", {
          body: { paciente_id: pacienteId, email: patientEmail },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("generate-portal-invite", {
          body: { paciente_id: pacienteId },
        });
        if (error) throw error;
      }

      // 2. Send welcome message
      await enviarMensagemUnificada({
        paciente_id: pacienteId,
        texto: welcomeText.trim(),
        autor_tipo: "professional",
        autor_nome: authorName,
        tipo: "mensagem",
      });

      toast.success("Diário de Acompanhamento activado e mensagem de boas-vindas enviada");
      setShowActivate(false);
      await refresh();
      await checkPortal();
    } catch (e: any) {
      toast.error(e.message || "Erro ao ativar portal");
    } finally {
      setActivating(false);
    }
  };

  return (
    <Card className="shadow-card flex flex-col h-[calc(100vh-260px)] min-h-[500px]">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="font-display text-lg">Diário de Acompanhamento de {patientName}</CardTitle>
          </div>
          {portalAtivo === true ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Portal activo
            </Badge>
          ) : portalAtivo === false ? (
            <Button size="sm" variant="outline" onClick={openActivate}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Activar Portal de Acompanhamento
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <UnifiedThread pacienteId={pacienteId} viewerTipo="professional" />
        <div className="p-3 border-t flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva uma mensagem..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>

      <Dialog open={showActivate} onOpenChange={setShowActivate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Activar Portal de Acompanhamento de {firstName}</DialogTitle>
            <DialogDescription>
              {patientEmail
                ? `Vamos enviar um link de acesso para ${patientEmail} e registar a mensagem de boas-vindas.`
                : "Sem email — será gerado um convite por código. A mensagem de boas-vindas fica registada na conversa."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={welcomeText}
            onChange={(e) => setWelcomeText(e.target.value)}
            rows={10}
            className="font-sans"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowActivate(false)} disabled={activating}>
              Cancelar
            </Button>
            <Button onClick={handleActivate} disabled={activating || !welcomeText.trim()}>
              {activating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Activar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
