import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Copy, Lock, Unlock, ChevronDown, ChevronUp, Eye, Mail, MessageCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionnaireTemplateService, type QuestionnaireTemplate } from "@/services/QuestionnaireTemplateService";
import { useUserRole } from "@/hooks/useUserRole";
import { PortalDiagnosticsPanel } from "./PortalDiagnosticsPanel";
import { WhatsAppMessageDialog } from "./WhatsAppMessageDialog";

interface PortalTabProps {
  patientId: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
  patientName: string;
  patientBirthDate?: string | null;
}

interface PortalAccount {
  id: string;
  email: string | null;
  provider: string;
  status: string;
  onboarding_completo: boolean;
  ultimo_acesso: string | null;
}

interface PortalInvite {
  id: string;
  link_token: string;
  codigo: string;
  created_at: string;
  enviado_para_email: string | null;
  enviado_para_telefone: string | null;
  utilizado: boolean;
  expira_em: string;
  tentativas: number;
}

interface Questionnaire {
  perfil_tipo: string;
  dados_pessoais: Record<string, any>;
  perfil_saude: Record<string, any>;
  expectativas: Record<string, any>;
  completo: boolean;
}

export function PatientPortalTab({ patientId, patientEmail, patientPhone, patientName, patientBirthDate }: PortalTabProps) {
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [lastInvite, setLastInvite] = useState<PortalInvite | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [waOpen, setWaOpen] = useState(false);
  const { isAdmin, isProfessional } = useUserRole();
  const showDiagnostics = isAdmin || isProfessional;
  const isAdminMaster = isAdmin;
  const [resettingPwd, setResettingPwd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetPortalPassword = async () => {
    const email = account?.email || patientEmail;
    if (!email) {
      toast.error("Utente sem email registado.");
      return;
    }
    setResettingPwd(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-portal-password", {
        body: { paciente_id: patientId, email },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Link de reposição enviado para ${email}`);
      setConfirmReset(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar reposição de senha");
    } finally {
      setResettingPwd(false);
    }
  };

  useEffect(() => {
    loadData();
    QuestionnaireTemplateService.list()
      .then((tpls) => {
        setTemplates(tpls);
        // Suggest by age
        const suggestedIdentifier = QuestionnaireTemplateService.suggestIdentifierByAge(patientBirthDate);
        const suggested = tpls.find((t) => t.identifier === suggestedIdentifier) || tpls[0];
        if (suggested) setSelectedTemplateId(suggested.id);
      })
      .catch(() => {});
  }, [patientId, patientBirthDate]);

  const loadData = async () => {
    setLoading(true);
    const [accountRes, inviteRes, questionnaireRes] = await Promise.all([
      (supabase as any).from("portal_contas").select("*").eq("paciente_id", patientId).maybeSingle(),
      (supabase as any).from("portal_convites").select("*").eq("paciente_id", patientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("portal_questionario").select("*").eq("paciente_id", patientId).maybeSingle(),
    ]);
    setAccount(accountRes.data || null);
    setLastInvite(inviteRes.data || null);
    setQuestionnaire(questionnaireRes.data || null);
    setLoading(false);
  };

  const getStatus = (): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (!account && !lastInvite) return { label: "Não activado", variant: "secondary" };
    if (account?.status === "blocked") return { label: "Bloqueado", variant: "destructive" };
    if (account) return { label: "Conta activa", variant: "default" };
    return { label: "Convite enviado", variant: "outline" };
  };

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      // Smart association: check if the email already has a portal account
      if (patientEmail) {
        const { data: existingAccount } = await (supabase as any)
          .from("portal_contas")
          .select("id")
          .eq("email", patientEmail.toLowerCase())
          .neq("paciente_id", patientId)
          .maybeSingle();

        if (existingAccount) {
          // Email already has a portal account — link this patient to it
          const { error: linkError } = await (supabase as any)
            .from("portal_conta_pacientes")
            .insert({
              conta_id: existingAccount.id,
              paciente_id: patientId,
              relacao: "responsavel",
              is_primary: false,
            });

          if (!linkError) {
            toast.success("Paciente associado!", {
              description: `${patientEmail} já tem conta no portal. ${patientName} foi adicionado ao perfil existente.`,
            });
            await loadData();
            setGenerating(false);
            return;
          }
          // If link failed (e.g. already exists), proceed with normal invite
        }
      }

      const { data, error } = await supabase.functions.invoke("generate-portal-invite", {
        body: { paciente_id: patientId, email: patientEmail, telefone: patientPhone, template_id: selectedTemplateId || null },
      });
      if (error) throw error;
      toast.success("Convite gerado e enviado com sucesso!");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar convite.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendPortalLink = async () => {
    if (!patientEmail) {
      toast.error("Paciente não tem email registado.");
      return;
    }
    setSendingLink(true);
    try {
      const code = lastInvite && !lastInvite.utilizado && new Date(lastInvite.expira_em) > new Date()
        ? lastInvite.codigo
        : undefined;

      const { error } = await supabase.functions.invoke("send-patient-portal-link", {
        body: {
          to: patientEmail,
          patientName,
          subject: "Physione — Acesso ao Portal do Paciente",
          includeCode: code,
          type: account ? "access" : "invite",
        },
      });
      if (error) throw error;
      toast.success(`Link do portal enviado para ${patientEmail}`);
    } catch (err: any) {
      console.error("Erro ao enviar link:", err);
      toast.error("Erro ao enviar email. Verifique o email do paciente.");
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!lastInvite) return;
    const link = `${getPublicBaseUrl()}/portal/${lastInvite.link_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleToggleAccess = async () => {
    if (!account) return;
    setToggling(true);
    const newStatus = account.status === "blocked" ? "active" : "blocked";
    await (supabase as any).from("portal_contas").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", account.id);
    setAccount({ ...account, status: newStatus });
    toast.success(newStatus === "blocked" ? "Acesso bloqueado." : "Acesso reactivado.");
    setToggling(false);
  };

  const getInviteStatus = (): string => {
    if (!lastInvite) return "";
    if (lastInvite.utilizado) return "Utilizado";
    if (new Date(lastInvite.expira_em) < new Date()) return "Expirado";
    return "Pendente";
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const status = getStatus();

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Estado do Portal</span>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Account info */}
      {account && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{account.email || "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="capitalize">{account.provider}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Último acesso</span><span>{account.ultimo_acesso ? new Date(account.ultimo_acesso).toLocaleDateString("pt-PT") : "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Onboarding</span><span>{account.onboarding_completo ? "✓ Completo" : "Incompleto"}</span></div>
        </div>
      )}

      {/* Template selector */}
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Questionário a enviar</label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Escolher questionário..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.estimated_minutes ? ` (~${t.estimated_minutes})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={async () => {
            if (!patientEmail) { toast.error("Utente sem email registado. Adicione um email antes de gerar o magic link."); return; }
            setGenerating(true);
            try {
              const { error } = await supabase.functions.invoke("generate-portal-magic-link", {
                body: { paciente_id: patientId, email: patientEmail, template_id: selectedTemplateId || null },
              });
              if (error) throw error;
              toast.success("Magic link enviado por email (válido 24h, uso único).");
              await loadData();
            } catch (e: any) {
              toast.error(e.message || "Erro a gerar magic link");
            } finally { setGenerating(false); }
          }}
          disabled={generating || !patientEmail}
          className="gap-1.5"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {account ? "Reenviar magic link" : "Ativar portal (magic link)"}
        </Button>

        <Button size="sm" variant="outline" onClick={handleGenerateInvite} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {lastInvite ? "Gerar convite OTP (legado)" : "Gerar convite OTP"}
        </Button>

        {patientEmail && (
          <Button size="sm" variant="outline" onClick={handleSendPortalLink} disabled={sendingLink} className="gap-1.5">
            {sendingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Enviar Link do Portal
          </Button>
        )}

        {lastInvite && !lastInvite.utilizado && new Date(lastInvite.expira_em) > new Date() && (
          <>
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copiar link
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWaOpen(true)} className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Mensagem WhatsApp
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (!patientEmail) {
              toast.error("Utente sem email registado. Adicione um email antes de gerar o link.");
              return;
            }
            setGenerating(true);
            try {
              const { data, error } = await supabase.functions.invoke("generate-portal-magic-link", {
                body: {
                  paciente_id: patientId,
                  email: patientEmail,
                  template_id: selectedTemplateId || null,
                  skip_email: true,
                },
              });
              if (error) throw error;
              const link = (data as any)?.link as string | undefined;
              const token = link?.split("/portal/ativar/")[1];
              if (!token) throw new Error("Não foi possível gerar o token.");
              const directUrl = `${getPublicBaseUrl()}/portal/acesso/${token}`;
              await navigator.clipboard.writeText(directUrl);
              toast.success("Link de acesso directo copiado!", {
                description: "Envie por WhatsApp. Abre o portal sem código nem senha.",
              });
              await loadData();
            } catch (e: any) {
              toast.error(e.message || "Erro a gerar link de acesso");
            } finally {
              setGenerating(false);
            }
          }}
          disabled={generating || !patientEmail}
          className="gap-1.5"
          title="Gera um link único que abre o portal sem código nem senha (contingência)"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
          Link acesso directo (sem código)
        </Button>

        {account && (
          <Button
            size="sm"
            variant={account.status === "blocked" ? "default" : "destructive"}
            onClick={handleToggleAccess}
            disabled={toggling}
            className="gap-1.5"
          >
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : account.status === "blocked" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {account.status === "blocked" ? "Reactivar acesso" : "Bloquear acesso"}
          </Button>
        )}

        {isAdminMaster && (account?.email || patientEmail) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmReset(true)}
            disabled={resettingPwd}
            className="gap-1.5"
            title="Apenas Admin Master"
          >
            {resettingPwd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Repor senha
          </Button>
        )}
      </div>

      {/* Confirm password reset */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Repor senha do portal?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enviar link de reposição de senha para{" "}
            <strong>{account?.email || patientEmail}</strong>? O utente vai criar uma nova senha.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)} disabled={resettingPwd}>
              Cancelar
            </Button>
            <Button onClick={handleResetPortalPassword} disabled={resettingPwd}>
              {resettingPwd && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enviar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Last invite details */}
      {lastInvite && (
        <Collapsible open={inviteOpen} onOpenChange={setInviteOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
            Detalhes do último convite
            {inviteOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <Badge variant="outline" className="ml-auto text-[10px]">{getInviteStatus()}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Código</span><span className="font-mono font-bold tracking-widest">{lastInvite.codigo}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Enviado para</span><span>{lastInvite.enviado_para_email || lastInvite.enviado_para_telefone || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{new Date(lastInvite.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tentativas</span><span>{lastInvite.tentativas}/3</span></div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Questionnaire preview */}
      {questionnaire?.completo && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setQuestionnaireOpen(true)} className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" /> Ver questionário preenchido
          </Button>
          <Dialog open={questionnaireOpen} onOpenChange={setQuestionnaireOpen}>
            <DialogContent className="max-w-[520px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Questionário — {patientName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <Badge variant="outline" className="mb-2 capitalize">{questionnaire.perfil_tipo}</Badge>
                </div>
                {Object.keys(questionnaire.dados_pessoais || {}).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Dados Pessoais</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(questionnaire.dados_pessoais).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}><span className="text-muted-foreground text-xs">{k}: </span><span className="text-xs">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(questionnaire.perfil_saude || {}).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Perfil de Saúde</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(questionnaire.perfil_saude).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}><span className="text-muted-foreground text-xs">{k}: </span><span className="text-xs">{String(v)}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(questionnaire.expectativas || {}).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Expectativas</h4>
                    {Object.entries(questionnaire.expectativas).filter(([, v]) => v).map(([k, v]) => (
                      <p key={k} className="text-xs"><span className="text-muted-foreground">{k}: </span>{String(v)}</p>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Diagnóstico técnico — só Admin / Profissional */}
      {showDiagnostics && (
        <PortalDiagnosticsPanel patientId={patientId} patientName={patientName} />
      )}

      {/* WhatsApp message dialog */}
      {lastInvite && (
        <WhatsAppMessageDialog
          open={waOpen}
          onOpenChange={setWaOpen}
          patientName={patientName}
          link={`${getPublicBaseUrl()}/portal/${lastInvite.link_token}`}
          codigo={lastInvite.codigo}
          phone={patientPhone}
        />
      )}
    </div>
  );
}
