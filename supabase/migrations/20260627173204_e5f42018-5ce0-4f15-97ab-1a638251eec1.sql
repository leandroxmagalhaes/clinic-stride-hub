ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS confirmation_token uuid DEFAULT gen_random_uuid();

UPDATE public.sessoes SET confirmation_token = gen_random_uuid() WHERE confirmation_token IS NULL;

ALTER TABLE public.sessoes ALTER COLUMN confirmation_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessoes_confirmation_token ON public.sessoes(confirmation_token);

ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS confirmacao_estado text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS confirmacao_em timestamptz;

ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS confirmacao_dia_anterior_ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS confirmacao_hora_corte text NOT NULL DEFAULT '14:00';

ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS confirmacao_saudacao text;

ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS notificar_clinica_email_remarcacao boolean NOT NULL DEFAULT false;

UPDATE public.clinic_settings
  SET confirmacao_saudacao = 'Olá! Lembramos a consulta do/a {nome} amanhã, {data}, às {hora}. Pode confirmar a presença?'
  WHERE confirmacao_saudacao IS NULL;