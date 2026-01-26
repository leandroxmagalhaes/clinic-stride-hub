-- Create a table to link professionals (from profissionais table) to patients they're responsible for
CREATE TABLE IF NOT EXISTS public.professional_patient_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (professional_id, patient_id)
);

-- Enable RLS
ALTER TABLE public.professional_patient_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for professional_patient_assignments
CREATE POLICY "Users can view assignments in own clinic"
ON public.professional_patient_assignments FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins and secretaries can insert assignments"
ON public.professional_patient_assignments FOR INSERT
WITH CHECK (
  clinic_id = get_user_clinic_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretary'))
);

CREATE POLICY "Admins and secretaries can update assignments"
ON public.professional_patient_assignments FOR UPDATE
USING (
  clinic_id = get_user_clinic_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretary'))
);

CREATE POLICY "Admins and secretaries can delete assignments"
ON public.professional_patient_assignments FOR DELETE
USING (
  clinic_id = get_user_clinic_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretary'))
);

-- Create helper function to check if professional can access patient
CREATE OR REPLACE FUNCTION public.professional_can_access_patient(p_user_id UUID, p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is admin or secretary (full access)
    SELECT 1 WHERE has_role(p_user_id, 'admin') OR has_role(p_user_id, 'secretary')
  ) OR EXISTS (
    -- Check if professional is directly assigned to patient
    SELECT 1 
    FROM public.professional_patient_assignments ppa
    INNER JOIN public.profissionais prof ON prof.id = ppa.professional_id
    WHERE ppa.patient_id = p_patient_id
    AND prof.email = (SELECT email FROM auth.users WHERE id = p_user_id)
  ) OR EXISTS (
    -- Check if professional has sessions with patient
    SELECT 1 
    FROM public.sessoes s
    INNER JOIN public.profissionais prof ON prof.id = s.profissional_id
    WHERE s.paciente_id = p_patient_id
    AND prof.email = (SELECT email FROM auth.users WHERE id = p_user_id)
  )
$$;

-- Create helper function to check if professional can access session
CREATE OR REPLACE FUNCTION public.professional_can_access_session(p_user_id UUID, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is admin or secretary (full access)
    SELECT 1 WHERE has_role(p_user_id, 'admin') OR has_role(p_user_id, 'secretary')
  ) OR EXISTS (
    -- Check if professional owns this session
    SELECT 1 
    FROM public.sessoes s
    INNER JOIN public.profissionais prof ON prof.id = s.profissional_id
    WHERE s.id = p_session_id
    AND prof.email = (SELECT email FROM auth.users WHERE id = p_user_id)
  )
$$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profissionais_email ON public.profissionais(email);
CREATE INDEX IF NOT EXISTS idx_sessoes_profissional_paciente ON public.sessoes(profissional_id, paciente_id);