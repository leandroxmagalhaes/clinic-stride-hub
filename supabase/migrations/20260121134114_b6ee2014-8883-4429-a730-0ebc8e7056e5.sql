-- Create patient_feedback table for NPS tracking
CREATE TABLE public.patient_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feedback from own clinic"
  ON public.patient_feedback
  FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert feedback in own clinic"
  ON public.patient_feedback
  FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update feedback in own clinic"
  ON public.patient_feedback
  FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete feedback in own clinic"
  ON public.patient_feedback
  FOR DELETE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Add index for performance
CREATE INDEX idx_patient_feedback_clinic ON public.patient_feedback(clinic_id);
CREATE INDEX idx_patient_feedback_patient ON public.patient_feedback(patient_id);