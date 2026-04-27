import { supabase } from "@/integrations/supabase/client";

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "multiselect"
  | "slider"
  | "checkbox";

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  fields: TemplateField[];
}

export interface QuestionnaireTemplateSchema {
  sections: TemplateSection[];
}

export interface QuestionnaireTemplate {
  id: string;
  clinic_id: string | null;
  identifier: string;
  name: string;
  description: string | null;
  estimated_minutes: string | null;
  schema: QuestionnaireTemplateSchema;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export class QuestionnaireTemplateService {
  static async list(): Promise<QuestionnaireTemplate[]> {
    const { data, error } = await (supabase as any)
      .from("portal_questionario_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      schema: typeof t.schema === "string" ? JSON.parse(t.schema) : t.schema,
    }));
  }

  static async getById(id: string): Promise<QuestionnaireTemplate | null> {
    const { data, error } = await (supabase as any)
      .from("portal_questionario_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      schema: typeof data.schema === "string" ? JSON.parse(data.schema) : data.schema,
    };
  }

  /**
   * Suggest a template identifier based on patient age in years.
   */
  static suggestIdentifierByAge(birthDate?: string | null): string {
    if (!birthDate) return "template_adult";
    const age = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 2) return "template_baby_complete";
    if (age < 12) return "template_child";
    if (age >= 65) return "template_elderly";
    return "template_adult";
  }
}

/**
 * Build a label map (sectionId.fieldKey -> "Secção · Campo") from a template schema,
 * used to show readable labels in the change-history audit view.
 */
export function buildTemplateLabelMap(template: QuestionnaireTemplate | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!template?.schema?.sections) return map;
  for (const section of template.schema.sections) {
    for (const field of section.fields || []) {
      map[`${section.id}.${field.key}`] = `${section.title} · ${field.label}`;
    }
  }
  return map;
}

function stringify(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/**
 * Compares two `respostas` JSONB objects (section -> field -> value) and writes
 * one row per changed field into `portal_questionario_historico` (individual inserts,
 * per project convention). Used by both patient and professional edit flows.
 */
export async function logQuestionnaireChanges(params: {
  questionarioId: string;
  pacienteId: string;
  before: Record<string, Record<string, any>> | null | undefined;
  after: Record<string, Record<string, any>> | null | undefined;
  alteradoPor: string; // e.g. "Maria Silva (utente)" or "Dr. João (profissional)"
}): Promise<number> {
  const { questionarioId, pacienteId, before, after, alteradoPor } = params;
  const beforeObj = before || {};
  const afterObj = after || {};
  const sectionIds = new Set<string>([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  let changes = 0;
  for (const sectionId of sectionIds) {
    const sBefore = (beforeObj as any)[sectionId] || {};
    const sAfter = (afterObj as any)[sectionId] || {};
    const fieldKeys = new Set<string>([...Object.keys(sBefore), ...Object.keys(sAfter)]);
    for (const key of fieldKeys) {
      const oldVal = stringify(sBefore[key]);
      const newVal = stringify(sAfter[key]);
      if (oldVal === newVal) continue;
      // Individual insert (project rule: never batch)
      const { error } = await (supabase as any)
        .from("portal_questionario_historico")
        .insert({
          questionario_id: questionarioId,
          paciente_id: pacienteId,
          campo_alterado: `${sectionId}.${key}`,
          valor_anterior: oldVal || null,
          valor_novo: newVal || null,
          alterado_por: alteradoPor,
        });
      if (!error) changes++;
    }
  }
  return changes;
}
