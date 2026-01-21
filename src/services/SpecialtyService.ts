// SpecialtyService - Manages specialty templates for dynamic clinical forms
import { supabase } from "@/integrations/supabase/client";

// Types for the JSON schema structure
export interface FieldSchema {
  key: string;
  label: string;
  type: "select" | "range" | "tags" | "multiselect" | "text" | "textarea";
  options?: string[];
  min?: number;
  max?: number;
}

export interface SectionSchema {
  section: string;
  fields: FieldSchema[];
}

export interface SpecialtyTemplate {
  id: string;
  clinic_id: string | null;
  name: string;
  description: string | null;
  schema: SectionSchema[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StructuredData = Record<string, string | number | string[] | null>;

export class SpecialtyService {
  /**
   * Fetches all active specialty templates available to the user
   * (global templates + clinic-specific templates)
   */
  static async getTemplates(): Promise<SpecialtyTemplate[]> {
    const { data, error } = await supabase
      .from("specialty_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching specialty templates:", error);
      throw new Error("Erro ao carregar especialidades");
    }

    // Parse the schema JSON for each template
    return (data || []).map((t) => ({
      ...t,
      schema: this.parseSchema(t.schema),
    }));
  }

  /**
   * Fetches a single template by ID
   */
  static async getTemplateById(id: string): Promise<SpecialtyTemplate | null> {
    const { data, error } = await supabase
      .from("specialty_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      console.error("Error fetching specialty template:", error);
      throw new Error("Erro ao carregar especialidade");
    }

    return data
      ? {
          ...data,
          schema: this.parseSchema(data.schema),
        }
      : null;
  }

  /**
   * Parse schema from JSONB (handles both string and object formats)
   */
  private static parseSchema(schema: unknown): SectionSchema[] {
    if (!schema) return [];
    if (typeof schema === "string") {
      try {
        return JSON.parse(schema);
      } catch {
        return [];
      }
    }
    return schema as SectionSchema[];
  }

  /**
   * Validates structured data against a schema
   */
  static validateStructuredData(
    schema: SectionSchema[],
    data: StructuredData
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    schema.forEach((section) => {
      section.fields.forEach((field) => {
        const value = data[field.key];
        
        // Range validation
        if (field.type === "range" && value !== undefined && value !== null) {
          const numValue = Number(value);
          if (field.min !== undefined && numValue < field.min) {
            errors.push(`${field.label} deve ser no mínimo ${field.min}`);
          }
          if (field.max !== undefined && numValue > field.max) {
            errors.push(`${field.label} deve ser no máximo ${field.max}`);
          }
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Creates a default empty structured data object from a schema
   */
  static createEmptyStructuredData(schema: SectionSchema[]): StructuredData {
    const data: StructuredData = {};

    schema.forEach((section) => {
      section.fields.forEach((field) => {
        switch (field.type) {
          case "range":
            data[field.key] = field.min ?? 0;
            break;
          case "multiselect":
          case "tags":
            data[field.key] = [];
            break;
          case "select":
            data[field.key] = null;
            break;
          default:
            data[field.key] = "";
        }
      });
    });

    return data;
  }

  /**
   * Formats structured data for display (human-readable)
   */
  static formatStructuredDataForDisplay(
    schema: SectionSchema[],
    data: StructuredData
  ): { section: string; items: { label: string; value: string }[] }[] {
    return schema.map((section) => ({
      section: section.section,
      items: section.fields
        .map((field) => {
          const rawValue = data[field.key];
          let displayValue: string;

          if (rawValue === null || rawValue === undefined || rawValue === "") {
            displayValue = "Não informado";
          } else if (Array.isArray(rawValue)) {
            displayValue = rawValue.length > 0 ? rawValue.join(", ") : "Nenhum";
          } else if (field.type === "range") {
            displayValue = `${rawValue}/${field.max ?? 10}`;
          } else {
            displayValue = String(rawValue);
          }

          return {
            label: field.label,
            value: displayValue,
          };
        })
        .filter((item) => item.value !== "Não informado"),
    })).filter((section) => section.items.length > 0);
  }
}
