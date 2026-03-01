// FinancialTransactionService - Dedicated layer for financial transaction operations
// Handles queries, filters, and CRUD on credit_transactions

import { supabase } from "@/integrations/supabase/client";

export interface FinancialTransaction {
  id: string;
  clinic_id: string | null;
  patient_id: string;
  patient_name?: string | null;
  amount: number;
  transaction_type: string;
  description: string | null;
  monetary_value: number | null;
  payment_method: string | null;
  payment_status: string | null;
  related_session_id: string | null;
  created_at: string;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  transactionType?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  patientId?: string;
  page?: number;
  pageSize?: number;
}

export interface RevenueByMethod {
  payment_method: string;
  total: number;
  count: number;
}

export class FinancialTransactionService {
  /**
   * List transactions with filters and pagination
   */
  static async getTransactions(
    filters: TransactionFilters = {}
  ): Promise<{ data: FinancialTransaction[]; total: number }> {
    const { page = 1, pageSize = 20 } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("credit_transactions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate.toISOString());
    }
    if (filters.transactionType) {
      query = query.eq("transaction_type", filters.transactionType);
    }
    if (filters.paymentMethod) {
      query = query.eq("payment_method", filters.paymentMethod);
    }
    if (filters.paymentStatus) {
      query = query.eq("payment_status", filters.paymentStatus);
    }
    if (filters.patientId) {
      query = query.eq("patient_id", filters.patientId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching transactions:", error);
      return { data: [], total: 0 };
    }

    // Batch fetch patient names
    const patientIds = [...new Set(data?.map((t) => t.patient_id) || [])];
    const patientMap = await this.fetchPatientNames(patientIds);

    const transactions: FinancialTransaction[] =
      data?.map((row) => ({
        id: row.id,
        clinic_id: row.clinic_id,
        patient_id: row.patient_id,
        patient_name: patientMap.get(row.patient_id) || null,
        amount: row.amount,
        transaction_type: row.transaction_type,
        description: row.description,
        monetary_value: row.monetary_value,
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        related_session_id: row.related_session_id,
        created_at: row.created_at,
      })) || [];

    return { data: transactions, total: count || 0 };
  }

  /**
   * Get a single transaction by ID
   */
  static async getTransactionById(
    id: string
  ): Promise<FinancialTransaction | null> {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching transaction:", error);
      return null;
    }
    if (!data) return null;

    const patientMap = await this.fetchPatientNames([data.patient_id]);

    return {
      id: data.id,
      clinic_id: data.clinic_id,
      patient_id: data.patient_id,
      patient_name: patientMap.get(data.patient_id) || null,
      amount: data.amount,
      transaction_type: data.transaction_type,
      description: data.description,
      monetary_value: data.monetary_value,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      related_session_id: data.related_session_id,
      created_at: data.created_at,
    };
  }

  /**
   * Update payment status of a transaction
   */
  static async updatePaymentStatus(
    id: string,
    status: "paid" | "pending"
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("credit_transactions")
      .update({ payment_status: status })
      .eq("id", id);

    if (error) {
      console.error("Error updating payment status:", error);
      return { success: false, error: "Erro ao atualizar status de pagamento" };
    }

    return { success: true };
  }

  /**
   * Get transaction history for a specific patient
   */
  static async getTransactionsByPatient(
    patientId: string
  ): Promise<FinancialTransaction[]> {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching patient transactions:", error);
      return [];
    }

    return (
      data?.map((row) => ({
        id: row.id,
        clinic_id: row.clinic_id,
        patient_id: row.patient_id,
        amount: row.amount,
        transaction_type: row.transaction_type,
        description: row.description,
        monetary_value: row.monetary_value,
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        related_session_id: row.related_session_id,
        created_at: row.created_at,
      })) || []
    );
  }

  /**
   * Get revenue breakdown by payment method for a date range
   */
  static async getRevenueByPaymentMethod(
    startDate: Date,
    endDate: Date
  ): Promise<RevenueByMethod[]> {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("payment_method, monetary_value")
      .eq("transaction_type", "purchase")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (error) {
      console.error("Error fetching revenue by method:", error);
      return [];
    }

    const grouped = new Map<string, { total: number; count: number }>();

    data?.forEach((row) => {
      const method = row.payment_method || "não definido";
      const current = grouped.get(method) || { total: 0, count: 0 };
      current.total += row.monetary_value || 0;
      current.count += 1;
      grouped.set(method, current);
    });

    return Array.from(grouped.entries()).map(([method, stats]) => ({
      payment_method: method,
      total: stats.total,
      count: stats.count,
    }));
  }

  /**
   * Helper: batch fetch patient names
   */
  private static async fetchPatientNames(
    patientIds: string[]
  ): Promise<Map<string, string>> {
    if (patientIds.length === 0) return new Map();

    const { data } = await supabase
      .from("pacientes")
      .select("id, full_name")
      .in("id", patientIds);

    return new Map(data?.map((p) => [p.id, p.full_name]) || []);
  }
}
