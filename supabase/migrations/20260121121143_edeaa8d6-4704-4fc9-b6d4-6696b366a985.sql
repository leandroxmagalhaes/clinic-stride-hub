-- Add primary_specialty_id to pacientes table
-- This links a patient to their primary specialty template for treatment

ALTER TABLE public.pacientes
ADD COLUMN primary_specialty_id uuid REFERENCES public.specialty_templates(id);

-- Create index for better query performance
CREATE INDEX idx_pacientes_primary_specialty ON public.pacientes(primary_specialty_id);

-- Add comment for documentation
COMMENT ON COLUMN public.pacientes.primary_specialty_id IS 'Primary specialty template for patient treatment, set during anamnesis';