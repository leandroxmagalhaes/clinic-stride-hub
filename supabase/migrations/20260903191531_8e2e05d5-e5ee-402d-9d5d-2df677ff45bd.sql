CREATE OR REPLACE FUNCTION public.trg_auditoria_paciente_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nome text;
  v_new jsonb;
BEGIN
  BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
      v_new := to_jsonb(NEW);
      IF v_new ? 'created_by' AND v_new->>'created_by' IS NOT NULL THEN
        v_user_id := (v_new->>'created_by')::uuid;
      ELSE
        RETURN NEW;
      END IF;
    END IF;

    SELECT full_name INTO v_nome
    FROM public.profiles
    WHERE user_id = v_user_id
    LIMIT 1;

    INSERT INTO public.paciente_auditoria (
      paciente_id, clinic_id, acao, motivo, executado_por, executado_por_nome
    ) VALUES (
      NEW.id, NEW.clinic_id, 'criado', NULL, v_user_id, v_nome
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao registar auditoria de criacao do utente %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;