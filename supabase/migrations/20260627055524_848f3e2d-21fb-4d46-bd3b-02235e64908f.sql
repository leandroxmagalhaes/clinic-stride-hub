DO $$

DECLARE

  v_command text;

BEGIN

  SELECT command INTO v_command FROM cron.job

  WHERE jobname = 'send-appointment-reminder-3h' LIMIT 1;

  IF v_command IS NULL THEN

    RAISE EXCEPTION 'Job send-appointment-reminder-3h não encontrado. Para e reporta.';

  END IF;

  -- Se já tiver timeout_milliseconds, não duplica

  IF position('timeout_milliseconds' in v_command) = 0 THEN

    -- injeta o timeout antes do fecho do net.http_post (antes do ");")

    v_command := regexp_replace(

      v_command,

      '\)\s*;\s*\$',

      ', timeout_milliseconds := 30000);',

      'g'

    );

  END IF;

  PERFORM cron.unschedule('send-appointment-reminder-3h');

  PERFORM cron.schedule('send-appointment-reminder-3h', '*/30 * * * *', v_command);

END $$;