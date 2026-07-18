
CREATE TABLE public.automacoes_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automacoes_config_clinic_chave_unique UNIQUE (clinic_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_config TO authenticated;
GRANT ALL ON public.automacoes_config TO service_role;

ALTER TABLE public.automacoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view automacoes_config"
  ON public.automacoes_config FOR SELECT TO authenticated
  USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Clinic members can insert automacoes_config"
  ON public.automacoes_config FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Clinic members can update automacoes_config"
  ON public.automacoes_config FOR UPDATE TO authenticated
  USING (clinic_id = public.get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE TRIGGER update_automacoes_config_updated_at
  BEFORE UPDATE ON public.automacoes_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed rows for existing clinic
INSERT INTO public.automacoes_config (clinic_id, chave, nome, ativo, config)
SELECT c.id, v.chave, v.nome, true, v.config::jsonb
FROM public.clinics c
CROSS JOIN (VALUES
  ('confirmacao_vespera', 'Confirmação de véspera', '{"hora_corte":"14:00","hora_segunda":"18:00","hora_alerta":"20:00"}'),
  ('followup_pagamento', 'Follow-up de método de pagamento', '{"atraso_minutos":30}'),
  ('lembrete_3h', 'Lembrete 3 horas antes', '{}')
) AS v(chave, nome, config)
ON CONFLICT (clinic_id, chave) DO NOTHING;
