import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Wrench, AlertTriangle, Upload, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";

interface Props {
  patientId: string;
  patientName: string;
}

interface QuestionnaireRow {
  id: string;
  template_id: string | null;
  perfil_tipo: string | null;
  respostas: Record<string, any> | null;
  completo: boolean;
  updated_at: string;
}

interface InviteRow {
  id: string;
  codigo: string;
  link_token: string;
  enviado_para_email: string | null;
  enviado_para_telefone: string | null;
  utilizado: boolean;
  expira_em: string;
  tentativas: number;
  created_at: string;
}

interface AccountRow {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  provider: string | null;
  ultimo_acesso: string | null;
  onboarding_completo: boolean;
}

interface AssociationRow {
  conta_id: string;
  paciente_id: string;
  is_primary: boolean;
  relacao: string;
  paciente?: { full_name: string } | null;
}

interface HistoryRow {
  id: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  alterado_por: string;
  created_at: string;
}

export function PortalDiagnosticsPanel({ patientId, patientName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireRow | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [associations, setAssociations] = useState<AssociationRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, iRes, aRes, hRes] = await Promise.all([
        (supabase as any).from("portal_questionario").select("*").eq("paciente_id", patientId).maybeSingle(),
        (supabase as any).from("portal_convites").select("*").eq("paciente_id", patientId).order("created_at", { ascending: false }).limit(10),
        (supabase as any).from("portal_contas").select("*").eq("paciente_id", patientId).maybeSingle(),
        (supabase as any).from("portal_questionario_historico").select("*").eq("paciente_id", patientId).order("created_at", { ascending: false }).limit(5),
      ]);
      setQuestionnaire(qRes.data || null);
      setInvites(iRes.data || []);
      setAccount(aRes.data || null);
      setHistory(hRes.data || []);

      if (aRes.data?.id) {
        const { data: assoc } = await (supabase as any)
          .from("portal_conta_pacientes")
          .select("conta_id, paciente_id, is_primary, relacao, paciente:pacientes!inner(full_name)")
          .eq("conta_id", aRes.data.id);
        setAssociations(assoc || []);
      } else {
        setAssociations([]);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar diagnóstico: " + (err.message || "desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, patientId]);

  const respostasKeys = questionnaire?.respostas && typeof questionnaire.respostas === "object"
    ? Object.keys(questionnaire.respostas).filter((k) => {
        const v = (questionnaire.respostas as any)[k];
        return v && typeof v === "object" && Object.keys(v).length > 0;
      })
    : [];

  const usedInviteWithoutAnswers =
    invites.some((i) => i.utilizado) &&
    questionnaire &&
    !questionnaire.completo &&
    respostasKeys.length === 0;

  const inviteStatus = (i: InviteRow): { label: string; tone: "default" | "secondary" | "destructive" | "outline" } => {
    if (i.utilizado) return { label: "Utilizado", tone: "secondary" };
    if (new Date(i.expira_em) < new Date()) return { label: "Expirado", tone: "destructive" };
    return { label: "Pendente", tone: "default" };
  };

  const handleImport = async () => {
    if (!importJson.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed || typeof parsed !== "object") throw new Error("JSON inválido");
      const templateId = questionnaire?.template_id || null;
      const perfilTipo = questionnaire?.perfil_tipo || "adult";

      const { error } = await (supabase as any).rpc("upsert_portal_questionnaire", {
        p_paciente_id: patientId,
        p_template_id: templateId,
        p_perfil_tipo: perfilTipo,
        p_respostas: parsed,
        p_completo: false,
        p_link_token: null,
      });
      if (error) throw error;
      toast.success("Rascunho importado com sucesso!");
      setImportOpen(false);
      setImportJson("");
      await load();
    } catch (err: any) {
      toast.error("Falha na importação: " + (err.message || "JSON inválido"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span>Diagnóstico técnico do Portal</span>
            <Badge variant="outline" className="text-[10px]">Equipa</Badge>
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t">
          <div className="p-3 space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> A carregar...
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 h-7 text-xs">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </Button>
            </div>

            {/* Alerta crítico: convite usado sem respostas */}
            {usedInviteWithoutAnswers && (
              <div className="bg-destructive/10 border border-destructive/30 rounded p-2.5 flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive">Convite usado mas sem respostas no servidor.</p>
                  <p className="text-muted-foreground mt-0.5">
                    O utente abriu o link mas as respostas não chegaram à base de dados.
                    Pode tentar recuperar via "Importar rascunho local" se tiver acesso ao dispositivo original.
                  </p>
                </div>
              </div>
            )}

            {/* Estado do questionário */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Questionário no servidor</h4>
              {questionnaire ? (
                <div className="bg-muted/40 rounded p-2.5 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><span>{questionnaire.completo ? "✓ Completo" : "Incompleto"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Última atualização</span><span>{format(new Date(questionnaire.updated_at), "dd/MM/yyyy HH:mm")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Secções com conteúdo</span><span>{respostasKeys.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Template ID</span><span className="font-mono text-[10px] truncate max-w-[200px]">{questionnaire.template_id || "—"}</span></div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sem questionário criado.</p>
              )}
            </section>

            {/* Histórico de convites */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Histórico de convites ({invites.length})</h4>
              {invites.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum convite gerado.</p>
              ) : (
                <div className="space-y-1">
                  {invites.map((i) => {
                    const st = inviteStatus(i);
                    return (
                      <div key={i.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                        <span className="text-muted-foreground tabular-nums w-[90px]">{format(new Date(i.created_at), "dd/MM HH:mm")}</span>
                        <span className="flex-1 truncate">{i.enviado_para_email || i.enviado_para_telefone || "—"}</span>
                        <span className="font-mono text-[10px]">{i.tentativas}/3</span>
                        <Badge variant={st.tone} className="text-[10px]">{st.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Conta + associações */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Conta do Portal</h4>
              {account ? (
                <div className="bg-muted/40 rounded p-2.5 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="truncate ml-2">{account.email || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="capitalize">{account.provider || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Último acesso</span><span>{account.ultimo_acesso ? formatDistanceToNow(new Date(account.ultimo_acesso), { addSuffix: true, locale: pt }) : "Nunca"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Onboarding</span><span>{account.onboarding_completo ? "✓ Completo" : "Incompleto"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Auth user ID</span><span className="font-mono text-[10px] truncate max-w-[180px]">{account.auth_user_id || "—"}</span></div>
                  {associations.length > 1 && (
                    <div className="pt-1.5 mt-1 border-t border-border/50">
                      <p className="text-muted-foreground mb-1">Utentes associados a esta conta:</p>
                      {associations.map((a) => (
                        <div key={a.paciente_id} className="flex items-center gap-1.5">
                          <span>{a.paciente?.full_name || a.paciente_id}</span>
                          {a.is_primary && <Badge variant="outline" className="text-[9px]">primário</Badge>}
                          {a.paciente_id === patientId && <Badge variant="default" className="text-[9px]">atual</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sem conta criada.</p>
              )}
            </section>

            {/* Histórico de alterações */}
            {history.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Últimas alterações</h4>
                <div className="space-y-1">
                  {history.map((h) => (
                    <div key={h.id} className="text-xs bg-muted/30 rounded px-2 py-1.5">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium truncate">{h.campo_alterado}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{format(new Date(h.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      <div className="text-muted-foreground text-[10px] mt-0.5 truncate">por {h.alterado_por}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recuperação manual */}
            <section className="pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Importar respostas de rascunho local
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Use quando o utente preencheu mas as respostas não foram enviadas. Peça-lhe para abrir o portal no <strong>mesmo dispositivo + browser</strong>,
                aceder ao localStorage (DevTools → Application → Local Storage) e copiar o valor da chave <code className="bg-muted px-1 rounded text-[9px]">portal_questionario_draft:&lt;id&gt;:&lt;tpl&gt;</code>.
              </p>
            </section>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Importar rascunho local — {patientName}</DialogTitle>
            <DialogDescription className="text-xs">
              Cole o JSON do rascunho. Vai ser gravado como respostas incompletas — o utente pode depois rever e submeter.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='{"identificacao_menor": {"nome_completo": "..."}, ...}'
            rows={12}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || !importJson.trim()}>
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
