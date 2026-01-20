// CreditService - Business logic for credit/pack operations (SRP, Ledger Model)
// Uses a transaction ledger approach for idempotent credit operations

import { supabase } from "@/integrations/supabase/client";

export type TransactionType = 'purchase' | 'usage' | 'adjustment' | 'refund';

export interface CreditTransaction {
  id: string;
  clinic_id: string;
  patient_id: string;
  amount: number;
  transaction_type: TransactionType;
  description: string | null;
  related_session_id: string | null;
  created_at: string;
}

export interface CreateCreditTransactionData {
  clinicId: string;
  patientId: string;
  amount: number;
  transactionType: TransactionType;
  description?: string;
  relatedSessionId?: string;
}

export interface PatientBalance {
  patientId: string;
  balance: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class CreditService {
  /**
   * Validate credit transaction data before creation
   */
  static validate(data: CreateCreditTransactionData): ValidationResult {
    if (!data.clinicId) {
      return { isValid: false, error: "Clinic ID é obrigatório" };
    }
    if (!data.patientId) {
      return { isValid: false, error: "Patient ID é obrigatório" };
    }
    if (data.amount === 0) {
      return { isValid: false, error: "Valor da transação não pode ser zero" };
    }
    if (!['purchase', 'usage', 'adjustment', 'refund'].includes(data.transactionType)) {
      return { isValid: false, error: "Tipo de transação inválido" };
    }

    return { isValid: true };
  }

  /**
   * Get patient balance from the database using the view
   * This is the ONLY way to get balance - never calculate manually
   */
  static async getBalance(patientId: string): Promise<number> {
    const { data, error } = await supabase
      .from('patient_credit_balances')
      .select('balance')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching patient balance:', error);
      return 0;
    }

    return data?.balance ?? 0;
  }

  /**
   * Get balances for multiple patients (optimized batch query)
   */
  static async getBalancesBatch(patientIds: string[]): Promise<Map<string, number>> {
    if (patientIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('patient_credit_balances')
      .select('patient_id, balance')
      .in('patient_id', patientIds);

    if (error) {
      console.error('Error fetching patient balances:', error);
      return new Map();
    }

    const balanceMap = new Map<string, number>();
    data?.forEach((row) => {
      balanceMap.set(row.patient_id, row.balance);
    });

    return balanceMap;
  }

  /**
   * Check if patient has sufficient credits for a session
   */
  static async hasSufficientCredits(patientId: string, requiredCredits: number = 1): Promise<boolean> {
    const balance = await this.getBalance(patientId);
    return balance >= requiredCredits;
  }

  /**
   * Create a credit purchase transaction (add credits to patient)
   */
  static async purchaseCredits(
    clinicId: string,
    patientId: string,
    amount: number,
    description?: string
  ): Promise<{ success: boolean; error?: string; transaction?: CreditTransaction }> {
    if (amount <= 0) {
      return { success: false, error: "Quantidade de créditos deve ser positiva" };
    }

    const { data, error } = await supabase
      .from('credit_transactions')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        amount: amount,
        transaction_type: 'purchase',
        description: description || `Compra de ${amount} crédito(s)`,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating purchase transaction:', error);
      return { success: false, error: "Erro ao registrar compra de créditos" };
    }

    return { 
      success: true, 
      transaction: {
        id: data.id,
        clinic_id: data.clinic_id,
        patient_id: data.patient_id,
        amount: data.amount,
        transaction_type: data.transaction_type as TransactionType,
        description: data.description,
        related_session_id: data.related_session_id,
        created_at: data.created_at,
      }
    };
  }

  /**
   * Use a credit for a session (idempotent - uses related_session_id)
   * Returns success if credit was deducted or if already deducted for this session
   */
  static async useCredit(
    clinicId: string,
    patientId: string,
    sessionId: string,
    description?: string
  ): Promise<{ success: boolean; error?: string; alreadyDeducted?: boolean }> {
    // First check if credit was already deducted for this session (idempotency)
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('related_session_id', sessionId)
      .eq('transaction_type', 'usage')
      .maybeSingle();

    if (existingTransaction) {
      // Credit already deducted for this session - return success (idempotent)
      return { success: true, alreadyDeducted: true };
    }

    // Check balance before deducting
    const balance = await this.getBalance(patientId);
    if (balance <= 0) {
      return { success: false, error: "Saldo de créditos insuficiente" };
    }

    // Deduct credit
    const { error } = await supabase
      .from('credit_transactions')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        amount: -1,
        transaction_type: 'usage',
        description: description || 'Uso de crédito para sessão',
        related_session_id: sessionId,
      });

    if (error) {
      // Check if it's the idempotency constraint
      if (error.message.includes('idempotency')) {
        return { success: true, alreadyDeducted: true };
      }
      console.error('Error using credit:', error);
      return { success: false, error: "Erro ao deduzir crédito" };
    }

    return { success: true };
  }

  /**
   * Refund a credit for a cancelled session
   */
  static async refundCredit(
    clinicId: string,
    patientId: string,
    sessionId: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('credit_transactions')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        amount: 1,
        transaction_type: 'refund',
        description: description || 'Reembolso de crédito por sessão cancelada',
        related_session_id: sessionId,
      });

    if (error) {
      console.error('Error refunding credit:', error);
      return { success: false, error: "Erro ao reembolsar crédito" };
    }

    return { success: true };
  }

  /**
   * Get transaction history for a patient
   */
  static async getTransactionHistory(patientId: string): Promise<CreditTransaction[]> {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      clinic_id: row.clinic_id,
      patient_id: row.patient_id,
      amount: row.amount,
      transaction_type: row.transaction_type as TransactionType,
      description: row.description,
      related_session_id: row.related_session_id,
      created_at: row.created_at,
    }));
  }
}
