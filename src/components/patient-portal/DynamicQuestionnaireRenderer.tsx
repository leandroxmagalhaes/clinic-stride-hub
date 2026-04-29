import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Bookmark, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  QuestionnaireTemplate,
  TemplateField,
} from "@/services/QuestionnaireTemplateService";

interface Props {
  template: QuestionnaireTemplate;
  pacienteId?: string | null;
  initialAnswers?: Record<string, Record<string, any>>;
  inviteToken?: string | null;
  saving?: boolean;
  onSubmit: (answers: Record<string, Record<string, any>>) => void;
  onExit?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function DynamicQuestionnaireRenderer({ template, pacienteId, initialAnswers, inviteToken, saving, onSubmit, onExit }: Props) {
  const [answers, setAnswers] = useState<Record<string, Record<string, any>>>(initialAnswers || {});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const dirtyRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const guidanceSections = useMemo(
    () => template.schema.sections.filter((section) => (section.fields?.length || 0) === 0 && (section.intro || section.description)),
    [template.schema.sections]
  );

  const questionSections = useMemo(
    () => template.schema.sections.filter((section) => (section.fields?.length || 0) > 0),
    [template.schema.sections]
  );

  const setVal = (sectionId: string, key: string, value: any) => {
    dirtyRef.current = true;
    setAnswers((prev) => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [key]: value } }));
  };

  // Flush helper — used by debounce, exit button, and background/pagehide events
  const flushSave = async () => {
    if (!pacienteId) return;
    const current = answersRef.current;
    if (!current || Object.keys(current).length === 0) return;
    setSaveStatus("saving");
    try {
      const { error } = await (supabase as any).rpc("upsert_portal_questionnaire", {
        p_paciente_id: pacienteId,
        p_template_id: template.id,
        p_perfil_tipo: template.identifier,
        p_respostas: current,
        p_completo: false,
        p_link_token: inviteToken || localStorage.getItem("portal_invite_token") || null,
      });
      if (error) throw error;
      setLastSaved(new Date());
      setSaveStatus("saved");
      dirtyRef.current = false;
    } catch (err) {
      console.error("Erro ao guardar progresso:", err);
      setSaveStatus("error");
    }
  };

  // Autosave with 1500ms debounce — only when there is a paciente_id and dirty changes
  useEffect(() => {
    if (!pacienteId || !dirtyRef.current) return;
    if (Object.keys(answers).length === 0) return;
    const timer = setTimeout(() => { void flushSave(); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, pacienteId, template.id, template.identifier]);

  // Flush on tab background / page hide — protects against mobile browsers killing the tab
  useEffect(() => {
    if (!pacienteId) return;
    const onHide = () => {
      if (dirtyRef.current) void flushSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void flushSave();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, template.id, template.identifier]);

  // Progress: only question sections count; guidance-only sections must not block completion.
  const { filledSections, totalSections, percent, currentSectionIdx } = useMemo(() => {
    const total = questionSections.length;
    let filled = 0;
    let firstUnfilled = total;
    questionSections.forEach((section, idx) => {
      const sectionAns = answers[section.id] || {};
      const hasAny = Object.values(sectionAns).some(
        (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
      );
      if (hasAny) {
        filled++;
      } else if (firstUnfilled === total) {
        firstUnfilled = idx;
      }
    });
    return {
      filledSections: filled,
      totalSections: total,
      percent: total > 0 ? Math.round((filled / total) * 100) : 0,
      currentSectionIdx: total > 0 ? Math.min(firstUnfilled + 1, total) : 0,
    };
  }, [answers, questionSections]);

  const validate = (): boolean => {
    for (const section of questionSections) {
      for (const field of section.fields) {
        if (field.required) {
          const v = answers[section.id]?.[field.key];
          if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
            toast.error(`Campo obrigatório: ${field.label} (${section.title})`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleExit = async () => {
    if (pacienteId && dirtyRef.current) {
      await flushSave();
    }
    toast.success("Progresso guardado. Pode voltar a qualquer momento usando o link do portal.");
    onExit?.();
  };

  const renderField = (sectionId: string, field: TemplateField) => {
    const value = answers[sectionId]?.[field.key];
    switch (field.type) {
      case "text":
        return <Input value={value || ""} onChange={(e) => setVal(sectionId, field.key, e.target.value)} placeholder={field.placeholder} />;
      case "textarea":
        return <Textarea rows={3} value={value || ""} onChange={(e) => setVal(sectionId, field.key, e.target.value)} placeholder={field.placeholder} />;
      case "date":
        return <Input type="date" value={value || ""} onChange={(e) => setVal(sectionId, field.key, e.target.value)} />;
      case "select":
        return (
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setVal(sectionId, field.key, opt)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  value === opt
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case "multiselect": {
        const arr: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((opt) => {
              const selected = arr.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = selected ? arr.filter((x) => x !== opt) : [...arr, opt];
                    setVal(sectionId, field.key, next);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    selected
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }
      case "slider": {
        const min = field.min ?? 0;
        const max = field.max ?? 10;
        const v = typeof value === "number" ? value : min;
        return (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor: <strong>{v}</strong></p>
            <Slider min={min} max={max} step={1} value={[v]} onValueChange={([nv]) => setVal(sectionId, field.key, nv)} />
          </div>
        );
      }
      case "checkbox":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!value} onCheckedChange={(c) => setVal(sectionId, field.key, !!c)} />
            <span className="text-sm">{field.label}</span>
          </label>
        );
      default:
        return null;
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {guidanceSections.map((section) => (
        <Card key={section.id} className="border-t-4 border-t-primary">
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-2xl font-semibold tracking-normal text-foreground">{section.title}</h2>
            {section.intro && (
              <p className="text-base leading-relaxed text-foreground whitespace-pre-line">
                {section.intro}
              </p>
            )}
            {section.description && (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {section.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Top bar: progress + autosave indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Secção <strong className="text-foreground">{currentSectionIdx}</strong> de {totalSections}
            <span className="ml-2">· {percent}%</span>
          </p>
          <div className="text-[11px] flex items-center gap-1 min-h-[16px]">
            {saveStatus === "saving" && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Save className="h-3 w-3 animate-pulse" /> A guardar…
              </span>
            )}
            {saveStatus === "saved" && lastSaved && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Guardado às {formatTime(lastSaved)}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Erro ao guardar
              </span>
            )}
          </div>
        </div>
        <Progress value={percent} className="h-1" />
      </div>

      {questionSections.map((section) => (
        <Card key={section.id}>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">{section.title}</h3>
              {section.description && (
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.description}
                </p>
              )}
              {section.intro && (
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line pt-1 border-l-2 border-primary/30 pl-3">
                  {section.intro}
                </p>
              )}
            </div>
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                {field.type !== "checkbox" && (
                  <label className="text-xs font-medium block">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </label>
                )}
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
                    {field.helpText}
                  </p>
                )}
                {renderField(section.id, field)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
        {onExit ? (
          <Button variant="ghost" onClick={handleExit} className="gap-1.5 sm:order-1">
            <Bookmark className="h-4 w-4" /> Sair e continuar depois
          </Button>
        ) : <span />}
        <Button onClick={() => { if (validate()) onSubmit(answers); }} disabled={saving} className="sm:order-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Concluir
        </Button>
      </div>
    </div>
  );
}
