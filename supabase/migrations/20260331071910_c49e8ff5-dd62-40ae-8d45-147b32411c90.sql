CREATE TABLE IF NOT EXISTS public.clientes_fixos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid,
  paciente_id uuid,
  nome text NOT NULL,
  telefone text,
  especialidade text,
  frequencia text NOT NULL DEFAULT 'weekly',
  sessoes_por_periodo integer NOT NULL DEFAULT 1,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clientes_fixos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage clientes_fixos in own clinic"
  ON public.clientes_fixos FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));