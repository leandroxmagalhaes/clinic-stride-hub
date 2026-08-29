import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DynamicQuestionnaireRenderer } from "@/components/patient-portal/DynamicQuestionnaireRenderer";

interface PublicPatient {
  full_name: string | null;
  birth_date: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  health_insurance: string | null;
}

interface TemplateListItem {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  estimated_minutes: number | null;
}

type Step = "escolha" | "confirmacao" | "questionario";

interface TemaClinica {
  hsl: string;
  foreground: string;
  rgb: string;
}

// Mesma lógica de conversão hex -> HSL e contraste usada no script de arranque do index.html
function hexParaTema(hex: string): TemaClinica | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const c = hex.slice(1);
  const r = parseInt(c.substr(0, 2), 16) / 255;
  const g = parseInt(c.substr(2, 2), 16) / 255;
  const b = parseInt(c.substr(4, 2), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const H = Math.round(h * 360), S = Math.round(s * 100), L = Math.round(l * 100);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return {
    hsl: `${H} ${S}% ${L}%`,
    foreground: lum > 0.55 ? "0 0% 10%" : "0 0% 100%",
    rgb: `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`,
  };
}

const CORES_MODELOS: Record<string, string> = {
  template_baby_complete: "#7A5AA8",
  template_elderly: "#B4713D",
};

function corDoModelo(identifier: string, corClinica: string): string {
  if (identifier.includes("respir")) return "#3B6EA5";
  return CORES_MODELOS[identifier] ?? corClinica;
}

function ageInYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  if (isNaN(bd.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
}

export default function QuestionarioPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PublicPatient | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [clinicColor, setClinicColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [suggestedIdentifier, setSuggestedIdentifier] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [fullTemplate, setFullTemplate] = useState<any>(null);
  const [step, setStep] = useState<Step>("escolha");
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const draftKey = `questionario_publico:${token}:${fullTemplate?.id ?? ""}`;

  const corBase = clinicColor && /^#[0-9a-fA-F]{6}$/.test(clinicColor) ? clinicColor : "#2A9D8F";
  const tema = hexParaTema(corBase)!;
  const estiloEcran: CSSProperties = {
    ["--primary" as any]: tema.hsl,
    ["--ring" as any]: tema.hsl,
    ["--primary-foreground" as any]: tema.foreground,
    backgroundColor: `rgba(${tema.rgb}, 0.07)`,
  };
  const estiloFaixa: CSSProperties = { backgroundColor: `rgba(${tema.rgb}, 0.12)` };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("questionario-publico", {
          body: { action: "load", token },
        });
        if (fnError) {
          const ctx: any = (fnError as any).context;
          let msg = fnError.message;
          try {
            const body = await ctx?.json?.();
            if (body?.error) msg = body.error;
          } catch { /* ignore */ }
          throw new Error(msg);
        }
        if ((data as any)?.error) throw new Error((data as any).error);
        setPatient((data as any).patient);
        setClinicName((data as any).clinic_name || null);
        setClinicColor((data as any).clinic_primary_color || null);
        const list: TemplateListItem[] = (data as any).templates || [];
        setTemplates(list);
        const suggested: string | null = (data as any).suggested_identifier ?? null;
        setSuggestedIdentifier(suggested);
        const match = suggested
          ? list.find((t) => t.identifier === suggested) ?? null
          : null;
        setSelectedTemplate(match);
      } catch (err: any) {
        setError(err?.message || "Link inválido");
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
    else {
      setError("Link inválido");
      setLoading(false);
    }
  }, [token]);

  const handleConfirmTemplate = async () => {
    if (!selectedTemplate) return;
    setLoadingTemplate(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("questionario-publico", {
        body: { action: "template", token, template_id: selectedTemplate.id },
      });
      if (fnError) {
        const ctx: any = (fnError as any).context;
        let msg = fnError.message;
        try {
          const body = await ctx?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setFullTemplate((data as any).template);
      setStep("questionario");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o questionário");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSubmit = async (answers: Record<string, Record<string, any>>) => {
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("questionario-publico", {
        body: { action: "submit", token, answers, template_id: fullTemplate?.id },
      });
      if (fnError) {
        const ctx: any = (fnError as any).context;
        let msg = fnError.message;
        try {
          const body = await ctx?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      localStorage.removeItem(draftKey);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível enviar o questionário");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={estiloEcran} className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">A carregar o seu questionário...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={estiloEcran} className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-3 text-center">
            <h1 className="text-lg font-semibold">Não foi possível abrir o questionário</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Contacte a clínica para receber um novo link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={estiloEcran} className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-3 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-lg font-semibold">Questionário enviado com sucesso</h1>
            <p className="text-sm text-muted-foreground">
              Obrigado. A sua informação já está disponível para a equipa clínica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: "Nome completo", value: patient?.full_name },
    {
      label: "Data de nascimento",
      value: patient?.birth_date ? new Date(patient.birth_date).toLocaleDateString("pt-PT") : null,
    },
    { label: "NIF", value: patient?.cpf },
    { label: "Telefone", value: patient?.phone },
    { label: "Email", value: patient?.email },
    { label: "Seguradora", value: patient?.health_insurance },
  ].filter((r) => !!r.value);

  const dataHeader = (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h2 className="text-base font-semibold">Os seus dados</h2>
          <div className="space-y-1">
            {rows.map((r) => (
              <p key={r.label} className="text-sm">
                <span className="text-muted-foreground">{r.label}: </span>
                <span className="text-foreground">{r.value}</span>
              </p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Se algum destes dados estiver errado, avise a clínica.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const firstSectionIntro = (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4">
            <span className="text-xs text-muted-foreground shrink-0">{r.label}</span>
            <span className="text-sm text-foreground text-right">{r.value}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-1">
          Se algum destes dados estiver errado, avise a clínica.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Completar</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );

  // ----- Step: escolha -----
  if (step === "escolha") {
    return (
      <div style={estiloEcran} className="min-h-screen">
        <div style={estiloFaixa} className="sticky top-0 z-10 border-b px-4 py-4">
          <div className="max-w-lg mx-auto flex flex-col items-center gap-1 text-center">
            <h1 className="text-lg font-semibold text-foreground">{clinicName || "Clínica"}</h1>
          </div>
        </div>

        {dataHeader}

        <div className="max-w-lg mx-auto px-4 pb-10 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Qual questionário vai preencher?</h2>
          <div className="space-y-3">
            {templates.map((t) => {
              const isSelected = selectedTemplate?.id === t.id;
              const isSuggested = suggestedIdentifier && t.identifier === suggestedIdentifier;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : "border-border bg-white hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      )}
                      {t.estimated_minutes != null && (
                        <p className="text-xs text-muted-foreground">{t.estimated_minutes}</p>
                      )}
                    </div>
                    {isSuggested && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Sugerido para a idade
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!selectedTemplate}
            onClick={() => setStep("confirmacao")}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ----- Step: confirmacao -----
  if (step === "confirmacao") {
    const age = ageInYears(patient?.birth_date ?? null);
    const identifier = selectedTemplate?.identifier ?? null;
    let ageWarning: string | null = null;
    if (age != null && identifier) {
      if (age < 12 && (identifier === "template_adult" || identifier === "template_elderly")) {
        ageWarning = "Este questionário é de adulto, mas a data de nascimento indica uma criança. Confirme se é mesmo este.";
      } else if (
        age >= 18 &&
        (identifier === "template_baby_complete" || identifier === "template_child")
      ) {
        ageWarning = "Este questionário é pediátrico, mas a data de nascimento indica um adulto. Confirme se é mesmo este.";
      }
    }

    return (
      <div style={estiloEcran} className="min-h-screen">
        <div style={estiloFaixa} className="sticky top-0 z-10 border-b px-4 py-4">
          <div className="max-w-lg mx-auto flex flex-col items-center gap-1 text-center">
            <h1 className="text-lg font-semibold text-foreground">{clinicName || "Clínica"}</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-10">
          <Card>
            <CardContent className="pt-6 space-y-4 text-center">
              <h2 className="text-base font-semibold">Confirme antes de começar</h2>
              {selectedTemplate && (
                <>
                  <p className="text-lg font-semibold text-foreground">{selectedTemplate.name}</p>
                  {selectedTemplate.estimated_minutes != null && (
                    <p className="text-sm text-muted-foreground">
                      Tempo estimado: {selectedTemplate.estimated_minutes}min
                    </p>
                  )}
                </>
              )}
              <p className="text-sm text-muted-foreground">
                Depois de submeter não é possível voltar a preencher este link.
              </p>

              {ageWarning && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-left">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-800">{ageWarning}</p>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={loadingTemplate}
                  onClick={handleConfirmTemplate}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  {loadingTemplate && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loadingTemplate ? "A abrir..." : "Confirmar e começar"}
                </button>
                <button
                  type="button"
                  disabled={loadingTemplate}
                  onClick={() => setStep("escolha")}
                  className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Escolher outro
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ----- Step: questionario -----
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">{clinicName || "Clínica"}</h1>
          {fullTemplate?.name && <p className="text-xs text-muted-foreground">{fullTemplate.name}</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {fullTemplate && (
          <DynamicQuestionnaireRenderer
            template={fullTemplate}
            pacienteId={null}
            draftKey={draftKey}
            saving={saving}
            layout="acordeao"
            firstSectionIntro={firstSectionIntro}
            onSubmit={handleSubmit}
          />
        )}
        <p className="text-xs text-muted-foreground text-center">
          As suas respostas ficam guardadas neste telemóvel.
        </p>
      </div>
    </div>
  );
}
