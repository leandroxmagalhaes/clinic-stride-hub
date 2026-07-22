-- Tabela de dedup para lembretes de packs
CREATE TABLE public.pack_reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  canal TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pack_id, canal)
);

GRANT SELECT ON public.pack_reminder_logs TO authenticated;
GRANT ALL ON public.pack_reminder_logs TO service_role;

ALTER TABLE public.pack_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pack reminder logs in their clinic"
ON public.pack_reminder_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_reminder_logs.pack_id
      AND p.clinic_id = public.get_user_clinic_id(auth.uid())
  )
);

CREATE INDEX idx_pack_reminder_logs_pack ON public.pack_reminder_logs(pack_id);

-- Cron: process-pack-billing diário às 09:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pack-billing-daily') THEN
    PERFORM cron.unschedule('process-pack-billing-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'process-pack-billing-daily',
  '0 9 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://efzxtildgdawcplykbdc.supabase.co/functions/v1/process-pack-billing',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer 4yI2S1u7cSrin2JPAy9tixsWjKubG7v_k_Rhw2vmTjSvOxQm',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmenh0aWxkZ2Rhd2NwbHlrYmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDMyMTksImV4cCI6MjA4MzkxOTIxOX0.ibEeGX85efCDqUgUAjTncPxNQv4GeRIjfqwTD7b3rMk'
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  );
  $cmd$
);