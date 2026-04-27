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
  /** Long explanatory text shown under the field label (legacy Google Forms parity). */
  helpText?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  /** Long-form intro paragraph shown at the top of the section, in addition to `description`. */
  intro?: string;
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

  /**
   * Map a legacy `perfil_tipo` (baby/child/adult/elderly) to a template identifier.
   */
  static identifierForPerfil(perfilTipo?: string | null): string {
    switch ((perfilTipo || "").toLowerCase()) {
      case "baby": return "template_baby_complete";
      case "child": return "template_child";
      case "elderly": return "template_elderly";
      default: return "template_adult";
    }
  }

  /**
   * Lookup an active template by its `identifier` (system or clinic-scoped).
   */
  static async getByIdentifier(identifier: string): Promise<QuestionnaireTemplate | null> {
    const { data, error } = await (supabase as any)
      .from("portal_questionario_templates")
      .select("*")
      .eq("identifier", identifier)
      .eq("is_active", true)
      .order("is_system", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      schema: typeof data.schema === "string" ? JSON.parse(data.schema) : data.schema,
    };
  }

  /**
   * Resolve the best template for a patient: prefers the questionnaire's own
   * template_id, then the most recent invite with template_id, then a fallback
   * by perfil_tipo / birth_date.
   */
  static async resolveForPatient(params: {
    pacienteId: string;
    perfilTipo?: string | null;
    birthDate?: string | null;
  }): Promise<QuestionnaireTemplate | null> {
    const { pacienteId, perfilTipo, birthDate } = params;
    // 1) Existing questionnaire template
    const { data: q } = await (supabase as any)
      .from("portal_questionario")
      .select("template_id")
      .eq("paciente_id", pacienteId)
      .maybeSingle();
    if (q?.template_id) {
      const t = await this.getById(q.template_id);
      if (t) return t;
    }
    // 2) Most recent invite with template_id
    const { data: inv } = await (supabase as any)
      .from("portal_convites")
      .select("template_id")
      .eq("paciente_id", pacienteId)
      .not("template_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inv?.template_id) {
      const t = await this.getById(inv.template_id);
      if (t) return t;
    }
    // 3) Fallback by perfil_tipo / age
    const identifier = perfilTipo
      ? this.identifierForPerfil(perfilTipo)
      : this.suggestIdentifierByAge(birthDate);
    return await this.getByIdentifier(identifier);
  }
}

/**
 * Best-effort merge of legacy `dados_pessoais` / `perfil_saude` / `expectativas`
 * fields into the dynamic `respostas` shape ({ sectionId: { fieldKey: value }})
 * for a given template. Existing dynamic answers always win — legacy fields
 * only fill gaps, never overwrite explicit responses.
 */
export function mergeLegacyIntoRespostas(params: {
  template: QuestionnaireTemplate;
  respostas: Record<string, Record<string, any>> | null | undefined;
  legacy: {
    dados_pessoais?: Record<string, any> | null;
    perfil_saude?: Record<string, any> | null;
    expectativas?: Record<string, any> | null;
  };
}): Record<string, Record<string, any>> {
  const { template, respostas, legacy } = params;
  const merged: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(respostas || {}));
  const legacyAll: Record<string, any> = {
    ...(legacy.dados_pessoais || {}),
    ...(legacy.perfil_saude || {}),
    ...(legacy.expectativas || {}),
  };
  if (Object.keys(legacyAll).length === 0) return merged;
  // Build flat key index from template
  for (const section of template.schema.sections) {
    for (const field of section.fields) {
      const sectionAns = merged[section.id] || {};
      if (sectionAns[field.key] !== undefined && sectionAns[field.key] !== "" && sectionAns[field.key] !== null) {
        continue; // do not overwrite
      }
      if (legacyAll[field.key] !== undefined && legacyAll[field.key] !== null && legacyAll[field.key] !== "") {
        sectionAns[field.key] = legacyAll[field.key];
        merged[section.id] = sectionAns;
      }
    }
  }
  return merged;
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
