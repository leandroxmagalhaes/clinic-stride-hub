import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";
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

export default function QuestionarioPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PublicPatient | null>(null);
  const [template, setTemplate] = useState<any>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const draftKey = `questionario_publico:${token}`;

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
        setTemplate((data as any).template);
        setClinicName((data as any).clinic_name || null);
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

  const handleSubmit = async (answers: Record<string, Record<string, any>>) => {
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("questionario-publico", {
        body: { action: "submit", token, answers },
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-muted/30 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">A carregar o seu questionário...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
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

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">{clinicName || "Clínica"}</h1>
          {template?.name && <p className="text-xs text-muted-foreground">{template.name}</p>}
        </div>
      </div>

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

        {template && (
          <DynamicQuestionnaireRenderer
            template={template}
            pacienteId={null}
            draftKey={draftKey}
            saving={saving}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
