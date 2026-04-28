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
   * Map a legacy `perfil_tipo` (baby/child/adult/elderly) — or already a
   * template identifier (template_baby_complete/template_child/...) — to a
   * canonical template identifier. Accepts both formats so older records keep
   * resolving to the same template after upgrades.
   */
  static identifierForPerfil(perfilTipo?: string | null): string {
    const raw = (perfilTipo || "").toLowerCase().trim();
    if (!raw) return "template_adult";
    // Already a template identifier — return as-is
    if (raw.startsWith("template_")) return raw;
    switch (raw) {
      case "baby":
      case "bebe":
      case "bebé":
        return "template_baby_complete";
      case "child":
      case "crianca":
      case "criança":
        return "template_child";
      case "elderly":
      case "idoso":
      case "senior":
        return "template_elderly";
      case "adult":
      case "adulto":
      default:
        return "template_adult";
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
   * Resolve the best template for a patient, treating any questionnaire that
   * the patient has already started as the source of truth so the model never
   * silently switches mid-fill.
   *
   * Priority:
   *   1) `portal_questionario.template_id` if it exists.
   *   2) `portal_questionario.perfil_tipo` mapped to a system identifier
   *      (handles both legacy values like 'baby' and already-canonical
   *      identifiers like 'template_baby_complete').
   *   3) Most recent invite's `template_id` — only when no questionnaire row
   *      yet exists for this patient.
   *   4) Caller-provided `perfilTipo` / age as last resort.
   */
  static async resolveForPatient(params: {
    pacienteId: string;
    perfilTipo?: string | null;
    birthDate?: string | null;
  }): Promise<QuestionnaireTemplate | null> {
    const { pacienteId, perfilTipo, birthDate } = params;

    // 1+2) Existing questionnaire wins — by template_id, otherwise by perfil_tipo.
    // EXCEPTION: if the questionnaire is still empty (no answers in any of the
    // legacy or dynamic buckets), a newer invite is allowed to set a different
    // template, so a clinician resending a different model actually takes effect.
    const { data: q } = await (supabase as any)
      .from("portal_questionario")
      .select("id, template_id, perfil_tipo, respostas, updated_at, created_at")
      .eq("paciente_id", pacienteId)
      .maybeSingle();

    // Only count *clinical* answers (the dynamic `respostas` bucket).
    // Legacy `dados_pessoais` / `perfil_saude` / `expectativas` are identification
    // buckets populated by onboarding flows — they must NOT lock the template,
    // otherwise a clinician can never correct a wrong model by resending the invite.
    const hasClinicalAnswers = (() => {
      const r = q?.respostas;
      if (!r || typeof r !== "object" || Array.isArray(r)) return false;
      // Shape: { sectionId: { fieldKey: value } }
      return Object.values(r as Record<string, any>).some((section) => {
        if (!section || typeof section !== "object") return false;
        return Object.values(section as Record<string, any>).some((v) => {
          if (v === null || v === undefined || v === "") return false;
          if (Array.isArray(v)) return v.length > 0;
          return true;
        });
      });
    })();

    // Most recent invite with template_id
    const { data: inv } = await (supabase as any)
      .from("portal_convites")
      .select("template_id, created_at")
      .eq("paciente_id", pacienteId)
      .not("template_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Best-effort sync: persist the resolved template back onto the questionnaire
    // so subsequent reads are stable and the badge in the portal matches what the
    // patient is actually filling. Never throws — UI always gets the right template.
    const syncResolvedTemplate = async (tpl: QuestionnaireTemplate) => {
      try {
        if (!q?.id) return;
        if (q.template_id === tpl.id && q.perfil_tipo === tpl.identifier) return;
        await (supabase as any)
          .from("portal_questionario")
          .update({ template_id: tpl.id, perfil_tipo: tpl.identifier })
          .eq("id", q.id);
      } catch {
        // ignore
      }
    };

    // Override rule: a clinician-issued invite that is NEWER than the
    // questionnaire's last update wins, as long as the patient hasn't filled any
    // clinical answers yet. Lets professionals fix a wrong model by reissuing
    // the invite with the right template.
    if (q && inv?.template_id && !hasClinicalAnswers) {
      const inviteIsNewer = inv.created_at && q.updated_at
        ? new Date(inv.created_at).getTime() > new Date(q.updated_at).getTime()
        : true;
      const inviteTemplateDiffers = inv.template_id !== q.template_id;
      if (inviteIsNewer || inviteTemplateDiffers) {
        const t = await this.getById(inv.template_id);
        if (t) {
          await syncResolvedTemplate(t);
          return t;
        }
      }
    }

    if (q?.template_id) {
      const t = await this.getById(q.template_id);
      if (t) return t;
    }
    if (q?.perfil_tipo) {
      const identifier = this.identifierForPerfil(q.perfil_tipo);
      const t = await this.getByIdentifier(identifier);
      if (t) {
        await syncResolvedTemplate(t);
        return t;
      }
    }

    if (!q && inv?.template_id) {
      const t = await this.getById(inv.template_id);
      if (t) return t;
    }

    // Last resort: caller-provided perfil_tipo / age
    const fallbackIdentifier = perfilTipo
      ? this.identifierForPerfil(perfilTipo)
      : this.suggestIdentifierByAge(birthDate);
    return await this.getByIdentifier(fallbackIdentifier);
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
