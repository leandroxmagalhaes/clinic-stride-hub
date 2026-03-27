CREATE TABLE IF NOT EXISTS public.notas_lembretes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  tipo text NOT NULL DEFAULT 'tarefa',
  texto text NOT NULL,
  concluida boolean DEFAULT false,
  data_prazo date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notas_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notes in own clinic"
  ON public.notas_lembretes FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));