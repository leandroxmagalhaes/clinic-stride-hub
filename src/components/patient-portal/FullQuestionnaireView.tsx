import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Pencil, Save, X, History, ChevronDown, ChevronUp, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  QuestionnaireTemplateService,
  logQuestionnaireChanges,
  buildTemplateLabelMap,
  mergeLegacyIntoRespostas,
  type QuestionnaireTemplate,
  type TemplateField,
} from "@/services/QuestionnaireTemplateService";

interface Props {
  pacienteId: string;
  /** Pretty name of the user editing — appended with " (utente)" or " (profissional)". */
  alteradoPor: string;
  /** Append this suffix to attribution. */
  authorRole: "utente" | "profissional";
  /** When false, only renders read-only with no edit button. */
  canEdit: boolean;
  /** Optional title override. Defaults to "Questionário de Saúde". */
  title?: string;
  /** Open the form already in edit mode (used by the patient portal when the questionnaire is incomplete). */
  startInEditMode?: boolean;
  /** Notified when the `completo` flag of the questionnaire changes (after Concluir). */
  onCompletedChange?: (completo: boolean) => void;
}

interface HistoryEntry {
  id: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  alterado_por: string;
  created_at: string;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  return String(val);
}

function isEmptyValue(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

/** Cycle palette for section side bands. Sections are coloured by index in order. */
const SECTION_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#f59e0b", "#ec4899",
  "#d946ef", "#a855f7", "#8b5cf6", "#f97316", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#ef4444",
];

/** Field-key → tag map. Tags appear inline next to the answer in read mode. */
type TagStyle = { label: string; bg: string; color: string };
const ORANGE: TagStyle = { label: "Atenção", bg: "#ffedd5", color: "#c2410c" };
const MEDICATION: TagStyle = { label: "Medicação", bg: "#ffedd5", color: "#c2410c" };
const YELLOW: TagStyle = { label: "Diagnóstico", bg: "#fef3c7", color: "#92400e" };
const BLUE_MAIN: TagStyle = { label: "Principal", bg: "#dbeafe", color: "#1e40af" };
const BLUE_OBJ: TagStyle = { label: "Objectivo", bg: "#dbeafe", color: "#1e40af" };
const BLUE_CONCERN: TagStyle = { label: "Preocupação", bg: "#dbeafe", color: "#1e40af" };

function getFieldTag(fieldKey: string): TagStyle | null {
  const k = fieldKey.toLowerCase();
  if (k.includes("medicac") || k.includes("medication")) return MEDICATION;
  if (k.includes("alerg") || k.includes("allerg")) return ORANGE;
  if (k.includes("cronic") || k.includes("chronic") || k.includes("hipertens")) return ORANGE;
  if (k.includes("diagnost")) return YELLOW;
  if (k === "reason" || k.includes("queixa") || k.includes("motivo")) return BLUE_MAIN;
  if (k.includes("expect") || k === "objective" || k.includes("objectiv")) return BLUE_OBJ;
  if (k.includes("concern") || k.includes("preocup")) return BLUE_CONCERN;
  return null;
}

function ChangeHistorySection({ pacienteId, labelMap }: { pacienteId: string; labelMap: Record<string, string> }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("portal_questionario_historico")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory(data || []);
    setLoading(false);
  };

  return (
    <Collapsible open={open} onOpenChange={(o) => { setOpen(o); if (o) loadHistory(); }}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <History className="h-3.5 w-3.5" />
          Ver histórico de alterações
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Sem alterações registadas.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="bg-muted/30 rounded-lg p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{labelMap[h.campo_alterado] || h.campo_alterado}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(h.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="line-through text-destructive">{h.valor_anterior || "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-600 font-medium">{h.valor_novo || "—"}</span>
                </div>
                <p className="text-muted-foreground">por {h.alterado_por}</p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FullQuestionnaireView({
  pacienteId,
  alteradoPor,
  authorRole,
  canEdit,
  title,
  startInEditMode,
  onCompletedChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [questionario, setQuestionario] = useState<any>(null);
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, Record<string, any>>>({});
  const [patientRecord, setPatientRecord] = useState<any>(null);

  /**
   * Map DB gender ('M'/'F'/'O') to template option labels ('Masculino'/'Feminino'/'Outro').
   * Returns null if the DB value can't be mapped — caller skips autofill in that case.
   */
  const mapGenderToOption = (g?: string | null): string | null => {
    if (!g) return null;
    const v = String(g).trim().toUpperCase();
    if (v === "M" || v === "MASCULINO") return "Masculino";
    if (v === "F" || v === "FEMININO") return "Feminino";
    if (v === "O" || v === "OUTRO") return "Outro";
    return null;
  };

  /**
   * Per-template autofill map: section_id → { field_key → patient_value }.
   * Only fields that exist in the actual template schemas (verified against DB).
   * Caller applies these ONLY to empty fields — never overwrites existing answers.
   */
  const buildAutofillMap = (
    identifier: string | undefined,
    p: any
  ): Record<string, Record<string, any>> => {
    if (!identifier || !p) return {};
    const nif = p.billing_nif || p.cpf || null;
    const gender = mapGenderToOption(p.gender);
    // Try to split address "Street, Locality, Postal Code" if billing_address JSONB is missing
    const billing = p.billing_address && typeof p.billing_address === "object" ? p.billing_address : {};

    switch (identifier) {
      case "template_adult":
        return {
          identification: {
            full_name: p.full_name,
            birth_date: p.birth_date,
            gender,
            phone: p.phone,
            email: p.email,
            nif,
            address: billing.street || p.address,
            locality: billing.locality || billing.city,
            postal_code: billing.postal_code,
          },
        };
      case "template_child":
        return {
          identification: {
            full_name: p.full_name,
            birth_date: p.birth_date,
            gender,
            address: billing.street || p.address,
            locality: billing.locality || billing.city,
            postal_code: billing.postal_code,
            guardian_name: p.emergency_contact,
            guardian_phone: p.emergency_phone || p.phone,
            guardian_email: p.email,
            guardian_nif: nif,
          },
        };
      case "template_elderly":
        return {
          identification: {
            full_name: p.full_name,
            birth_date: p.birth_date,
            gender,
            phone: p.phone,
            email: p.email,
            nif,
            address: billing.street || p.address,
            locality: billing.locality || billing.city,
            postal_code: billing.postal_code,
            caregiver_name: p.emergency_contact,
            caregiver_phone: p.emergency_phone,
          },
        };
      case "template_baby_complete":
        return {
          identificacao_menor: {
            nome_completo: p.full_name,
            data_nascimento: p.birth_date,
            sexo: gender,
            morada: billing.street || p.address,
            localidade: billing.locality || billing.city,
            codigo_postal: billing.postal_code,
          },
          filiacao: {
            filiacao_telemovel: p.emergency_phone || p.phone,
            filiacao_email: p.email,
            responsavel_financeiro_nome: p.billing_name || p.emergency_contact,
            responsavel_financeiro_nif: nif,
          },
        };
      default:
        return {};
    }
  };

  /**
   * Merge patient autofill into `answers`, ONLY filling empty/missing fields.
   * Never overwrites values already present (filled by patient or professional).
   * Returns a new object — does not mutate the input.
   */
  const applyPatientAutofill = (
    answers: Record<string, Record<string, any>>,
    identifier: string | undefined,
    p: any
  ): Record<string, Record<string, any>> => {
    const autofill = buildAutofillMap(identifier, p);
    if (Object.keys(autofill).length === 0) return answers;
    const next: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(answers || {}));
    for (const [sectionId, fields] of Object.entries(autofill)) {
      const existing = next[sectionId] || {};
      for (const [key, value] of Object.entries(fields)) {
        if (value === null || value === undefined || value === "") continue;
        const cur = existing[key];
        const isEmpty = cur === undefined || cur === null || cur === "" ||
          (Array.isArray(cur) && cur.length === 0);
        if (isEmpty) existing[key] = value;
      }
      next[sectionId] = existing;
    }
    return next;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data: q } = await (supabase as any)
        .from("portal_questionario")
        .select("*")
        .eq("paciente_id", pacienteId)
        .maybeSingle();

      // Pull patient fields used both for fallback resolution AND identification autofill.
      let patient: any = null;
      try {
        const { data: pat } = await (supabase as any)
          .from("pacientes")
          .select("full_name, birth_date, gender, phone, email, cpf, address, emergency_contact, emergency_phone, billing_name, billing_nif, billing_address")
          .eq("id", pacienteId)
          .maybeSingle();
        patient = pat || null;
        setPatientRecord(patient);
      } catch (e) {
        console.warn("Patient fetch failed in FullQuestionnaireView", e);
      }

      // Resolve template (questionnaire.template_id → invite → perfil/age fallback)
      let resolvedTemplate: QuestionnaireTemplate | null = null;
      try {
        resolvedTemplate = await QuestionnaireTemplateService.resolveForPatient({
          pacienteId,
          perfilTipo: q?.perfil_tipo || null,
          birthDate: patient?.birth_date || null,
        });
      } catch (e) {
        console.warn("Template resolve failed in FullQuestionnaireView", e);
      }
      setTemplate(resolvedTemplate);

      // If we have legacy answers (dados_pessoais/perfil_saude/expectativas)
      // and a resolved template, merge them into respostas so the integral view
      // shows the existing data without losing anything.
      if (q && resolvedTemplate) {
        const baseRespostas = (q.respostas && typeof q.respostas === "object") ? q.respostas : {};
        const merged = mergeLegacyIntoRespostas({
          template: resolvedTemplate,
          respostas: baseRespostas,
          legacy: {
            dados_pessoais: q.dados_pessoais || null,
            perfil_saude: q.perfil_saude || null,
            expectativas: q.expectativas || null,
          },
        });
        setQuestionario({ ...q, respostas: merged });
      } else {
        setQuestionario(q || null);
      }

      // Auto-enter edit mode if requested and the questionnaire is not yet completed.
      if (canEdit && startInEditMode && !q?.completo && resolvedTemplate) {
        const baseRespostas = (q?.respostas && typeof q.respostas === "object") ? q.respostas : {};
        const seed = q
          ? mergeLegacyIntoRespostas({
              template: resolvedTemplate,
              respostas: baseRespostas,
              legacy: {
                dados_pessoais: q.dados_pessoais || null,
                perfil_saude: q.perfil_saude || null,
                expectativas: q.expectativas || null,
              },
            })
          : {};
        const seedWithAutofill = applyPatientAutofill(seed, resolvedTemplate.identifier, patient);
        setDraft(JSON.parse(JSON.stringify(seedWithAutofill)));
        setEditing(true);
      }
    } catch (err) {
      console.error("Error loading full questionnaire:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pacienteId]);

  const respostas: Record<string, Record<string, any>> = useMemo(() => {
    const r = questionario?.respostas;
    if (!r) return {};
    return typeof r === "string" ? JSON.parse(r) : r;
  }, [questionario]);

  const labelMap = useMemo(() => buildTemplateLabelMap(template), [template]);

  const guidanceSections = useMemo(
    () => template?.schema.sections.filter((section) => (section.fields?.length || 0) === 0 && (section.intro || section.description)) || [],
    [template]
  );

  const questionSections = useMemo(
    () => template?.schema.sections.filter((section) => (section.fields?.length || 0) > 0) || [],
    [template]
  );

  const startEdit = () => {
    const seeded = applyPatientAutofill(respostas, template?.identifier, patientRecord);
    setDraft(JSON.parse(JSON.stringify(seeded)));
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft({});
    setEditing(false);
  };

  const setVal = (sectionId: string, key: string, value: any) => {
    setDraft(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), [key]: value },
    }));
  };

  /**
   * Persist `draft` into `portal_questionario`. Creates the record via upsert when it
   * does not exist yet (lets the patient start the integral form straight from the portal).
   * `markComplete=true` flags the questionnaire as concluded.
   */
  const persistDraft = async (markComplete: boolean) => {
    if (!template) {
      toast.error("Modelo de questionário indisponível.");
      return;
    }
    setSaving(true);
    try {
      let questionarioId: string | null = questionario?.id || null;

      if (questionarioId) {
        const updatePayload: Record<string, any> = {
          respostas: draft,
          updated_at: new Date().toISOString(),
        };
        if (!questionario.template_id && template.id) updatePayload.template_id = template.id;
        if (markComplete) updatePayload.completo = true;
        const { error } = await (supabase as any)
          .from("portal_questionario")
          .update(updatePayload)
          .eq("id", questionarioId);
        if (error) throw error;
      } else {
        const upsertPayload: Record<string, any> = {
          paciente_id: pacienteId,
          template_id: template.id,
          perfil_tipo: template.identifier,
          respostas: draft,
          completo: !!markComplete,
          updated_at: new Date().toISOString(),
        };
        const { data: created, error } = await (supabase as any)
          .from("portal_questionario")
          .upsert(upsertPayload, { onConflict: "paciente_id" })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        questionarioId = created?.id || null;
      }

      let changeCount = 0;
      if (questionarioId) {
        const attribution = `${alteradoPor} (${authorRole})`;
        changeCount = await logQuestionnaireChanges({
          questionarioId,
          pacienteId,
          before: respostas,
          after: draft,
          alteradoPor: attribution,
        });

        if (authorRole === "utente" && changeCount > 0) {
          await (supabase as any).from("portal_notificacoes").insert({
            paciente_id: pacienteId,
            tipo: "questionnaire_update",
            titulo: `${alteradoPor} ${markComplete ? "concluiu" : "atualizou"} o questionário de saúde`,
            texto_preview: `${changeCount} ${changeCount === 1 ? "campo alterado" : "campos alterados"}`,
            urgente: false,
          });
        }
      }

      if (markComplete) {
        toast.success("Questionário concluído!");
        onCompletedChange?.(true);
        setEditing(false);
      } else {
        toast.success(
          changeCount > 0
            ? `Progresso guardado (${changeCount} ${changeCount === 1 ? "alteração" : "alterações"})`
            : "Progresso guardado."
        );
      }
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgress = () => persistDraft(false);
  const handleConclude = () => persistDraft(true);

  if (loading) return <Skeleton className="h-48 w-full" />;

  if (!template) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o modelo de questionário para este utente.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!questionario && !editing) {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="py-6 text-center space-y-3">
          <FileText className="h-8 w-8 mx-auto text-amber-600" />
          <h3 className="font-semibold">{title || "Questionário de Saúde"}</h3>
          <p className="text-sm text-muted-foreground">
            Ainda não começou a preencher o questionário. Pode iniciar agora — o progresso é guardado automaticamente.
          </p>
          {canEdit && (
            <Button
              onClick={() => {
                const seeded = applyPatientAutofill({}, template?.identifier, patientRecord);
                setDraft(seeded);
                setEditing(true);
              }}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" /> Começar a preencher
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const lastUpdate = questionario?.updated_at
    ? new Date(questionario.updated_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const renderFieldRead = (sectionId: string, field: TemplateField) => {
    const value = respostas[sectionId]?.[field.key];
    const empty = isEmptyValue(value);
    const tag = !empty ? getFieldTag(field.key) : null;
    return (
      <div key={field.key} className="space-y-0.5">
        <p className="text-xs font-semibold text-slate-800">{field.label}</p>
        {field.helpText && (
          <p className="text-[11px] text-slate-400 italic leading-relaxed whitespace-pre-line">
            {field.helpText}
          </p>
        )}
        <div className="flex items-start gap-2 flex-wrap">
          {empty ? (
            <p className="text-sm italic text-slate-300">— não preenchido</p>
          ) : (
            <p className="text-sm font-semibold text-blue-600 whitespace-pre-line">{formatValue(value)}</p>
          )}
          {tag && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
              style={{ backgroundColor: tag.bg, color: tag.color }}
            >
              {tag.label}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderFieldEdit = (sectionId: string, field: TemplateField) => {
    const value = draft[sectionId]?.[field.key];
    const onChange = (v: any) => setVal(sectionId, field.key, v);
    let control: JSX.Element | null = null;
    switch (field.type) {
      case "text":
        control = <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
        break;
      case "textarea":
        control = <Textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
        break;
      case "date":
        control = <Input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
        break;
      case "select":
        control = (
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  value === opt
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >{opt}</button>
            ))}
          </div>
        );
        break;
      case "multiselect": {
        const arr: string[] = Array.isArray(value) ? value : [];
        control = (
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map(opt => {
              const sel = arr.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(sel ? arr.filter(x => x !== opt) : [...arr, opt])}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    sel
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >{opt}</button>
              );
            })}
          </div>
        );
        break;
      }
      case "slider": {
        const min = field.min ?? 0;
        const max = field.max ?? 10;
        const v = typeof value === "number" ? value : min;
        control = (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor: <strong>{v}</strong></p>
            <Slider min={min} max={max} step={1} value={[v]} onValueChange={([nv]) => onChange(nv)} />
          </div>
        );
        break;
      }
      case "checkbox":
        control = (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
            <span className="text-sm">{field.label}</span>
          </label>
        );
        break;
    }
    return (
      <div key={field.key} className="space-y-1.5">
        {field.type !== "checkbox" && (
          <label className="text-xs font-medium block">{field.label}</label>
        )}
        {field.helpText && (
          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
            {field.helpText}
          </p>
        )}
        {control}
      </div>
    );
  };

  // Build top-of-page alert pills from filled critical fields.
  // Read-only scan — never mutates respostas. Excluded in print via .anamnese-print-hide.
  const alertBadges: Array<{ key: string; label: string; value: string; bg: string; color: string }> = [];
  if (!editing) {
    for (const section of questionSections) {
      for (const field of section.fields) {
        const v = respostas[section.id]?.[field.key];
        if (isEmptyValue(v)) continue;
        const k = field.key.toLowerCase();
        const valStr = Array.isArray(v) ? v.join(", ") : String(v);
        if (k.includes("medicac") || k.includes("medication")) {
          alertBadges.push({ key: `${section.id}.${field.key}`, label: "Medicação", value: valStr, bg: "#ffedd5", color: "#c2410c" });
        } else if (k.includes("diagnost")) {
          alertBadges.push({ key: `${section.id}.${field.key}`, label: "Diagnóstico", value: valStr, bg: "#fef3c7", color: "#92400e" });
        } else if (k.includes("alerg") || k.includes("allerg")) {
          // Only flag as critical when the answer is not a clear "no/none/nenhuma" response.
          const lower = valStr.toLowerCase().trim();
          const negatives = ["nao", "não", "nenhum", "nenhuma", "sem", "n/a", "na", "—", "-", "no", "none"];
          if (!negatives.includes(lower)) {
            alertBadges.push({ key: `${section.id}.${field.key}`, label: "Alergia", value: valStr, bg: "#fee2e2", color: "#b91c1c" });
          }
        }
      }
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="border-blue-200 bg-blue-50/40 anamnese-print-area">
      <CardHeader className="pb-3 anamnese-print-hide">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-5 w-5 text-blue-600" />
          <CardTitle className="font-display text-lg text-blue-900">
            {title || "Questionário de Saúde"}
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
            {template.name}
          </Badge>
          <div className="ml-auto flex flex-wrap gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveProgress} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar progresso
                </Button>
                <Button size="sm" onClick={handleConclude} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  {questionario?.completo ? "Guardar" : "Concluir"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
                </Button>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={startEdit}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {lastUpdate && !editing && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Última atualização: {lastUpdate}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert badges banner — hidden during edit and in print to keep the printout focused on content. */}
        {!editing && alertBadges.length > 0 && (
          <div className="anamnese-print-hide flex flex-wrap gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            {alertBadges.map((b) => (
              <span
                key={b.key}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: b.bg, color: b.color }}
                title={b.value}
              >
                <strong>{b.label}:</strong>
                <span className="truncate max-w-[220px]">{b.value}</span>
              </span>
            ))}
          </div>
        )}

        {guidanceSections.map((section) => (
          <div
            key={section.id}
            className="anamnese-section rounded-xl bg-white p-4 space-y-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow"
            style={{ borderLeft: "4px solid #2563eb", background: editing ? "white" : "linear-gradient(135deg, #eff6ff, #f0f9ff)" }}
          >
            <h2 className="text-lg font-bold text-blue-900">{section.title}</h2>
            {section.intro && (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {section.intro}
              </p>
            )}
            {section.description && (
              <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                {section.description}
              </p>
            )}
          </div>
        ))}

        {questionSections.map((section, idx) => {
          const bandColor = SECTION_COLORS[idx % SECTION_COLORS.length];
          return (
            <div
              key={section.id}
              className="anamnese-section rounded-xl bg-white p-4 space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow"
              style={{ borderLeft: `4px solid ${bandColor}` }}
            >
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">{section.title}</h3>
                {section.description && (
                  <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                    {section.description}
                  </p>
                )}
                {section.intro && (
                  <div className="text-xs text-slate-600 italic leading-relaxed whitespace-pre-line bg-slate-50 rounded-md px-3 py-2 mt-1">
                    {section.intro}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {section.fields.map((field) => editing
                  ? renderFieldEdit(section.id, field)
                  : renderFieldRead(section.id, field))}
              </div>
            </div>
          );
        })}

        {!editing && (
          <div className="border-t border-blue-200 pt-3 anamnese-print-hide">
            <ChangeHistorySection pacienteId={pacienteId} labelMap={labelMap} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
