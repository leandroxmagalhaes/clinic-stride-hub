-- Add financial tracking columns to credit_transactions
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS monetary_value NUMERIC(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Add check constraint for payment_method
ALTER TABLE public.credit_transactions
ADD CONSTRAINT credit_transactions_payment_method_check
CHECK (payment_method IS NULL OR payment_method IN ('pix', 'credit_card', 'cash', 'transfer'));

-- Add check constraint for payment_status
ALTER TABLE public.credit_transactions
ADD CONSTRAINT credit_transactions_payment_status_check
CHECK (payment_status IN ('paid', 'pending'));

-- Create index for financial queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_transaction_type ON public.credit_transactions(transaction_type);