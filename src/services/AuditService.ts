// AuditService - Centralized audit logging for all entity actions
import { supabase } from "@/integrations/supabase/client";
import { getAuthContextWithEmail } from "@/lib/auth-helpers";

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'cancel' 
  | 'complete' 
  | 'reschedule';

export type EntityType = 
  | 'patient' 
  | 'session' 
  | 'service' 
  | 'professional'
  | 'credit_transaction'
  | 'lead';

export interface AuditLogEntry {
  id: string;
  clinic_id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface LogParams {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  details?: Record<string, any>;
}

export class AuditService {
  /**
   * Log an action to the audit_logs table
   */
  static async log(params: LogParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { userId, clinicId, email } = await getAuthContextWithEmail();

      const { error } = await supabase.from("audit_logs").insert({
        clinic_id: clinicId,
        user_id: userId,
        user_email: email,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        details: params.details || {},
      });

      if (error) {
        console.error("Error logging audit:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error("Exception in AuditService.log:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  /**
   * Fetch audit logs with optional filters
   */
  static async getLogs(params?: {
    limit?: number;
    offset?: number;
    entityType?: EntityType;
    action?: AuditAction;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: AuditLogEntry[]; error?: string }> {
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (params?.entityType) {
        query = query.eq("entity_type", params.entityType);
      }

      if (params?.action) {
        query = query.eq("action", params.action);
      }

      if (params?.startDate) {
        query = query.gte("created_at", params.startDate);
      }

      if (params?.endDate) {
        query = query.lte("created_at", params.endDate);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching audit logs:", error);
        return { data: [], error: error.message };
      }

      return { data: data as AuditLogEntry[] };
    } catch (err) {
      console.error("Exception in AuditService.getLogs:", err);
      return { data: [], error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  /**
   * Get human-readable action label in Portuguese
   */
  static getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      create: "Criou",
      update: "Atualizou",
      delete: "Apagou",
      cancel: "Cancelou",
      complete: "Finalizou",
      reschedule: "Remarcou",
    };
    return labels[action] || action;
  }

  /**
   * Get human-readable entity type label in Portuguese
   */
  static getEntityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      patient: "paciente",
      session: "sessão",
      service: "serviço",
      professional: "profissional",
      credit_transaction: "transação de crédito",
      lead: "lead",
    };
    return labels[entityType] || entityType;
  }
}
