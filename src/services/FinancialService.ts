// FinancialService - Business logic for financial metrics and revenue recognition
// Implements Cash vs Accrual (Caixa vs Competência) accounting model

import { supabase } from "@/integrations/supabase/client";

export interface FinancialKPIs {
  salesRevenue: number;      // Total monetary value from pack purchases (Cash)
  salesCount: number;        // Number of pack sales
  executedRevenue: number;   // Revenue from completed sessions (Accrual)
  sessionsCompleted: number; // Number of completed sessions
  averageTicket: number;     // Average ticket per sale
}

export interface PurchaseTransaction {
  id: string;
  patient_id: string;
  patient_name: string | null;
  amount: number;
  monetary_value: number | null;
  payment_method: string | null;
  payment_status: string | null;
  description: string | null;
  created_at: string;
}

// Default average session value for MVP (can be calculated dynamically later)
const DEFAULT_SESSION_VALUE = 120;

export class FinancialService {
  /**
   * Get financial KPIs for a date range
   */
  static async getKPIs(startDate: Date, endDate: Date): Promise<FinancialKPIs> {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // Get pack purchases (cash inflow)
    const { data: purchases, error: purchasesError } = await supabase
      .from('credit_transactions')
      .select('monetary_value, amount')
      .eq('transaction_type', 'purchase')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (purchasesError) {
      console.error('Error fetching purchases:', purchasesError);
    }

    // Get credit usages (sessions completed - for accrual accounting)
    const { data: usages, error: usagesError } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('transaction_type', 'usage')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (usagesError) {
      console.error('Error fetching usages:', usagesError);
    }

    // Calculate KPIs
    const salesRevenue = purchases?.reduce((sum, p) => sum + (p.monetary_value || 0), 0) || 0;
    const salesCount = purchases?.length || 0;
    const sessionsCompleted = usages?.length || 0;

    // Calculate average session value from purchases (total monetary / total credits sold)
    const totalCreditsSold = purchases?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const averageSessionValue = totalCreditsSold > 0 
      ? salesRevenue / totalCreditsSold 
      : DEFAULT_SESSION_VALUE;

    // Executed revenue = sessions completed * average session value
    const executedRevenue = sessionsCompleted * averageSessionValue;
    
    // Average ticket = total revenue / number of sales
    const averageTicket = salesCount > 0 ? salesRevenue / salesCount : 0;

    return {
      salesRevenue,
      salesCount,
      executedRevenue,
      sessionsCompleted,
      averageTicket,
    };
  }

  /**
   * Get purchase transactions with patient names for the transactions table
   */
  static async getPurchaseTransactions(
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<PurchaseTransaction[]> {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const { data, error } = await supabase
      .from('credit_transactions')
      .select(`
        id,
        patient_id,
        amount,
        monetary_value,
        payment_method,
        payment_status,
        description,
        created_at
      `)
      .eq('transaction_type', 'purchase')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching purchase transactions:', error);
      return [];
    }

    // Fetch patient names in batch
    const patientIds = [...new Set(data?.map(t => t.patient_id) || [])];
    const { data: patients } = await supabase
      .from('pacientes')
      .select('id, full_name')
      .in('id', patientIds);

    const patientMap = new Map(patients?.map(p => [p.id, p.full_name]) || []);

    return data?.map(t => ({
      ...t,
      patient_name: patientMap.get(t.patient_id) || null,
    })) || [];
  }

  /**
   * Record a credit purchase with financial data
   */
  static async recordPurchase(params: {
    clinicId: string;
    patientId: string;
    credits: number;
    monetaryValue: number;
    paymentMethod: 'pix' | 'credit_card' | 'cash' | 'transfer';
    paymentStatus: 'paid' | 'pending';
    description?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase
      .from('credit_transactions')
      .insert({
        clinic_id: params.clinicId,
        patient_id: params.patientId,
        amount: params.credits,
        transaction_type: 'purchase',
        monetary_value: params.monetaryValue,
        payment_method: params.paymentMethod,
        payment_status: params.paymentStatus,
        description: params.description || `Compra de ${params.credits} crédito(s)`,
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording purchase:', error);
      return { success: false, error: 'Erro ao registrar venda' };
    }

    return { success: true };
  }
}
