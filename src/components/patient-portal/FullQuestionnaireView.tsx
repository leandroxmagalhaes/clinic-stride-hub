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
import { FileText, Pencil, Save, X, History, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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

  const load = async () => {
    setLoading(true);
    try {
      const { data: q } = await (supabase as any)
        .from("portal_questionario")
        .select("*")
        .eq("paciente_id", pacienteId)
        .maybeSingle();

      // Resolve template (questionnaire.template_id → invite → perfil/age fallback)
      let resolvedTemplate: QuestionnaireTemplate | null = null;
      try {
        // Pull birth_date for fallback resolution
        const { data: pat } = await supabase
          .from("pacientes")
          .select("birth_date")
          .eq("id", pacienteId)
          .maybeSingle();

        resolvedTemplate = await QuestionnaireTemplateService.resolveForPatient({
          pacienteId,
          perfilTipo: q?.perfil_tipo || null,
          birthDate: pat?.birth_date || null,
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
        setDraft(JSON.parse(JSON.stringify(seed)));
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
    setDraft(JSON.parse(JSON.stringify(respostas)));
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

  const handleSave = async () => {
    if (!questionario?.id) {
      toast.error("Questionário não encontrado.");
      return;
    }
    setSaving(true);
    try {
      // Persist new respostas; also link template_id when missing (legacy records)
      const updatePayload: Record<string, any> = {
        respostas: draft,
        updated_at: new Date().toISOString(),
      };
      if (!questionario.template_id && template?.id) {
        updatePayload.template_id = template.id;
      }
      const { error } = await (supabase as any)
        .from("portal_questionario")
        .update(updatePayload)
        .eq("id", questionario.id);
      if (error) throw error;

      // Audit: one insert per changed field
      const attribution = `${alteradoPor} (${authorRole})`;
      const changeCount = await logQuestionnaireChanges({
        questionarioId: questionario.id,
        pacienteId,
        before: respostas,
        after: draft,
        alteradoPor: attribution,
      });

      // Notify the other side (only patient->prof; professional edits are silent)
      if (authorRole === "utente" && changeCount > 0) {
        await (supabase as any).from("portal_notificacoes").insert({
          paciente_id: pacienteId,
          tipo: "questionnaire_update",
          titulo: `${alteradoPor} atualizou o questionário de saúde`,
          texto_preview: `${changeCount} ${changeCount === 1 ? "campo alterado" : "campos alterados"}`,
          urgente: false,
        });
      }

      toast.success(changeCount > 0 ? `Guardado (${changeCount} ${changeCount === 1 ? "alteração" : "alterações"})` : "Sem alterações para guardar");
      setEditing(false);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao guardar alterações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  if (!questionario || !template) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {!template
              ? "Não foi possível carregar o modelo de questionário para este utente."
              : "O utente ainda não preencheu o questionário através do portal."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const lastUpdate = questionario?.updated_at
    ? new Date(questionario.updated_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const renderFieldRead = (sectionId: string, field: TemplateField) => {
    const value = respostas[sectionId]?.[field.key];
    return (
      <div key={field.key} className="space-y-0.5">
        <p className="text-xs text-muted-foreground">{field.label}</p>
        {field.helpText && (
          <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed whitespace-pre-line">
            {field.helpText}
          </p>
        )}
        <p className="text-sm font-medium whitespace-pre-line">{formatValue(value)}</p>
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

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-5 w-5 text-blue-600" />
          <CardTitle className="font-display text-lg text-blue-900">
            {title || "Questionário de Saúde"}
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
            {template.name}
          </Badge>
          <div className="ml-auto flex gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar
                </Button>
              </>
            ) : canEdit ? (
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
            ) : null}
          </div>
        </div>
        {lastUpdate && !editing && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Última atualização: {lastUpdate}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {guidanceSections.map((section) => (
          <div key={section.id} className="rounded-lg border-t-4 border-t-primary bg-background p-4 space-y-3">
            <h2 className="text-2xl font-semibold tracking-normal text-foreground">{section.title}</h2>
            {section.intro && (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-line">
                {section.intro}
              </p>
            )}
            {section.description && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.description}
              </p>
            )}
          </div>
        ))}

        {questionSections.map((section) => (
          <div key={section.id} className="rounded-lg border bg-background/60 p-3 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              {section.description && (
                <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.description}
                </p>
              )}
              {section.intro && (
                <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line pt-1 border-l-2 border-primary/30 pl-2">
                  {section.intro}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {section.fields.map((field) => editing
                ? renderFieldEdit(section.id, field)
                : renderFieldRead(section.id, field))}
            </div>
          </div>
        ))}

        {!editing && (
          <div className="border-t border-blue-200 pt-3">
            <ChangeHistorySection pacienteId={pacienteId} labelMap={labelMap} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
