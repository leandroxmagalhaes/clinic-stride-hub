
CREATE TABLE IF NOT EXISTS public.portal_questionario_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  questionario_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  campo_alterado text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_questionario_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais veem historico"
  ON public.portal_questionario_historico FOR SELECT
  USING (is_professional(auth.uid()));

CREATE POLICY "Pacientes veem proprio historico"
  ON public.portal_questionario_historico FOR SELECT
  USING (paciente_id IN (SELECT get_portal_patient_ids(auth.uid())));

CREATE POLICY "Inserir historico autenticado"
  ON public.portal_questionario_historico FOR INSERT
  WITH CHECK (true);
