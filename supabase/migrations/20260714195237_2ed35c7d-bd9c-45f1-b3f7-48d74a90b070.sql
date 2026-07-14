
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS preco_consulta numeric;

CREATE TABLE public.historico_precos_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  valor_anterior numeric,
  motivo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid
);

CREATE INDEX idx_historico_precos_paciente_paciente ON public.historico_precos_paciente(paciente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_precos_paciente TO authenticated;
GRANT ALL ON public.historico_precos_paciente TO service_role;

ALTER TABLE public.historico_precos_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view patient price history"
ON public.historico_precos_paciente
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = historico_precos_paciente.paciente_id
      AND p.clinic_id = public.get_user_clinic_id(auth.uid())
  )
);

CREATE POLICY "Clinic members can insert patient price history"
ON public.historico_precos_paciente
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = historico_precos_paciente.paciente_id
      AND p.clinic_id = public.get_user_clinic_id(auth.uid())
  )
);
