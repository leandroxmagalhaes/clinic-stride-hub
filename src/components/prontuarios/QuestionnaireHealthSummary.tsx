import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Pencil, Save, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears } from "date-fns";

interface Props {
  pacienteId: string;
  birthDate?: string | null;
}

const babyFields = [
  { key: "gestation", label: "Semanas de gestação", type: "text" },
  { key: "deliveryType", label: "Tipo de parto", type: "select", options: ["Normal", "Cesárea", "Ventosa", "Fórceps"] },
  { key: "induced", label: "Parto induzido", type: "boolean" },
  { key: "instruments", label: "Instrumentos (ventosa/fórceps)", type: "boolean" },
  { key: "birthWeight", label: "Peso ao nascer", type: "text" },
  { key: "birthLength", label: "Comprimento ao nascer", type: "text" },
  { key: "breastfeeding", label: "Amamentação", type: "select", options: ["Exclusiva", "Mista", "Artificial"] },
  { key: "reflux", label: "Refluxo", type: "boolean" },
  { key: "colic", label: "Cólicas", type: "boolean" },
  { key: "sleep", label: "Sono", type: "select", options: ["Bom", "Regular", "Mau"] },
  { key: "bowel", label: "Eliminação intestinal", type: "select", options: ["Normal", "Obstipação", "Diarreia"] },
  { key: "respiratoryInfections", label: "Infecções respiratórias", type: "boolean" },
  { key: "posturalPreference", label: "Preferência postural", type: "text" },
  { key: "vaccines", label: "Vacinas", type: "text" },
  { key: "allergies", label: "Alergias", type: "text" },
  { key: "medication", label: "Medicação", type: "text" },
  { key: "diagnosis", label: "Diagnóstico médico", type: "text" },
];

const adultFields = [
  { key: "reason", label: "Motivo da consulta", type: "textarea" },
  { key: "activity", label: "Atividade física", type: "text" },
  { key: "objective", label: "Objectivo do tratamento", type: "textarea" },
  { key: "previousInjuries", label: "Lesões anteriores", type: "text" },
  { key: "surgeries", label: "Cirurgias", type: "text" },
  { key: "medication", label: "Medicação", type: "text" },
  { key: "allergies", label: "Alergias", type: "text" },
  { key: "chronicConditions", label: "Condições crónicas", type: "text" },
];

const elderlyFields = [
  { key: "chronicConditions", label: "Condições crónicas", type: "text" },
  { key: "medication", label: "Medicação", type: "text" },
  { key: "allergies", label: "Alergias", type: "text" },
  { key: "fallHistory", label: "Histórico de quedas", type: "boolean" },
  { key: "walkingAid", label: "Auxílio de marcha", type: "select", options: ["Nenhum", "Bengala", "Andarilho", "Cadeira de rodas"] },
  { key: "autonomy", label: "Autonomia diária", type: "select", options: ["Independente", "Parcialmente dependente", "Dependente"] },
  { key: "caregiverName", label: "Cuidador", type: "text" },
];

const childFields = [
  { key: "reason", label: "Motivo da consulta", type: "textarea" },
  { key: "activity", label: "Atividade física", type: "text" },
  { key: "schoolDifficulties", label: "Dificuldades escolares", type: "text" },
  { key: "surgeries", label: "Cirurgias/internamentos", type: "text" },
  { key: "allergies", label: "Alergias", type: "text" },
  { key: "medication", label: "Medicação", type: "text" },
  { key: "vaccines", label: "Vacinas", type: "text" },
  { key: "diagnosis", label: "Diagnóstico", type: "text" },
];

type FieldDef = typeof babyFields[number];

const fieldsByProfile: Record<string, FieldDef[]> = {
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

function detectProfile(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const age = differenceInYears(new Date(), new Date(birthDate));
  if (age <= 2) return "baby";
  if (age <= 12) return "child";
  if (age >= 65) return "elderly";
  return "adult";
}

export function QuestionnaireHealthSummary({ pacienteId, birthDate }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [editExpectativas, setEditExpectativas] = useState<Record<string, string>>({});
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

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

  // No data — show "fill manually" option
  if (!data && !creating) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 text-center space-y-3">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            O utente ainda não preencheu o questionário de saúde no portal.
          </p>
          <Button variant="outline" size="sm" onClick={() => {
            const detected = detectProfile(birthDate);
            setSelectedProfile(detected);
            setEditValues({});
            setEditExpectativas({});
            setCreating(true);
          }}>
            <Plus className="h-4 w-4 mr-1" />
            Preencher manualmente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Determine profile type
  const perfilTipo: string = creating
    ? (selectedProfile || "adult")
    : (data?.perfil_tipo || "adult");

  const perfilSaude: Record<string, unknown> = creating ? {} : (
    typeof data?.perfil_saude === 'string' ? JSON.parse(data.perfil_saude) : (data?.perfil_saude || {})
  );
  const dadosPessoais: Record<string, unknown> = creating ? {} : (
    typeof data?.dados_pessoais === 'string' ? JSON.parse(data.dados_pessoais) : (data?.dados_pessoais || {})
  );
  const expectativas: Record<string, unknown> = creating ? {} : (
    typeof data?.expectativas === 'string' ? JSON.parse(data.expectativas) : (data?.expectativas || {})
  );

  const fields = fieldsByProfile[perfilTipo] || adultFields;
  const allData = creating ? editValues : (editing ? editValues : { ...dadosPessoais, ...perfilSaude });

  const startEdit = () => {
    setEditValues({ ...dadosPessoais, ...perfilSaude });
    setEditExpectativas({
      expectations: String(expectativas.expectations || ""),
      concerns: String(expectativas.concerns || ""),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setCreating(false);
    setEditValues({});
    setEditExpectativas({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        paciente_id: pacienteId,
        perfil_tipo: perfilTipo,
        perfil_saude: editValues,
        dados_pessoais: editValues,
        expectativas: editExpectativas,
        completo: true,
      };

      if (data?.id && !creating) {
        // Update
        await (supabase as any)
          .from("portal_questionario")
          .update(payload)
          .eq("id", data.id);
      } else {
        // Insert
        await (supabase as any)
          .from("portal_questionario")
          .insert(payload);
      }

      // Reload
      const { data: q } = await (supabase as any)
        .from("portal_questionario")
        .select("*")
        .eq("paciente_id", pacienteId)
        .eq("completo", true)
        .maybeSingle();
      setData(q);
      setEditing(false);
      setCreating(false);
      toast.success("Questionário guardado com sucesso");
    } catch {
      toast.error("Erro ao guardar questionário");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FieldDef) => {
    const isEditing = editing || creating;
    const value = allData[field.key];

    if (!isEditing) {
      return (
        <div key={field.key}>
          <p className="text-xs text-muted-foreground">{field.label}</p>
          <p className="text-sm font-medium">{formatValue(value)}</p>
        </div>
      );
    }

    const onChange = (v: any) => setEditValues(prev => ({ ...prev, [field.key]: v }));

    if (field.type === "boolean") {
      return (
        <div key={field.key}>
          <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
          <Select value={value === true ? "sim" : value === false ? "nao" : ""} onValueChange={v => onChange(v === "sim")}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "select" && field.options) {
      return (
        <div key={field.key}>
          <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
          <Select value={String(value || "")} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key} className="col-span-full">
          <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
          <Textarea className="text-sm min-h-[60px]" value={String(value || "")} onChange={e => onChange(e.target.value)} />
        </div>
      );
    }

    return (
      <div key={field.key}>
        <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
        <Input className="h-8 text-sm" value={String(value || "")} onChange={e => onChange(e.target.value)} />
      </div>
    );
  };

  return (
    <Card className="border-blue-200 bg-blue-50/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-5 w-5 text-blue-600" />
          <CardTitle className="font-display text-lg text-blue-900">
            {creating ? "Preencher Questionário de Saúde" : "Resumo de Saúde"}
          </CardTitle>
          {!creating && !editing && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
              Preenchido pelo utente
            </Badge>
          )}
          <div className="ml-auto flex gap-1">
            {(editing || creating) ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>
        {!editing && !creating && (
          <p className="text-xs text-blue-600/70 mt-1">
            Informações fornecidas pelo paciente/responsável no portal
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile selector for manual creation when no birth date */}
        {creating && !detectProfile(birthDate) && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">Selecione o perfil:</p>
            <Select value={selectedProfile || "adult"} onValueChange={v => { setSelectedProfile(v); setEditValues({}); }}>
              <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baby">Bebé (0-2 anos)</SelectItem>
                <SelectItem value="child">Criança (2-12 anos)</SelectItem>
                <SelectItem value="adult">Adulto (12-65 anos)</SelectItem>
                <SelectItem value="elderly">Idoso (65+ anos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(renderField)}
        </div>

        {/* Expectativas */}
        {(editing || creating) ? (
          <div className="border-t border-blue-200 pt-3 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">O que espera alcançar</p>
              <Textarea className="text-sm min-h-[50px]" value={editExpectativas.expectations || ""} onChange={e => setEditExpectativas(p => ({ ...p, expectations: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preocupações</p>
              <Textarea className="text-sm min-h-[50px]" value={editExpectativas.concerns || ""} onChange={e => setEditExpectativas(p => ({ ...p, concerns: e.target.value }))} />
            </div>
          </div>
        ) : (
          (expectativas.expectations || expectativas.concerns) && (
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
          )
        )}
      </CardContent>
    </Card>
  );
}
