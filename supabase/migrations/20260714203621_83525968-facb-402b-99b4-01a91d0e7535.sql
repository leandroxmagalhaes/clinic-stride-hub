
-- 1) Remover a unicidade antiga por paciente
ALTER TABLE public.portal_questionario
  DROP CONSTRAINT IF EXISTS portal_questionario_paciente_id_key;

-- 2) Nova unicidade: um questionário por (paciente, template).
--    Índice parcial para linhas com template_id preenchido.
CREATE UNIQUE INDEX IF NOT EXISTS portal_questionario_paciente_template_uidx
  ON public.portal_questionario (paciente_id, template_id)
  WHERE template_id IS NOT NULL;

-- 3) Compatibilidade com registos legacy (sem template_id):
--    mantemos no máximo 1 registo "legacy" por paciente.
CREATE UNIQUE INDEX IF NOT EXISTS portal_questionario_paciente_legacy_uidx
  ON public.portal_questionario (paciente_id)
  WHERE template_id IS NULL;

-- 4) Atualizar o RPC para casar por (paciente_id, template_id) em vez de só paciente_id.
CREATE OR REPLACE FUNCTION public.upsert_portal_questionnaire(
  p_paciente_id uuid,
  p_template_id uuid,
  p_perfil_tipo text,
  p_respostas jsonb,
  p_completo boolean DEFAULT false,
  p_link_token text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_questionario_id uuid;
  v_existing_id uuid;
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

  -- Localizar registo existente do MESMO modelo (ou legacy sem template).
  IF p_template_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.portal_questionario
    WHERE paciente_id = p_paciente_id
      AND template_id = p_template_id
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing_id
    FROM public.portal_questionario
    WHERE paciente_id = p_paciente_id
      AND template_id IS NULL
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.portal_questionario
    SET
      template_id = COALESCE(p_template_id, template_id),
      perfil_tipo = COALESCE(NULLIF(p_perfil_tipo, ''), perfil_tipo),
      respostas   = COALESCE(p_respostas, '{}'::jsonb),
      completo    = CASE WHEN p_completo THEN true ELSE completo END,
      updated_at  = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_questionario_id;
  ELSE
    INSERT INTO public.portal_questionario (
      paciente_id, template_id, perfil_tipo, respostas, completo, updated_at
    ) VALUES (
      p_paciente_id,
      p_template_id,
      p_perfil_tipo,
      COALESCE(p_respostas, '{}'::jsonb),
      COALESCE(p_completo, false),
      now()
    )
    RETURNING id INTO v_questionario_id;
  END IF;

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
$function$;
