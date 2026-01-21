import { z } from 'zod';

// ============================================
// SETTINGS TYPES & VALIDATION SCHEMAS
// ============================================

// Database row type
export interface ClinicSettings {
  id: string;
  clinic_id: string;
  clinic_name: string | null;
  timezone: string;
  language: string;
  logo_url: string | null;
  primary_color: string;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Form schemas with Zod validation
export const generalSettingsSchema = z.object({
  clinic_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  timezone: z.string().min(1, 'Selecione um fuso horário'),
  language: z.enum(['pt-PT', 'pt-BR'], { 
    errorMap: () => ({ message: 'Selecione um idioma válido' }) 
  }),
});

export const appearanceSettingsSchema = z.object({
  logo_url: z.string().url('URL inválida').nullable().optional().or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hexadecimal inválida (ex: #10B981)'),
});

export const automationSettingsSchema = z.object({
  whatsapp_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  email_enabled: z.boolean(),
});

// Inferred types from schemas
export type GeneralSettingsFormData = z.infer<typeof generalSettingsSchema>;
export type AppearanceSettingsFormData = z.infer<typeof appearanceSettingsSchema>;
export type AutomationSettingsFormData = z.infer<typeof automationSettingsSchema>;

// Combined settings for API operations
export type SettingsUpdatePayload = Partial<
  GeneralSettingsFormData & 
  AppearanceSettingsFormData & 
  AutomationSettingsFormData
>;

// Available timezones
export const TIMEZONE_OPTIONS = [
  { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0/+1)' },
  { value: 'Europe/London', label: 'Londres (GMT+0/+1)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'Atlantic/Azores', label: 'Açores (GMT-1/0)' },
] as const;

// Language options
export const LANGUAGE_OPTIONS = [
  { value: 'pt-PT', label: '🇵🇹 Português (Portugal)' },
  { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
] as const;

// Preset brand colors
export const BRAND_COLOR_PRESETS = [
  { value: '#10B981', label: 'Esmeralda' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#F59E0B', label: 'Âmbar' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#06B6D4', label: 'Ciano' },
  { value: '#84CC16', label: 'Lima' },
] as const;
