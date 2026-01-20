-- Fix RLS policies on credit_transactions to use security definer function
-- This prevents infinite recursion when querying profiles

DROP POLICY IF EXISTS "Users can view credit transactions from own clinic" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can insert credit transactions in own clinic" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can update credit transactions in own clinic" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can delete credit transactions in own clinic" ON public.credit_transactions;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view credit transactions from own clinic"
ON public.credit_transactions
FOR SELECT
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert credit transactions in own clinic"
ON public.credit_transactions
FOR INSERT
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update credit transactions in own clinic"
ON public.credit_transactions
FOR UPDATE
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete credit transactions in own clinic"
ON public.credit_transactions
FOR DELETE
USING (clinic_id = public.get_user_clinic_id(auth.uid()));