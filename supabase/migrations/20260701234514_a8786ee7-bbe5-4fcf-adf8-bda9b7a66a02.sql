DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-day-before-reminder-30m') THEN
    PERFORM cron.unschedule('send-day-before-reminder-30m');
  END IF;
END $$;

SELECT cron.schedule(
  'send-day-before-reminder-30m',
  '*/30 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://efzxtildgdawcplykbdc.supabase.co/functions/v1/send-day-before-reminder',
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