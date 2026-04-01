import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

interface Props {
  pacienteId: string;
}

const babyFields = [
  { key: "gestation", label: "Semanas de gestação" },
  { key: "deliveryType", label: "Tipo de parto" },
  { key: "induced", label: "Parto induzido" },
  { key: "instruments", label: "Instrumentos (ventosa/fórceps)" },
  { key: "birthWeight", label: "Peso ao nascer" },
  { key: "birthLength", label: "Comprimento ao nascer" },
  { key: "breastfeeding", label: "Amamentação" },
  { key: "reflux", label: "Refluxo" },
  { key: "colic", label: "Cólicas" },
  { key: "sleep", label: "Sono" },
  { key: "bowel", label: "Eliminação intestinal" },
  { key: "respiratoryInfections", label: "Infecções respiratórias" },
  { key: "posturalPreference", label: "Preferência postural" },
  { key: "vaccines", label: "Vacinas" },
  { key: "allergies", label: "Alergias" },
  { key: "medication", label: "Medicação" },
  { key: "diagnosis", label: "Diagnóstico médico" },
];

const adultFields = [
  { key: "reason", label: "Motivo da consulta" },
  { key: "activity", label: "Atividade física" },
  { key: "objective", label: "Objectivo do tratamento" },
  { key: "previousInjuries", label: "Lesões anteriores" },
  { key: "surgeries", label: "Cirurgias" },
  { key: "medication", label: "Medicação" },
  { key: "allergies", label: "Alergias" },
  { key: "chronicConditions", label: "Condições crónicas" },
];

const elderlyFields = [
  { key: "chronicConditions", label: "Condições crónicas" },
  { key: "medication", label: "Medicação" },
  { key: "allergies", label: "Alergias" },
  { key: "fallHistory", label: "Histórico de quedas" },
  { key: "walkingAid", label: "Auxílio de marcha" },
  { key: "autonomy", label: "Autonomia diária" },
  { key: "caregiverName", label: "Cuidador" },
];

const childFields = [
  { key: "reason", label: "Motivo da consulta" },
  { key: "activity", label: "Atividade física" },
  { key: "schoolDifficulties", label: "Dificuldades escolares" },
  { key: "surgeries", label: "Cirurgias/internamentos" },
  { key: "allergies", label: "Alergias" },
  { key: "medication", label: "Medicação" },
  { key: "vaccines", label: "Vacinas" },
  { key: "diagnosis", label: "Diagnóstico" },
];

const fieldsByProfile: Record<string, typeof babyFields> = {
  baby: babyFields,
  adult: adultFields,
  elderly: elderlyFields,
  child: childFields,
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  return String(val);
}

export function QuestionnaireHealthSummary({ pacienteId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: q } = await (supabase as any)
          .from("portal_questionario")
          .select("*")
          .eq("paciente_id", pacienteId)
          .eq("completo", true)
          .maybeSingle();
        setData(q);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [pacienteId]);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!data) return null;

  const perfilTipo: string = data.perfil_tipo || "adult";
  const perfilSaude: Record<string, unknown> = typeof data.perfil_saude === 'string'
    ? JSON.parse(data.perfil_saude)
    : (data.perfil_saude || {});
  const dadosPessoais: Record<string, unknown> = typeof data.dados_pessoais === 'string'
    ? JSON.parse(data.dados_pessoais)
    : (data.dados_pessoais || {});
  const expectativas: Record<string, unknown> = typeof data.expectativas === 'string'
    ? JSON.parse(data.expectativas)
    : (data.expectativas || {});
  const fields = fieldsByProfile[perfilTipo] || adultFields;

  // Merge dados_pessoais + perfil_saude for lookup
  const allData = { ...dadosPessoais, ...perfilSaude };

  return (
    <Card className="border-blue-200 bg-blue-50/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-5 w-5 text-blue-600" />
          <CardTitle className="font-display text-lg text-blue-900">Resumo de Saúde</CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
            Preenchido pelo utente
          </Badge>
        </div>
        <p className="text-xs text-blue-600/70 mt-1">
          Informações fornecidas pelo paciente/responsável no portal
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium">
                {formatValue(allData[key])}
              </p>
            </div>
          ))}
        </div>

        {/* Expectativas */}
        {(expectativas.expectations || expectativas.concerns) && (
          <div className="border-t border-blue-200 pt-3 space-y-2">
            {expectativas.expectations && (
              <div>
                <p className="text-xs text-muted-foreground">O que espera alcançar</p>
                <p className="text-sm font-medium">{String(expectativas.expectations)}</p>
              </div>
            )}
            {expectativas.concerns && (
              <div>
                <p className="text-xs text-muted-foreground">Preocupações</p>
                <p className="text-sm font-medium">{String(expectativas.concerns)}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
