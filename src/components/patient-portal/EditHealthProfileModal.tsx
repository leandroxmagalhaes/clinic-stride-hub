import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProfileType = "baby" | "child" | "adult" | "elderly";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  patientName: string;
  perfilTipo: ProfileType;
}

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

function MultiOption({ field, options, data, setField }: { field: string; options: string[]; data: Record<string, any>; setField: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <OptionCard key={opt} label={opt} selected={data[field] === opt} onClick={() => setField(field, opt)} />
      ))}
    </div>
  );
}

function YesNoUnsure({ field, data, setField }: { field: string; data: Record<string, any>; setField: (k: string, v: any) => void }) {
  return <MultiOption field={field} options={["Sim", "Não", "Não sei"]} data={data} setField={setField} />;
}

const FIELD_LABELS: Record<string, string> = {
  gestation: "Semanas de gestação",
  deliveryType: "Tipo de parto",
  induced: "Parto induzido",
  instruments: "Instrumentos (ventosa/fórceps)",
  birthWeight: "Peso ao nascer",
  birthLength: "Comprimento ao nascer",
  breastfeeding: "Amamentação",
  reflux: "Refluxo",
  colic: "Cólicas",
  sleep: "Sono",
  bowel: "Eliminação intestinal",
  respiratoryInfections: "Infecções respiratórias",
  posturalPreference: "Preferência postural",
  vaccines: "Vacinas",
  allergies: "Alergias",
  medication: "Medicação",
  diagnosis: "Diagnóstico",
  reason: "Motivo da consulta",
  activity: "Atividade física",
  objective: "Objectivo do tratamento",
  previousInjuries: "Lesões anteriores",
  surgeries: "Cirurgias",
  chronicConditions: "Condições crónicas",
  fallHistory: "Histórico de quedas",
  walkingAid: "Auxílio de marcha",
  autonomy: "Autonomia diária",
  caregiverName: "Cuidador",
  schoolDifficulties: "Dificuldades escolares",
};

export function EditHealthProfileModal({ open, onOpenChange, pacienteId, patientName, perfilTipo }: Props) {
  const [healthData, setHealthData] = useState<Record<string, any>>({});
  const [originalData, setOriginalData] = useState<Record<string, any>>({});
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setField = (key: string, value: any) => setHealthData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: q } = await (supabase as any)
        .from("portal_questionario")
        .select("id, perfil_saude")
        .eq("paciente_id", pacienteId)
        .maybeSingle();
      const saude = q?.perfil_saude || {};
      setHealthData({ ...saude });
      setOriginalData({ ...saude });
      setQuestionnaireId(q?.id || null);
      setLoading(false);
    })();
  }, [open, pacienteId]);

  const handleSave = async () => {
    if (!questionnaireId) {
      toast.error("Questionário não encontrado.");
      return;
    }
    setSaving(true);
    try {
      // Compare field by field
      const changedFields: string[] = [];
      const allKeys = new Set([...Object.keys(originalData), ...Object.keys(healthData)]);
      for (const key of allKeys) {
        const oldVal = String(originalData[key] || "");
        const newVal = String(healthData[key] || "");
        if (oldVal !== newVal) {
          changedFields.push(key);
          await (supabase as any)
            .from("portal_questionario_historico")
            .insert({
              questionario_id: questionnaireId,
              paciente_id: pacienteId,
              campo_alterado: key,
              valor_anterior: oldVal,
              valor_novo: newVal,
              alterado_por: "Paciente",
            });
        }
      }

      // Update questionnaire
      await (supabase as any)
        .from("portal_questionario")
        .update({
          perfil_saude: healthData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionnaireId);

      // Notify professional
      if (changedFields.length > 0) {
        const labels = changedFields.map((k) => FIELD_LABELS[k] || k).join(", ");
        await (supabase as any).from("portal_notificacoes").insert({
          paciente_id: pacienteId,
          tipo: "questionnaire_update",
          titulo: `${patientName} atualizou o questionário de saúde`,
          texto_preview: `Campos alterados: ${labels}`,
          urgente: false,
        });
      }

      toast.success("Dados de saúde atualizados!");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao guardar alterações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar Dados de Saúde</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {perfilTipo === "baby" && <BabyFields data={healthData} setField={setField} />}
            {perfilTipo === "child" && <ChildFields data={healthData} setField={setField} />}
            {perfilTipo === "adult" && <AdultFields data={healthData} setField={setField} />}
            {perfilTipo === "elderly" && <ElderlyFields data={healthData} setField={setField} />}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Profile-specific field components (simplified versions of onboarding)
interface FieldsProps {
  data: Record<string, any>;
  setField: (k: string, v: any) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium block">{children}</label>;
}

function BabyFields({ data, setField }: FieldsProps) {
  return (
    <div className="space-y-3">
      <Label>Semanas de gestação: <strong>{data.gestation || 38}</strong></Label>
      <Slider min={24} max={42} step={1} value={[data.gestation || 38]} onValueChange={([v]) => setField("gestation", v)} />
      <Label>Tipo de parto</Label>
      <MultiOption field="deliveryType" options={["Normal", "Cesariana", "Não sei"]} data={data} setField={setField} />
      <Label>Parto induzido</Label>
      <YesNoUnsure field="induced" data={data} setField={setField} />
      <Label>Instrumentos</Label>
      <YesNoUnsure field="instruments" data={data} setField={setField} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Peso ao nascer" value={data.birthWeight || ""} onChange={(e) => setField("birthWeight", e.target.value)} />
        <Input placeholder="Comprimento" value={data.birthLength || ""} onChange={(e) => setField("birthLength", e.target.value)} />
      </div>
      <Label>Amamentação</Label>
      <MultiOption field="breastfeeding" options={["Leite materno exclusivo", "Misto", "Fórmula", "Já não mama"]} data={data} setField={setField} />
      <Label>Refluxo</Label>
      <MultiOption field="reflux" options={["Sim", "Não", "Às vezes", "Já passou"]} data={data} setField={setField} />
      <Label>Cólicas</Label>
      <MultiOption field="colic" options={["Sim, frequentes", "Às vezes", "Não", "Já passaram"]} data={data} setField={setField} />
      <Label>Sono</Label>
      <MultiOption field="sleep" options={["Dorme bem", "Acorda muito", "Dorme pouco", "Normal"]} data={data} setField={setField} />
      <Label>Eliminação intestinal</Label>
      <MultiOption field="bowel" options={["Normal", "Obstipação", "Diarreia"]} data={data} setField={setField} />
      <Label>Infecções respiratórias</Label>
      <YesNoUnsure field="respiratoryInfections" data={data} setField={setField} />
      <Input placeholder="Preferência postural" value={data.posturalPreference || ""} onChange={(e) => setField("posturalPreference", e.target.value)} />
      <Input placeholder="Vacinas" value={data.vaccines || ""} onChange={(e) => setField("vaccines", e.target.value)} />
      <Input placeholder="Alergias" value={data.allergies || ""} onChange={(e) => setField("allergies", e.target.value)} />
      <Input placeholder="Medicação" value={data.medication || ""} onChange={(e) => setField("medication", e.target.value)} />
      <Input placeholder="Diagnóstico" value={data.diagnosis || ""} onChange={(e) => setField("diagnosis", e.target.value)} />
    </div>
  );
}

function ChildFields({ data, setField }: FieldsProps) {
  return (
    <div className="space-y-3">
      <Textarea placeholder="Motivo da consulta" value={data.reason || ""} onChange={(e) => setField("reason", e.target.value)} />
      <Input placeholder="Atividade física" value={data.activity || ""} onChange={(e) => setField("activity", e.target.value)} />
      <Input placeholder="Dificuldades escolares" value={data.schoolDifficulties || ""} onChange={(e) => setField("schoolDifficulties", e.target.value)} />
      <Input placeholder="Cirurgias/internamentos" value={data.surgeries || ""} onChange={(e) => setField("surgeries", e.target.value)} />
      <Input placeholder="Alergias" value={data.allergies || ""} onChange={(e) => setField("allergies", e.target.value)} />
      <Input placeholder="Medicação" value={data.medication || ""} onChange={(e) => setField("medication", e.target.value)} />
      <Input placeholder="Vacinas" value={data.vaccines || ""} onChange={(e) => setField("vaccines", e.target.value)} />
      <Input placeholder="Diagnóstico" value={data.diagnosis || ""} onChange={(e) => setField("diagnosis", e.target.value)} />
    </div>
  );
}

function AdultFields({ data, setField }: FieldsProps) {
  return (
    <div className="space-y-3">
      <Textarea placeholder="Motivo da consulta" value={data.reason || ""} onChange={(e) => setField("reason", e.target.value)} />
      <Input placeholder="Atividade física" value={data.activity || ""} onChange={(e) => setField("activity", e.target.value)} />
      <Textarea placeholder="Objectivo do tratamento" value={data.objective || ""} onChange={(e) => setField("objective", e.target.value)} />
      <Input placeholder="Lesões anteriores" value={data.previousInjuries || ""} onChange={(e) => setField("previousInjuries", e.target.value)} />
      <Input placeholder="Cirurgias" value={data.surgeries || ""} onChange={(e) => setField("surgeries", e.target.value)} />
      <Input placeholder="Medicação" value={data.medication || ""} onChange={(e) => setField("medication", e.target.value)} />
      <Input placeholder="Alergias" value={data.allergies || ""} onChange={(e) => setField("allergies", e.target.value)} />
      <Input placeholder="Condições crónicas" value={data.chronicConditions || ""} onChange={(e) => setField("chronicConditions", e.target.value)} />
    </div>
  );
}

function ElderlyFields({ data, setField }: FieldsProps) {
  return (
    <div className="space-y-3">
      <Input placeholder="Condições crónicas" value={data.chronicConditions || ""} onChange={(e) => setField("chronicConditions", e.target.value)} />
      <Input placeholder="Medicação" value={data.medication || ""} onChange={(e) => setField("medication", e.target.value)} />
      <Input placeholder="Alergias" value={data.allergies || ""} onChange={(e) => setField("allergies", e.target.value)} />
      <Label>Histórico de quedas</Label>
      <YesNoUnsure field="fallHistory" data={data} setField={setField} />
      <Label>Auxílio de marcha</Label>
      <MultiOption field="walkingAid" options={["Nenhum", "Bengala", "Andarilho", "Cadeira de rodas"]} data={data} setField={setField} />
      <Label>Autonomia diária</Label>
      <MultiOption field="autonomy" options={["Independente", "Parcialmente dependente", "Dependente"]} data={data} setField={setField} />
      <Input placeholder="Cuidador" value={data.caregiverName || ""} onChange={(e) => setField("caregiverName", e.target.value)} />
    </div>
  );
}
