CREATE TABLE IF NOT EXISTS public.comunicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  sessao_id uuid REFERENCES public.sessoes(id) ON DELETE SET NULL,
  canal text NOT NULL DEFAULT 'email',
  tipo text NOT NULL,
  assunto text,
  destinatario text,
  estado text NOT NULL DEFAULT 'enviado',
  erro text,
  provider text DEFAULT 'resend',
  provider_id text,
  origem text,
  disparado_por uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  entregue_em timestamptz,
  aberto_em timestamptz,
  clicado_em timestamptz,
  devolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_clinic_data ON public.comunicacoes (clinic_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_paciente ON public.comunicacoes (paciente_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_sessao ON public.comunicacoes (sessao_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_provider ON public.comunicacoes (provider_id);

ALTER TABLE public.comunicacoes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.comunicacoes TO authenticated;
GRANT ALL ON public.comunicacoes TO service_role;

CREATE POLICY "Staff pode ver comunicacoes da sua clinica"
ON public.comunicacoes
FOR SELECT
TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));