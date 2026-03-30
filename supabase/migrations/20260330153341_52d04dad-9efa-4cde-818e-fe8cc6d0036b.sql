CREATE TABLE IF NOT EXISTS public.pacientes_excluidos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid,
  paciente_id_original uuid,
  dados_paciente jsonb NOT NULL,
  excluido_por uuid,
  excluido_em timestamptz DEFAULT now(),
  motivo text DEFAULT 'Exclusão manual'
);

ALTER TABLE public.pacientes_excluidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage deleted patients in own clinic"
  ON public.pacientes_excluidos FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));