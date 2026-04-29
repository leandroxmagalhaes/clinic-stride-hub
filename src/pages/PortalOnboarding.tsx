import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, PartyPopper, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears } from "date-fns";
import { DynamicQuestionnaireRenderer } from "@/components/patient-portal/DynamicQuestionnaireRenderer";
import { DraftDetectionBanner } from "@/components/patient-portal/DraftDetectionBanner";
import { QuestionnaireTemplateService, mergeLegacyIntoRespostas, type QuestionnaireTemplate } from "@/services/QuestionnaireTemplateService";
import { PortalAccountService } from "@/services/PortalAccountService";

type ProfileType = "baby" | "child" | "adult" | "elderly";

function detectProfile(birthDate: string): ProfileType {
  if (!birthDate) return "adult";
  const age = differenceInYears(new Date(), new Date(birthDate));
  if (age < 2) return "baby";
  if (age < 12) return "child";
  if (age >= 65) return "elderly";
  return "adult";
}

export default function PortalOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dynamicTemplate, setDynamicTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [dynamicCompleted, setDynamicCompleted] = useState(false);
  const [dynamicInitialAnswers, setDynamicInitialAnswers] = useState<Record<string, Record<string, any>> | null>(null);
  const [resumeData, setResumeData] = useState<{ respostas: Record<string, Record<string, any>>; updatedAt: string } | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(() => localStorage.getItem("portal_invite_token"));

  // Check for Google OAuth callback — also insert into portal_conta_pacientes
  useEffect(() => {
    const pending = localStorage.getItem("portal_google_pending");
    if (pending) {
      localStorage.removeItem("portal_google_pending");
      const pid = localStorage.getItem("portal_paciente_id");
      const token = localStorage.getItem("portal_invite_token");
      if (pid) {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session?.user) {
            const linked = await PortalAccountService.ensureAccountAndLink({
              authUserId: session.user.id,
              pacienteId: pid,
              email: session.user.email ?? null,
              provider: "google",
              inviteToken: token,
            });
            if (linked) setInviteToken(token);

            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("id, role")
              .eq("user_id", session.user.id)
              .maybeSingle();

            if (existingProfile && existingProfile.role !== 'patient') {
              await supabase
                .from("profiles")
                .update({ portal_role: "both" } as any)
                .eq("id", existingProfile.id);
            }
          }
        });
      }
      if (!pid) {
        localStorage.removeItem("portal_invite_token");
        setInviteToken(null);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      let pid = localStorage.getItem("portal_paciente_id");
      const currentInviteToken = localStorage.getItem("portal_invite_token");
      if (currentInviteToken) setInviteToken(currentInviteToken);

      if (pid && currentInviteToken) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await PortalAccountService.ensureAccountAndLink({
            authUserId: session.user.id,
            pacienteId: pid,
            email: session.user.email ?? null,
            provider: "email",
            inviteToken: currentInviteToken,
          });
        }
      }

      if (!pid) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate("/portal/login");
          return;
        }
        const resolved = await PortalAccountService.resolveForUser(session.user.id);
        if (resolved.status === "ok" && resolved.onboardingCompleto) {
          navigate("/patient-portal");
          return;
        }
        if (!resolved.primaryPacienteId) {
          navigate("/portal/login");
          return;
        }
        pid = resolved.primaryPacienteId;
        localStorage.setItem("portal_paciente_id", pid);
      }
      setPacienteId(pid);

      const { data } = await supabase
        .from("pacientes")
        .select("full_name, email, birth_date")
        .eq("id", pid)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setEmail(data.email || "");
      }

      try {
        const tpl = await QuestionnaireTemplateService.resolveForPatient({
          pacienteId: pid,
          perfilTipo: data?.birth_date ? detectProfile(data.birth_date) : null,
          birthDate: data?.birth_date || null,
        });

        if (tpl) {
          setDynamicTemplate(tpl);

          const { data: existingQ } = await (supabase as any)
            .from("portal_questionario")
            .select("respostas, completo, updated_at, dados_pessoais, perfil_saude, expectativas, template_id")
            .eq("paciente_id", pid)
            .maybeSingle();

          if (existingQ?.completo === true) {
            setDynamicCompleted(true);
          } else {
            const baseRespostas = (existingQ?.respostas && typeof existingQ.respostas === "object") ? existingQ.respostas : {};
            const merged = mergeLegacyIntoRespostas({
              template: tpl,
              respostas: baseRespostas,
              legacy: {
                dados_pessoais: existingQ?.dados_pessoais || null,
                perfil_saude: existingQ?.perfil_saude || null,
                expectativas: existingQ?.expectativas || null,
              },
            });

            const hasAnyAnswers = Object.values(merged).some(
              (s: any) => s && typeof s === "object" && Object.values(s).some((v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
            );

            if (hasAnyAnswers) {
              setResumeData({
                respostas: merged,
                updatedAt: existingQ?.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (e) {
        console.warn("Failed to resolve template", e);
      }

      setLoading(false);
    })();
  }, [navigate]);

  const saveDynamicAnswers = async (respostas: Record<string, Record<string, any>>) => {
    if (!pacienteId || !dynamicTemplate) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("upsert_portal_questionnaire", {
        p_paciente_id: pacienteId,
        p_template_id: dynamicTemplate.id,
        p_perfil_tipo: dynamicTemplate.identifier,
        p_respostas: respostas,
        p_completo: true,
        p_link_token: inviteToken || localStorage.getItem("portal_invite_token") || null,
      });
      if (error) throw error;

      if (email) {
        try {
          await supabase.functions.invoke("send-patient-portal-link", {
            body: {
              to: email,
              patientName: fullName || "Paciente",
              subject: "Physione — O seu Portal está pronto!",
              type: "ready",
            },
          });
        } catch (e) {
          console.error("Failed to send portal ready email:", e);
        }
      }

      setDynamicCompleted(true);
      localStorage.removeItem(`portal_questionario_draft:${pacienteId}:${dynamicTemplate.id}`);
      localStorage.removeItem("portal_invite_token");
      setInviteToken(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao guardar questionário.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (dynamicTemplate) {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-[600px] mx-auto space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#1e40af] flex items-center justify-center text-white font-bold text-lg">P</div>
            <div>
              <p className="font-bold text-foreground">Physione</p>
              <p className="text-[10px] text-muted-foreground">Portal do Paciente</p>
            </div>
          </div>

          {dynamicCompleted ? (
            <Card>
              <CardContent className="pt-8 text-center space-y-4">
                <PartyPopper className="h-16 w-16 text-primary mx-auto" />
                <h2 className="text-xl font-bold">Questionário concluído!</h2>
                <p className="text-sm text-muted-foreground">
                  Obrigado. A clínica vai rever as suas respostas antes da primeira sessão.
                </p>
                <Button onClick={() => { localStorage.removeItem("portal_paciente_id"); navigate("/patient-portal"); }} className="gap-2">
                  Ir para o Portal <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : showQuestionnaire ? (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold">{dynamicTemplate.name}</h1>
                {dynamicTemplate.description && (
                  <p className="text-sm text-muted-foreground">{dynamicTemplate.description}</p>
                )}
                {dynamicTemplate.estimated_minutes && (
                  <p className="text-xs text-muted-foreground">Tempo estimado: {dynamicTemplate.estimated_minutes}</p>
                )}
              </div>
              <DynamicQuestionnaireRenderer
                template={dynamicTemplate}
                pacienteId={pacienteId}
                initialAnswers={dynamicInitialAnswers || undefined}
                inviteToken={inviteToken}
                saving={saving}
                onSubmit={saveDynamicAnswers}
                onExit={() => { localStorage.removeItem("portal_paciente_id"); navigate("/patient-portal"); }}
              />
            </>
          ) : pacienteId ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center space-y-1">
                  <h1 className="text-xl font-bold">{dynamicTemplate.name}</h1>
                  {dynamicTemplate.description && (
                    <p className="text-sm text-muted-foreground">{dynamicTemplate.description}</p>
                  )}
                  {dynamicTemplate.estimated_minutes && (
                    <p className="text-xs text-muted-foreground">Tempo estimado: {dynamicTemplate.estimated_minutes}</p>
                  )}
                </div>

                <DraftDetectionBanner
                  pacienteId={pacienteId}
                  templateId={dynamicTemplate.id}
                  onResume={(answers) => {
                    setDynamicInitialAnswers(answers);
                    setShowQuestionnaire(true);
                  }}
                  onStartFresh={async () => {
                    if (!pacienteId) return;
                    try {
                      await (supabase as any)
                        .from("portal_questionario")
                        .update({ respostas: {}, updated_at: new Date().toISOString() })
                        .eq("paciente_id", pacienteId);
                    } catch (e) {
                      console.warn("Failed to clear progress", e);
                    }
                    setDynamicInitialAnswers({});
                    setResumeData(null);
                    setShowQuestionnaire(true);
                  }}
                  onAlreadyCompleted={() => {
                    localStorage.removeItem("portal_paciente_id");
                    navigate("/patient-portal");
                  }}
                />

                <div className="flex justify-center pt-2">
                  <Button
                    size="lg"
                    onClick={() => {
                      if (resumeData) setDynamicInitialAnswers(resumeData.respostas);
                      setShowQuestionnaire(true);
                    }}
                    className="gap-2"
                  >
                    Começar questionário <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: no template could be resolved
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">Não foi possível carregar o questionário</h2>
          <p className="text-sm text-muted-foreground">Contacte a clínica para receber um novo link de acesso.</p>
        </CardContent>
      </Card>
    </div>
  );
}
