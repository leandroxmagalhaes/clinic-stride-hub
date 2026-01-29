-- Add privacy consent timestamp to patients table
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz DEFAULT NULL;