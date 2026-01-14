// ProfessionalService - Business logic for professional operations (SRP)

import { DEMO_CLINIC_ID } from "@/lib/mock-data";

export interface Professional {
  id: string;
  clinic_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  specialty: string | null;
  crefito: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface CreateProfessionalData {
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  specialty?: string;
  crefito?: string;
}

export class ProfessionalService {
  /**
   * Validate professional data before creation
   */
  static validate(data: CreateProfessionalData): void {
    if (!data.full_name?.trim()) {
      throw new Error("Nome é obrigatório");
    }

    if (!data.email?.trim()) {
      throw new Error("Email é obrigatório");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Email inválido");
    }
  }

  /**
   * Check if email already exists
   */
  static checkEmailConflict(email: string, professionals: Professional[]): void {
    const exists = professionals.some(
      (p) => p.email?.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      throw new Error("Já existe um profissional com este email");
    }
  }

  /**
   * Create a new professional
   */
  static create(
    data: CreateProfessionalData,
    existingProfessionals: Professional[]
  ): Professional {
    // Validate
    this.validate(data);
    this.checkEmailConflict(data.email, existingProfessionals);

    // Generate unique ID
    const id = `prof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      clinic_id: DEMO_CLINIC_ID,
      full_name: data.full_name.trim(),
      email: data.email.trim(),
      phone: data.phone?.trim() || null,
      role: data.role,
      specialty: data.specialty?.trim() || null,
      crefito: data.crefito?.trim() || null,
      avatar_url: null,
      is_active: true,
    };
  }

  /**
   * Filter professionals by search term
   */
  static filter(professionals: Professional[], searchTerm: string): Professional[] {
    if (!searchTerm.trim()) return professionals;

    const term = searchTerm.toLowerCase();
    return professionals.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.specialty?.toLowerCase().includes(term)
    );
  }
}
