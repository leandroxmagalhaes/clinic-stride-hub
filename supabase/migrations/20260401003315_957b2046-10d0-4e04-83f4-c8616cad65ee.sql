
-- Create portal_conta_pacientes linking table
CREATE TABLE IF NOT EXISTS public.portal_conta_pacientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  relacao text DEFAULT 'responsavel',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(conta_id, paciente_id)
);

ALTER TABLE public.portal_conta_pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total portal_conta_pacientes"
  ON public.portal_conta_pacientes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Migrate existing data from portal_contas
INSERT INTO public.portal_conta_pacientes (conta_id, paciente_id, relacao, is_primary)
SELECT id, paciente_id, 'responsavel', true
FROM public.portal_contas
WHERE paciente_id IS NOT NULL
ON CONFLICT (conta_id, paciente_id) DO NOTHING;

-- Add portal_role to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portal_role text DEFAULT NULL;
