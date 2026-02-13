
-- Add new columns to pacientes for onboarding
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_nif text,
  ADD COLUMN IF NOT EXISTS billing_address jsonb,
  ADD COLUMN IF NOT EXISTS image_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Generate tokens for existing patients
UPDATE public.pacientes SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Make public_token NOT NULL and UNIQUE
ALTER TABLE public.pacientes ALTER COLUMN public_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_public_token ON public.pacientes(public_token);

-- Trigger to auto-generate public_token on INSERT
CREATE OR REPLACE FUNCTION public.generate_patient_public_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_patient_public_token
  BEFORE INSERT ON public.pacientes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_patient_public_token();
