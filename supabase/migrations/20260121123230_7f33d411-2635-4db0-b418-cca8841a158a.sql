-- Add initial_assessment_data column to store structured anamnesis data
ALTER TABLE public.pacientes
ADD COLUMN initial_assessment_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.pacientes.initial_assessment_data IS 'Structured data from initial assessment based on specialty template';