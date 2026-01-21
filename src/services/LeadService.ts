// LeadService - Business logic for CRM leads management
import { supabase } from "@/integrations/supabase/client";

export type LeadStatus = 'novo' | 'agendado' | 'proposta' | 'ganho' | 'perdido';

export interface SalesLead {
  id: string;
  clinic_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: LeadStatus;
  estimated_value: number | null;
  notes: string | null;
  converted_patient_id: string | null;
  converted_at: string | null;
}

export interface CreateLeadData {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  estimated_value?: number;
  notes?: string;
}

export interface UpdateLeadData {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  status?: LeadStatus;
  estimated_value?: number;
  notes?: string;
}

export class LeadService {
  static async getClinicId(): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", userData.user.id)
      .single();

    if (!profile?.clinic_id) throw new Error("User has no clinic");
    return profile.clinic_id;
  }

  static async fetchAll(): Promise<SalesLead[]> {
    const { data, error } = await supabase
      .from("sales_leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as SalesLead[];
  }

  static async create(data: CreateLeadData): Promise<SalesLead> {
    const clinicId = await this.getClinicId();

    const { data: lead, error } = await supabase
      .from("sales_leads")
      .insert({
        clinic_id: clinicId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        source: data.source || 'manual',
        estimated_value: data.estimated_value || 0,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return lead as SalesLead;
  }

  static async update(id: string, data: UpdateLeadData): Promise<SalesLead> {
    const { data: lead, error } = await supabase
      .from("sales_leads")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return lead as SalesLead;
  }

  static async updateStatus(id: string, status: LeadStatus): Promise<SalesLead> {
    return this.update(id, { status });
  }

  static async markAsConverted(id: string, patientId: string): Promise<SalesLead> {
    const { data: lead, error } = await supabase
      .from("sales_leads")
      .update({
        status: 'ganho',
        converted_patient_id: patientId,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return lead as SalesLead;
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("sales_leads")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // Analytics helpers
  static calculatePipelineValue(leads: SalesLead[]): number {
    return leads
      .filter(l => ['novo', 'agendado', 'proposta'].includes(l.status))
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  }

  static calculateConversionRate(leads: SalesLead[]): number {
    const total = leads.length;
    if (total === 0) return 0;
    const won = leads.filter(l => l.status === 'ganho').length;
    return (won / total) * 100;
  }

  static calculateWonValue(leads: SalesLead[]): number {
    return leads
      .filter(l => l.status === 'ganho')
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  }
}
