DO $$
DECLARE
  v_command text;
BEGIN
  -- Vai buscar o comando exato do job diário existente
  SELECT command INTO v_command
  FROM cron.job
  WHERE jobname = 'send-appointment-reminder-daily'
  LIMIT 1;

  IF v_command IS NULL THEN
    RAISE EXCEPTION 'Não encontrei o job send-appointment-reminder-daily. Para e reporta.';
  END IF;

  -- Remove o agendamento diário antigo
  PERFORM cron.unschedule('send-appointment-reminder-daily');

  -- Remove um eventual 3h já existente (idempotência)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-appointment-reminder-3h') THEN
    PERFORM cron.unschedule('send-appointment-reminder-3h');
  END IF;

  -- Recria com o MESMO comando, agora a cada 30 minutos
  PERFORM cron.schedule('send-appointment-reminder-3h', '*/30 * * * *', v_command);
END $$;