import { z } from 'zod';

// Database row type for clinics
export interface Clinic {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  cnpj: string | null; // NIF (PT) or CNPJ (BR)
  website: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

// Form validation schema
export const clinicDataSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  address: z.string().max(500, 'Endereço muito longo').optional().or(z.literal('')),
  phone: z.string().max(20, 'Telefone muito longo').optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cnpj: z.string().max(20, 'NIF/CNPJ muito longo').optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
});

export type ClinicDataFormData = z.infer<typeof clinicDataSchema>;
