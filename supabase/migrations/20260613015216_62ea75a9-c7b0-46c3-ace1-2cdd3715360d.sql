CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id UUID NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  canal TEXT NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sessao_id, canal)
);

GRANT SELECT ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view reminder logs in their clinic"
ON public.reminder_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sessoes s
    WHERE s.id = reminder_logs.sessao_id
      AND s.clinic_id = public.get_user_clinic_id(auth.uid())
  )
);

CREATE INDEX idx_reminder_logs_sessao ON public.reminder_logs(sessao_id);