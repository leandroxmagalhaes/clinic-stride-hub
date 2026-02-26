
-- Table for caching pre-session briefings
CREATE TABLE public.session_briefings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  briefing_data jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Unique index: 1 briefing per session
CREATE UNIQUE INDEX idx_session_briefings_session_id ON public.session_briefings(session_id);

-- Enable RLS
ALTER TABLE public.session_briefings ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other clinic tables)
CREATE POLICY "Users can view briefings from own clinic"
  ON public.session_briefings FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert briefings in own clinic"
  ON public.session_briefings FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update briefings in own clinic"
  ON public.session_briefings FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete briefings in own clinic"
  ON public.session_briefings FOR DELETE
  USING (clinic_id = get_user_clinic_id(auth.uid()));
