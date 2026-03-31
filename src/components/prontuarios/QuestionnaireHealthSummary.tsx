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
  { key: "semanas_gestacao", label: "Semanas de gestação" },
  { key: "tipo_parto", label: "Tipo de parto" },
  { key: "parto_induzido", label: "Parto induzido" },
  { key: "instrumentos", label: "Instrumentos (ventosa/fórceps)" },
  { key: "peso_nascer", label: "Peso ao nascer" },
  { key: "comprimento_nascer", label: "Comprimento ao nascer" },
  { key: "amamentacao", label: "Amamentação" },
  { key: "refluxo", label: "Refluxo" },
  { key: "colicas", label: "Cólicas" },
  { key: "sono", label: "Sono" },
  { key: "eliminacao_intestinal", label: "Eliminação intestinal" },
  { key: "infecoes_respiratorias", label: "Infecções respiratórias" },
  { key: "preferencia_postural", label: "Preferência postural" },
  { key: "vacinas", label: "Vacinas" },
  { key: "alergias", label: "Alergias" },
  { key: "medicacao", label: "Medicação" },
  { key: "diagnostico", label: "Diagnóstico médico" },
];

const adultFields = [
  { key: "motivo_consulta", label: "Motivo da consulta" },
  { key: "atividade_fisica", label: "Atividade física" },
  { key: "objetivo_tratamento", label: "Objectivo do tratamento" },
  { key: "lesoes_anteriores", label: "Lesões anteriores" },
  { key: "cirurgias", label: "Cirurgias" },
  { key: "medicacao", label: "Medicação" },
  { key: "alergias", label: "Alergias" },
  { key: "condicoes_cronicas", label: "Condições crónicas" },
];

const elderlyFields = [
  { key: "condicoes_cronicas", label: "Condições crónicas" },
  { key: "medicacao", label: "Medicação" },
  { key: "alergias", label: "Alergias" },
  { key: "historico_quedas", label: "Histórico de quedas" },
  { key: "auxilio_marcha", label: "Auxílio de marcha" },
  { key: "autonomia_diaria", label: "Autonomia diária" },
  { key: "cuidador", label: "Cuidador" },
];

const childFields = [
  { key: "motivo_consulta", label: "Motivo da consulta" },
  { key: "atividade_fisica", label: "Atividade física" },
  { key: "dificuldades_escolares", label: "Dificuldades escolares" },
  { key: "cirurgias", label: "Cirurgias/internamentos" },
  { key: "alergias", label: "Alergias" },
  { key: "medicacao", label: "Medicação" },
  { key: "vacinas", label: "Vacinas" },
  { key: "diagnostico", label: "Diagnóstico" },
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
  const perfilSaude: Record<string, unknown> = data.perfil_saude || {};
  const dadosPessoais: Record<string, unknown> = data.dados_pessoais || {};
  const expectativas: Record<string, unknown> = data.expectativas || {};
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
        {(expectativas.objetivos || expectativas.preocupacoes) && (
          <div className="border-t border-blue-200 pt-3 space-y-2">
            {expectativas.objetivos && (
              <div>
                <p className="text-xs text-muted-foreground">O que espera alcançar</p>
                <p className="text-sm font-medium">{String(expectativas.objetivos)}</p>
              </div>
            )}
            {expectativas.preocupacoes && (
              <div>
                <p className="text-xs text-muted-foreground">Preocupações</p>
                <p className="text-sm font-medium">{String(expectativas.preocupacoes)}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
