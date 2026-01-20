-- Add health_tags column to pacientes table
ALTER TABLE public.pacientes
ADD COLUMN health_tags TEXT[] DEFAULT '{}';

-- Create credit_transactions table (Ledger model for idempotent credit operations)
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  patient_id UUID NOT NULL REFERENCES public.pacientes(id),
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'adjustment', 'refund')),
  description TEXT,
  related_session_id UUID REFERENCES public.sessoes(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient balance calculation
CREATE INDEX idx_credit_transactions_patient_id ON public.credit_transactions(patient_id);
CREATE INDEX idx_credit_transactions_related_session_id ON public.credit_transactions(related_session_id);

-- Enable RLS on credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_transactions
CREATE POLICY "Users can view credit transactions from own clinic"
ON public.credit_transactions
FOR SELECT
USING (clinic_id IN (
  SELECT profiles.clinic_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can insert credit transactions in own clinic"
ON public.credit_transactions
FOR INSERT
WITH CHECK (clinic_id IN (
  SELECT profiles.clinic_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can update credit transactions in own clinic"
ON public.credit_transactions
FOR UPDATE
USING (clinic_id IN (
  SELECT profiles.clinic_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can delete credit transactions in own clinic"
ON public.credit_transactions
FOR DELETE
USING (clinic_id IN (
  SELECT profiles.clinic_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

-- Create a function to get patient balance (sum of all credit transactions)
CREATE OR REPLACE FUNCTION public.get_patient_balance(p_patient_id UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO balance
  FROM public.credit_transactions
  WHERE patient_id = p_patient_id;
  
  RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create a view to get all patient balances
CREATE OR REPLACE VIEW public.patient_credit_balances AS
SELECT 
  p.id as patient_id,
  p.clinic_id,
  p.full_name,
  COALESCE(SUM(ct.amount), 0) as balance
FROM public.pacientes p
LEFT JOIN public.credit_transactions ct ON ct.patient_id = p.id
GROUP BY p.id, p.clinic_id, p.full_name;

-- Grant access to the view
GRANT SELECT ON public.patient_credit_balances TO authenticated;

-- Create trigger to prevent duplicate credit usage for the same session (idempotency)
CREATE OR REPLACE FUNCTION public.check_credit_usage_idempotency()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for 'usage' transactions with a related_session_id
  IF NEW.transaction_type = 'usage' AND NEW.related_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE related_session_id = NEW.related_session_id
        AND transaction_type = 'usage'
    ) THEN
      RAISE EXCEPTION 'Credit already deducted for this session (idempotency check)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ensure_credit_usage_idempotency
BEFORE INSERT ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.check_credit_usage_idempotency();