CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_automation_logs_portal_onboarding
ON public.automation_logs (paciente_id, trigger_type)
WHERE trigger_type IN ('portal_link_enviado','lembrete_portal_expiracao')
  AND status = 'sent';