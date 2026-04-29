CREATE OR REPLACE FUNCTION public.upsert_portal_questionnaire(
  p_paciente_id uuid,
  p_template_id uuid,
  p_perfil_tipo text,
  p_respostas jsonb,
  p_completo boolean DEFAULT false,
  p_link_token text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_questionario_id uuid;
  v_conta_id uuid;
  v_has_access boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilizador não autenticado';
  END IF;

  IF p_paciente_id IS NULL THEN
    RAISE EXCEPTION 'Utente obrigatório';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.portal_conta_pacientes pcp
    JOIN public.portal_contas pc ON pc.id = pcp.conta_id
    WHERE pc.auth_user_id = v_user_id
      AND pcp.paciente_id = p_paciente_id
  ) INTO v_has_access;

  IF NOT v_has_access AND p_link_token IS NOT NULL THEN
    SELECT public.ensure_portal_account_link(
      p_paciente_id,
      NULL,
      'email',
      p_link_token
    ) INTO v_conta_id;
    v_has_access := v_conta_id IS NOT NULL;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Sem permissão para guardar este questionário';
  END IF;

  INSERT INTO public.portal_questionario (
    paciente_id,
    template_id,
    perfil_tipo,
    respostas,
    completo,
    updated_at
  ) VALUES (
    p_paciente_id,
    p_template_id,
    p_perfil_tipo,
    COALESCE(p_respostas, '{}'::jsonb),
    COALESCE(p_completo, false),
    now()
  )
  ON CONFLICT (paciente_id) DO UPDATE
  SET
    template_id = COALESCE(EXCLUDED.template_id, portal_questionario.template_id),
    perfil_tipo = COALESCE(NULLIF(EXCLUDED.perfil_tipo, ''), portal_questionario.perfil_tipo),
    respostas = COALESCE(EXCLUDED.respostas, '{}'::jsonb),
    completo = CASE WHEN EXCLUDED.completo THEN true ELSE portal_questionario.completo END,
    updated_at = now()
  RETURNING id INTO v_questionario_id;

  IF COALESCE(p_completo, false) THEN
    UPDATE public.portal_contas pc
    SET onboarding_completo = true,
        updated_at = now()
    WHERE pc.auth_user_id = v_user_id
      AND EXISTS (
        SELECT 1
        FROM public.portal_conta_pacientes pcp
        WHERE pcp.conta_id = pc.id
          AND pcp.paciente_id = p_paciente_id
      );

    IF p_link_token IS NOT NULL THEN
      UPDATE public.portal_convites
      SET utilizado = true
      WHERE paciente_id = p_paciente_id
        AND link_token = p_link_token;
    END IF;
  END IF;

  RETURN v_questionario_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_portal_questionnaire(uuid, uuid, text, jsonb, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_portal_questionnaire(uuid, uuid, text, jsonb, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_portal_questionnaire(uuid, uuid, text, jsonb, boolean, text) TO authenticated;