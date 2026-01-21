-- Remove old constraint that only allows Brazilian payment methods
ALTER TABLE public.credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_payment_method_check;

-- Create new constraint with Portuguese and Brazilian payment methods
ALTER TABLE public.credit_transactions
ADD CONSTRAINT credit_transactions_payment_method_check
CHECK (
  payment_method IS NULL OR 
  payment_method IN (
    -- Portuguese methods
    'mbway', 
    'multibanco', 
    'transferencia', 
    'numerario', 
    'cartao',
    -- Brazilian methods (for future compatibility)
    'pix', 
    'credit_card', 
    'cash', 
    'transfer'
  )
);