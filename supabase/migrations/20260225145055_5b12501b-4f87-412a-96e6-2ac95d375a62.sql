
-- Add AI feature flags to clinic_settings
ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_clinical_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_management_enabled boolean NOT NULL DEFAULT true;

-- Create ai_usage_logs table for tracking AI usage (no sensitive content stored)
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  action text NOT NULL DEFAULT 'generated',
  model text,
  tokens_used integer,
  duration_ms integer,
  error_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for ai_usage_logs
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI logs from own clinic"
  ON public.ai_usage_logs FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert AI logs in own clinic"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
