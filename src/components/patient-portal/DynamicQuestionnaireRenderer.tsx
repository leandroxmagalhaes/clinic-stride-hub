import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type {
  QuestionnaireTemplate,
  TemplateField,
} from "@/services/QuestionnaireTemplateService";

interface Props {
  template: QuestionnaireTemplate;
  initialAnswers?: Record<string, Record<string, any>>;
  saving?: boolean;
  onSubmit: (answers: Record<string, Record<string, any>>) => void;
}

export function DynamicQuestionnaireRenderer({ template, initialAnswers, saving, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, Record<string, any>>>(initialAnswers || {});

  const setVal = (sectionId: string, key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [key]: value } }));
  };

  const validate = (): boolean => {
    for (const section of template.schema.sections) {
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

  return (
    <div className="space-y-4">
      {template.schema.sections.map((section) => (
        <Card key={section.id}>
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-base font-semibold">{section.title}</h3>
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                {field.type !== "checkbox" && (
                  <label className="text-xs font-medium block">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </label>
                )}
                {renderField(section.id, field)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end">
        <Button onClick={() => { if (validate()) onSubmit(answers); }} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Concluir
        </Button>
      </div>
    </div>
  );
}
