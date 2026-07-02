CREATE TABLE public.solicitacoes_vaga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  nome_paciente text NOT NULL,
  data_nascimento date NOT NULL,
  faixa_etaria text NOT NULL,
  nome_responsavel text,
  telefone text NOT NULL,
  email text NOT NULL,
  tipo_caso text NOT NULL,
  urgente boolean NOT NULL DEFAULT false,
  motivo_urgencia text,
  observacoes text,
  estado text NOT NULL DEFAULT 'nova',
  estado_em timestamp with time zone,
  notas_internas text
);

ALTER TABLE public.solicitacoes_vaga
  ADD CONSTRAINT solicitacoes_vaga_estado_check
  CHECK (estado IN ('nova', 'em_analise', 'contactada', 'agendada', 'sem_vaga'));

ALTER TABLE public.solicitacoes_vaga
  ADD CONSTRAINT solicitacoes_vaga_faixa_etaria_check
  CHECK (faixa_etaria IN ('bebe', 'crianca', 'adulto', 'idoso'));

ALTER TABLE public.solicitacoes_vaga
  ADD CONSTRAINT solicitacoes_vaga_tipo_caso_check
  CHECK (tipo_caso IN ('respiratorio', 'motora', 'neurodesenvolvimento', 'vestibular'));

GRANT SELECT, UPDATE ON public.solicitacoes_vaga TO authenticated;
GRANT ALL ON public.solicitacoes_vaga TO service_role;

ALTER TABLE public.solicitacoes_vaga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view their requests"
  ON public.solicitacoes_vaga
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Clinic members can update their requests"
  ON public.solicitacoes_vaga
  FOR UPDATE
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS solicitacao_vaga_email text;