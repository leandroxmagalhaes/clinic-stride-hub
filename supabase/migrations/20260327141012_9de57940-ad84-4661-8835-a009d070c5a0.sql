CREATE TABLE IF NOT EXISTS public.lista_espera (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  nome text NOT NULL,
  telefone text NOT NULL,
  especialidade text NOT NULL,
  prioridade text NOT NULL DEFAULT 'normal',
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage waiting list in own clinic"
  ON public.lista_espera FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));