-- Add consumes_credit column to servicos table
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS consumes_credit boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.servicos.consumes_credit IS 'If true, finalizing a session with this service deducts 1 credit. If false, generates a standalone charge.';