-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'professional', 'patient');

-- Create user_roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create patient_diary table
CREATE TABLE public.patient_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  pain_level INTEGER NOT NULL CHECK (pain_level >= 0 AND pain_level <= 10),
  activity_description TEXT NOT NULL,
  notes TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on patient_diary
ALTER TABLE public.patient_diary ENABLE ROW LEVEL SECURITY;

-- Patients can only see and manage their own diary entries
CREATE POLICY "Patients can view their own diary"
ON public.patient_diary
FOR SELECT
USING (patient_id = auth.uid());

CREATE POLICY "Patients can insert their own diary"
ON public.patient_diary
FOR INSERT
WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update their own diary"
ON public.patient_diary
FOR UPDATE
USING (patient_id = auth.uid());

CREATE POLICY "Patients can delete their own diary"
ON public.patient_diary
FOR DELETE
USING (patient_id = auth.uid());

-- Professionals can view diary entries from their clinic's patients
CREATE POLICY "Professionals can view patient diaries from their clinic"
ON public.patient_diary
FOR SELECT
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND public.has_role(auth.uid(), 'professional')
);

-- Add trigger for updated_at
CREATE TRIGGER update_patient_diary_updated_at
BEFORE UPDATE ON public.patient_diary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_patient_diary_patient_date ON public.patient_diary(patient_id, entry_date DESC);