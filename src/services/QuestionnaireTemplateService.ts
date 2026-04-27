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
