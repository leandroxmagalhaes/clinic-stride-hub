DO $$

DECLARE

  v_command text;

BEGIN

  SELECT command INTO v_command FROM cron.job

  WHERE jobname = 'send-appointment-reminder-3h' LIMIT 1;

  IF v_command IS NULL THEN

    RAISE EXCEPTION 'Job não encontrado. Para e reporta.';

  END IF;

  IF position('timeout_milliseconds' in v_command) > 0 THEN

    RAISE NOTICE 'Já tem timeout; nada a fazer.';

  ELSE

    -- substitui o ÚLTIMO ");" por ", timeout_milliseconds := 30000);"

    v_command := regexp_replace(

      v_command,

      '\)\s*;\s*$',

      ', timeout_milliseconds := 30000);'

    );

    PERFORM cron.unschedule('send-appointment-reminder-3h');

    PERFORM cron.schedule('send-appointment-reminder-3h', '*/30 * * * *', v_command);

  END IF;

END $$;