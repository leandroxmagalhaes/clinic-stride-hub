import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, PartyPopper, ArrowRight, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears } from "date-fns";
import { DynamicQuestionnaireRenderer } from "@/components/patient-portal/DynamicQuestionnaireRenderer";
import { QuestionnaireTemplateService, type QuestionnaireTemplate } from "@/services/QuestionnaireTemplateService";
import { PortalAccountService } from "@/services/PortalAccountService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type ProfileType = "baby" | "child" | "adult" | "elderly";

// Clickable option card
function OptionCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
        selected
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border bg-background text-foreground hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">{children}</h3>;
}

const STEP_LABELS = ["Dados Pessoais", "Perfil de Saúde", "Expectativas", "Pronto!"];
const STEP_TIMES = ["~2 min", "~3 min", "~1 min", ""];

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
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [profileType, setProfileType] = useState<ProfileType>("adult");
  const [dynamicTemplate, setDynamicTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [dynamicCompleted, setDynamicCompleted] = useState(false);
  const [dynamicInitialAnswers, setDynamicInitialAnswers] = useState<Record<string, Record<string, any>> | null>(null);
  const [resumeData, setResumeData] = useState<{ respostas: Record<string, Record<string, any>>; updatedAt: string } | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nif, setNif] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // Step 2 — all profiles use jsonb
  const [healthData, setHealthData] = useState<Record<string, any>>({});

  // Step 3
  const [expectations, setExpectations] = useState("");
  const [concerns, setConcerns] = useState("");

  const setHealth = (key: string, value: any) => setHealthData((prev) => ({ ...prev, [key]: value }));

  // Check for Google OAuth callback — also insert into portal_conta_pacientes
  useEffect(() => {
    const pending = localStorage.getItem("portal_google_pending");
    if (pending) {
      localStorage.removeItem("portal_google_pending");
      const pid = localStorage.getItem("portal_paciente_id");
      if (pid) {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session?.user) {
            // Idempotente: cria conta se não existe + garante associação ao utente
            await PortalAccountService.ensureAccountAndLink({
              authUserId: session.user.id,
              pacienteId: pid,
              email: session.user.email ?? null,
              provider: "google",
            });

            // Check dual-role
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
    }
  }, []);

  useEffect(() => {
    (async () => {
      let pid = localStorage.getItem("portal_paciente_id");

      // Fallback: if localStorage was cleared (e.g. mobile browser killed the tab),
      // recover the paciente_id from the authenticated portal account.
      if (!pid) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate("/portal/login");
          return;
        }
        const { data: conta } = await (supabase as any)
          .from("portal_contas")
          .select("id, paciente_id")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        let recovered: string | null = conta?.paciente_id ?? null;
        if (conta?.id && !recovered) {
          const { data: link } = await (supabase as any)
            .from("portal_conta_pacientes")
            .select("paciente_id")
            .eq("conta_id", conta.id)
            .limit(1)
            .maybeSingle();
          recovered = link?.paciente_id ?? null;
        }
        if (!recovered) {
          navigate("/portal/login");
          return;
        }
        pid = recovered;
        localStorage.setItem("portal_paciente_id", pid);
      }
      setPacienteId(pid);

      // Load patient data
      const { data } = await supabase
        .from("pacientes")
        .select("full_name, phone, email, birth_date, cpf, address")
        .eq("id", pid)
        .single();

      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setBirthDate(data.birth_date || "");
        setNif(data.cpf || "");
        setAddress(data.address || "");
        if (data.birth_date) setProfileType(detectProfile(data.birth_date));
      }

      // Check the most recent invite for a template_id (dynamic flow)
      const { data: inviteData } = await (supabase as any)
        .from("portal_convites")
        .select("template_id")
        .eq("paciente_id", pid)
        .not("template_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inviteData?.template_id) {
        try {
          const tpl = await QuestionnaireTemplateService.getById(inviteData.template_id);
          if (tpl) {
            setDynamicTemplate(tpl);

            // Check for in-progress questionnaire (resume flow)
            const { data: existingQ } = await (supabase as any)
              .from("portal_questionario")
              .select("respostas, completo, updated_at")
              .eq("paciente_id", pid)
              .maybeSingle();

            if (existingQ && existingQ.completo === true) {
              // Already completed — show completion screen directly
              setDynamicCompleted(true);
            } else if (existingQ && existingQ.respostas && Object.keys(existingQ.respostas || {}).length > 0) {
              // Has in-progress answers — offer resume
              setResumeData({ respostas: existingQ.respostas, updatedAt: existingQ.updated_at });
              setShowResumeDialog(true);
            } else {
              // No prior progress
              setShowQuestionnaire(true);
            }
          }
        } catch (e) {
          console.warn("Failed to load template, falling back to legacy flow", e);
        }
      }

      setLoading(false);
    })();
  }, [navigate]);

  const showGuardian = birthDate ? differenceInYears(new Date(), new Date(birthDate)) < 12 : false;

  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    setProfileType(detectProfile(val));
  };

  const saveStep1 = async () => {
    if (!pacienteId) return;
    setSaving(true);
    try {
      // Update patient record
      await supabase.from("pacientes").update({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        birth_date: birthDate || null,
        cpf: nif || null,
        address: address || null,
      }).eq("id", pacienteId);

      const dadosPessoais: Record<string, any> = { fullName, phone, email, birthDate, nif, address };
      if (showGuardian) {
        dadosPessoais.guardian = { name: guardianName, relation: guardianRelation, phone: guardianPhone };
      }

      await (supabase as any).from("portal_questionario").upsert({
        paciente_id: pacienteId,
        perfil_tipo: profileType,
        dados_pessoais: dadosPessoais,
      }, { onConflict: "paciente_id" });

      setStep(1);
    } catch { toast.error("Erro ao guardar dados."); }
    finally { setSaving(false); }
  };

  const saveStep2 = async () => {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await (supabase as any).from("portal_questionario").update({
        perfil_saude: healthData,
      }).eq("paciente_id", pacienteId);
      setStep(2);
    } catch { toast.error("Erro ao guardar."); }
    finally { setSaving(false); }
  };

  const saveStep3 = async () => {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await (supabase as any).from("portal_questionario").update({
        expectativas: { expectations, concerns },
        completo: true,
      }).eq("paciente_id", pacienteId);

      await (supabase as any).from("portal_contas").update({
        onboarding_completo: true,
        updated_at: new Date().toISOString(),
      }).eq("paciente_id", pacienteId);

      // Auto-send portal link email
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

      setStep(3);
    } catch { toast.error("Erro ao guardar."); }
    finally { setSaving(false); }
  };

  const saveDynamicAnswers = async (respostas: Record<string, Record<string, any>>) => {
    if (!pacienteId || !dynamicTemplate) return;
    setSaving(true);
    try {
      await (supabase as any).from("portal_questionario").upsert({
        paciente_id: pacienteId,
        perfil_tipo: dynamicTemplate.identifier,
        template_id: dynamicTemplate.id,
        respostas,
        completo: true,
      }, { onConflict: "paciente_id" });

      await (supabase as any).from("portal_contas").update({
        onboarding_completo: true,
        updated_at: new Date().toISOString(),
      }).eq("paciente_id", pacienteId);

      // Auto-send portal link email
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

  // Dynamic flow — when invite has a template_id
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
                saving={saving}
                onSubmit={saveDynamicAnswers}
                onExit={() => { localStorage.removeItem("portal_paciente_id"); navigate("/patient-portal"); }}
              />
            </>
          ) : (
            // Loading placeholder while resume dialog is open or before showing
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Resume dialog */}
        <Dialog open={showResumeDialog} onOpenChange={(open) => { if (!open) return; }}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader>
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileEdit className="h-6 w-6 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center">Tem um questionário em curso</DialogTitle>
              <DialogDescription className="text-center">
                Encontrámos um questionário que começou a preencher. Pode continuar de onde parou ou começar de novo.
              </DialogDescription>
            </DialogHeader>

            {resumeData && dynamicTemplate && (() => {
              const total = dynamicTemplate.schema.sections.length;
              const filled = dynamicTemplate.schema.sections.filter((s) => {
                const sa = (resumeData.respostas as any)[s.id] || {};
                return Object.values(sa).some((v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
              }).length;
              const dt = new Date(resumeData.updatedAt);
              return (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1 text-center">
                  <p>Já preencheu <strong>{filled}</strong> de <strong>{total}</strong> secções</p>
                  <p className="text-xs text-muted-foreground">
                    Última atualização: {dt.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              );
            })()}

            {confirmRestart ? (
              <div className="space-y-2">
                <p className="text-sm text-center text-destructive">Tem a certeza? Vai perder o progresso anterior.</p>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setConfirmRestart(false)} className="w-full sm:w-auto">Cancelar</Button>
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={async () => {
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
                      setShowResumeDialog(false);
                      setConfirmRestart(false);
                      setShowQuestionnaire(true);
                    }}
                  >
                    Sim, começar de novo
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setConfirmRestart(true)}
                >
                  Começar de novo
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (resumeData) setDynamicInitialAnswers(resumeData.respostas);
                    setShowResumeDialog(false);
                    setShowQuestionnaire(true);
                  }}
                >
                  Continuar de onde parei
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const progressValue = ((step + 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-[600px] mx-auto space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#1e40af] flex items-center justify-center text-white font-bold text-lg">P</div>
          <div>
            <p className="font-bold text-foreground">Physione</p>
            <p className="text-[10px] text-muted-foreground">Portal do Paciente</p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEP_LABELS.map((label, i) => (
              <span key={i} className={i === step ? "text-primary font-medium" : ""}>
                {label} {STEP_TIMES[i] && <span className="text-[10px]">({STEP_TIMES[i]})</span>}
              </span>
            ))}
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        {/* Step 0 — Dados Pessoais */}
        {step === 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">Dados Pessoais</h2>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
              <div className="grid grid-cols-2 gap-3">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data de Nascimento</label>
                  <Input type="date" value={birthDate} onChange={(e) => handleBirthDateChange(e.target.value)} />
                </div>
                <Input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="NIF / CPF" />
              </div>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Morada" />

              {showGuardian && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Dados do Responsável</h3>
                  <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Nome do responsável" />
                  <div className="flex flex-wrap gap-2">
                    {["Mãe", "Pai", "Avó/Avô", "Outro"].map((r) => (
                      <OptionCard key={r} label={r} selected={guardianRelation === r} onClick={() => setGuardianRelation(r)} />
                    ))}
                  </div>
                  <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="Telefone do responsável" />
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={saveStep1} disabled={saving || !fullName}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Próximo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1 — Perfil de Saúde */}
        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">Perfil de Saúde</h2>
              <p className="text-xs text-muted-foreground">Não se preocupe se não souber alguma resposta — pode selecionar "Não sei".</p>

              {profileType === "baby" && <BabyProfile healthData={healthData} setHealth={setHealth} />}
              {profileType === "child" && <ChildProfile healthData={healthData} setHealth={setHealth} />}
              {profileType === "adult" && <AdultProfile healthData={healthData} setHealth={setHealth} />}
              {profileType === "elderly" && <ElderlyProfile healthData={healthData} setHealth={setHealth} />}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
                <Button onClick={saveStep2} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Próximo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Expectativas */}
        {step === 2 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">Expectativas</h2>
              <div>
                <label className="text-sm font-medium mb-1 block">O que espera alcançar com o tratamento?</label>
                <Textarea rows={4} value={expectations} onChange={(e) => setExpectations(e.target.value)} placeholder="Descreva os seus objetivos..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tem alguma preocupação ou dúvida antes da primeira sessão? <span className="text-muted-foreground">(opcional)</span></label>
                <Textarea rows={3} value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Partilhe as suas preocupações..." />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
                <Button onClick={saveStep3} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Concluir
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Conclusão */}
        {step === 3 && (
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <PartyPopper className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Perfil completo!</h2>
              <p className="text-sm text-muted-foreground">
                Obrigado por completar o seu perfil. A fisioterapeuta vai rever as suas informações antes da primeira sessão.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>O Diário está disponível!</strong> A partir de agora, pode partilhar como está o dia a dia.
              </div>
              <Button onClick={() => { localStorage.removeItem("portal_paciente_id"); navigate("/patient-portal"); }} className="gap-2">
                Ir para o Diário <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── PROFILE-SPECIFIC COMPONENTS ─────────────────────────────────────

interface ProfileProps {
  healthData: Record<string, any>;
  setHealth: (key: string, value: any) => void;
}

function MultiOption({ field, options, healthData, setHealth }: ProfileProps & { field: string; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <OptionCard key={opt} label={opt} selected={healthData[field] === opt} onClick={() => setHealth(field, opt)} />
      ))}
    </div>
  );
}

function YesNoUnsure({ field, healthData, setHealth }: ProfileProps & { field: string }) {
  return <MultiOption field={field} options={["Sim", "Não", "Não sei"]} healthData={healthData} setHealth={setHealth} />;
}

function BabyProfile({ healthData, setHealth }: ProfileProps) {
  return (
    <div className="space-y-3">
      <SectionTitle>Nascimento</SectionTitle>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Semanas de gestação: <strong>{healthData.gestation || 38}</strong></label>
        <Slider min={24} max={42} step={1} value={[healthData.gestation || 38]} onValueChange={([v]) => setHealth("gestation", v)} />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>24 (prematuro extremo)</span><span>37+ (termo)</span><span>42</span>
        </div>
      </div>
      <label className="text-xs font-medium block">Tipo de parto</label>
      <MultiOption field="deliveryType" options={["Normal", "Cesariana", "Não sei"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Parto induzido</label>
      <YesNoUnsure field="induced" healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Instrumentos (ventosa, fórceps)</label>
      <YesNoUnsure field="instruments" healthData={healthData} setHealth={setHealth} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Peso ao nascer (ex: 3.200g)" value={healthData.birthWeight || ""} onChange={(e) => setHealth("birthWeight", e.target.value)} />
        <Input placeholder="Comprimento (ex: 49cm)" value={healthData.birthLength || ""} onChange={(e) => setHealth("birthLength", e.target.value)} />
      </div>

      <SectionTitle>Alimentação e Rotina</SectionTitle>
      <label className="text-xs font-medium block">Amamentação</label>
      <MultiOption field="breastfeeding" options={["Leite materno exclusivo", "Misto", "Fórmula", "Já não mama"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Refluxo</label>
      <MultiOption field="reflux" options={["Sim", "Não", "Às vezes", "Já passou"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Cólicas</label>
      <MultiOption field="colic" options={["Sim, frequentes", "Às vezes", "Não", "Já passaram"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Sono</label>
      <MultiOption field="sleep" options={["Dorme bem", "Acorda muito", "Dificuldade em adormecer", "Irregular"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Eliminação intestinal</label>
      <MultiOption field="bowel" options={["Regular", "Irregular", "Com dificuldade"]} healthData={healthData} setHealth={setHealth} />

      <SectionTitle>Saúde</SectionTitle>
      <label className="text-xs font-medium block">Infecções respiratórias frequentes</label>
      <MultiOption field="respiratoryInfections" options={["Sim", "Não", "Já teve mas resolveu"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Preferência postural</label>
      <MultiOption field="posturalPreference" options={["Sim", "Não", "Não notei"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Vacinas em dia</label>
      <YesNoUnsure field="vaccines" healthData={healthData} setHealth={setHealth} />
      <Input placeholder="Alergias conhecidas (opcional)" value={healthData.allergies || ""} onChange={(e) => setHealth("allergies", e.target.value)} />
      <Input placeholder="Medicação atual (opcional)" value={healthData.medication || ""} onChange={(e) => setHealth("medication", e.target.value)} />
      <Input placeholder="Diagnóstico médico (ex: torcicolo congénito)" value={healthData.diagnosis || ""} onChange={(e) => setHealth("diagnosis", e.target.value)} />
      <Textarea placeholder="Algo mais que queira partilhar? (opcional)" rows={2} value={healthData.otherNotes || ""} onChange={(e) => setHealth("otherNotes", e.target.value)} />
    </div>
  );
}

function ChildProfile({ healthData, setHealth }: ProfileProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-medium block">Motivo da consulta</label>
      <Textarea placeholder="Descreva o motivo..." rows={2} value={healthData.reason || ""} onChange={(e) => setHealth("reason", e.target.value)} />
      <label className="text-xs font-medium block">Atividade física</label>
      <MultiOption field="activity" options={["Nenhuma", "Educação física escolar", "Desporto organizado", "Muito activa"]} healthData={healthData} setHealth={setHealth} />
      <Input placeholder="Dificuldades escolares (opcional)" value={healthData.schoolDifficulties || ""} onChange={(e) => setHealth("schoolDifficulties", e.target.value)} />
      <Input placeholder="Cirurgias ou internamentos (opcional)" value={healthData.surgeries || ""} onChange={(e) => setHealth("surgeries", e.target.value)} />
      <Input placeholder="Alergias (opcional)" value={healthData.allergies || ""} onChange={(e) => setHealth("allergies", e.target.value)} />
      <Input placeholder="Medicação (opcional)" value={healthData.medication || ""} onChange={(e) => setHealth("medication", e.target.value)} />
      <label className="text-xs font-medium block">Vacinas em dia</label>
      <YesNoUnsure field="vaccines" healthData={healthData} setHealth={setHealth} />
      <Input placeholder="Diagnóstico médico (opcional)" value={healthData.diagnosis || ""} onChange={(e) => setHealth("diagnosis", e.target.value)} />
    </div>
  );
}

function AdultProfile({ healthData, setHealth }: ProfileProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-medium block">Motivo principal da consulta</label>
      <Textarea placeholder="Descreva o motivo..." rows={2} value={healthData.reason || ""} onChange={(e) => setHealth("reason", e.target.value)} />
      <label className="text-xs font-medium block">Atividade física</label>
      <MultiOption field="activity" options={["Sedentário", "Leve (caminhada)", "Moderada (ginásio)", "Intensa (desporto)"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Objectivo do tratamento</label>
      <MultiOption field="objective" options={["Reduzir dor", "Ganhar mobilidade", "Reab. pós-cirúrgica", "Performance desportiva", "Outro"]} healthData={healthData} setHealth={setHealth} />
      <Input placeholder="Lesões anteriores (opcional)" value={healthData.previousInjuries || ""} onChange={(e) => setHealth("previousInjuries", e.target.value)} />
      <Input placeholder="Cirurgias (opcional)" value={healthData.surgeries || ""} onChange={(e) => setHealth("surgeries", e.target.value)} />
      <Input placeholder="Medicação atual (opcional)" value={healthData.medication || ""} onChange={(e) => setHealth("medication", e.target.value)} />
      <Input placeholder="Alergias (opcional)" value={healthData.allergies || ""} onChange={(e) => setHealth("allergies", e.target.value)} />
      <Input placeholder="Condições crónicas (opcional)" value={healthData.chronicConditions || ""} onChange={(e) => setHealth("chronicConditions", e.target.value)} />
    </div>
  );
}

function ElderlyProfile({ healthData, setHealth }: ProfileProps) {
  return (
    <div className="space-y-3">
      <Input placeholder="Condições crónicas" value={healthData.chronicConditions || ""} onChange={(e) => setHealth("chronicConditions", e.target.value)} />
      <Input placeholder="Medicação atual" value={healthData.medication || ""} onChange={(e) => setHealth("medication", e.target.value)} />
      <Input placeholder="Alergias (opcional)" value={healthData.allergies || ""} onChange={(e) => setHealth("allergies", e.target.value)} />
      <label className="text-xs font-medium block">Histórico de quedas</label>
      <MultiOption field="fallHistory" options={["Nunca caiu", "Caiu 1-2 vezes", "Cai com frequência", "Tem medo de cair"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Auxílio de marcha</label>
      <MultiOption field="walkingAid" options={["Não usa", "Bengala", "Andarilho", "Cadeira de rodas"]} healthData={healthData} setHealth={setHealth} />
      <label className="text-xs font-medium block">Autonomia nas atividades diárias</label>
      <MultiOption field="autonomy" options={["Totalmente autónomo", "Precisa de alguma ajuda", "Muito dependente"]} healthData={healthData} setHealth={setHealth} />
      <Input placeholder="Nome do cuidador (opcional)" value={healthData.caregiverName || ""} onChange={(e) => setHealth("caregiverName", e.target.value)} />
      <Input placeholder="Telefone do cuidador (opcional)" value={healthData.caregiverPhone || ""} onChange={(e) => setHealth("caregiverPhone", e.target.value)} />
    </div>
  );
}
