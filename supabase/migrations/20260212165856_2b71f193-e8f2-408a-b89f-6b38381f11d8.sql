
-- Create scheduling_packages table
CREATE TABLE public.scheduling_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  profissional_id UUID NOT NULL REFERENCES public.profiles(id),
  servico_id UUID NOT NULL REFERENCES public.servicos(id),
  modality TEXT NOT NULL CHECK (modality IN ('avulso', 'recorrente', 'pacote_fixo', 'pacote_personalizado')),
  frequency TEXT CHECK (frequency IN ('semanal', 'quinzenal', 'mensal')),
  fixed_days JSONB,
  flexible BOOLEAN NOT NULL DEFAULT false,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  sessions_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'concluido', 'cancelado')),
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.scheduling_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies (same clinic pattern)
CREATE POLICY "Users can view packages from own clinic"
  ON public.scheduling_packages FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert packages in own clinic"
  ON public.scheduling_packages FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update packages in own clinic"
  ON public.scheduling_packages FOR UPDATE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete packages in own clinic"
  ON public.scheduling_packages FOR DELETE
  USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE user_id = auth.uid()));

-- Add package_id column to sessoes
ALTER TABLE public.sessoes ADD COLUMN package_id UUID REFERENCES public.scheduling_packages(id);
