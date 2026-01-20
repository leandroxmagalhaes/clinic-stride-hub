// PatientService - Business logic for patient operations (SRP)
import { DEMO_CLINIC_ID } from "@/lib/mock-data";
import { HealthTag } from "@/services/HealthTagService";

export interface Patient {
  id: string;
  clinic_id: string;
  full_name: string;
  cpf?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  health_insurance?: string | null;
  notes?: string | null;
  health_tags?: HealthTag[];
  is_active: boolean;
}

export interface CreatePatientData {
  full_name: string;
  phone?: string;
  birth_date?: string;
  cpf?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  health_insurance?: string;
  notes?: string;
  gender?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class PatientService {
  // Validate patient data before creation
  static validate(data: CreatePatientData): ValidationResult {
    if (!data.full_name || data.full_name.trim().length < 3) {
      return { isValid: false, error: "Nome deve ter pelo menos 3 caracteres" };
    }

    if (!data.phone || data.phone.trim().length < 10) {
      return { isValid: false, error: "Telefone inválido" };
    }

    return { isValid: true };
  }

  // Create a new patient
  static create(data: CreatePatientData): Patient {
    const validation = this.validate(data);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    return {
      id: `pac-${Date.now()}`,
      clinic_id: DEMO_CLINIC_ID,
      full_name: data.full_name.trim(),
      cpf: data.cpf || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      emergency_contact: data.emergency_contact || null,
      emergency_phone: data.emergency_phone || null,
      health_insurance: data.health_insurance || null,
      notes: data.notes || null,
      is_active: true,
    };
  }

  // Filter patients by search term
  static filterBySearch(patients: Patient[], searchTerm: string): Patient[] {
    if (!searchTerm.trim()) return patients;
    
    const term = searchTerm.toLowerCase();
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term)
    );
  }

  // Get active patients only
  static getActive(patients: Patient[]): Patient[] {
    return patients.filter((p) => p.is_active);
  }
}
