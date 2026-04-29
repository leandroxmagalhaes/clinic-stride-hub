CREATE OR REPLACE FUNCTION public.ensure_portal_account_link(
  p_paciente_id uuid,
  p_email text DEFAULT NULL,
  p_provider text DEFAULT 'email',
  p_link_token text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_conta_id uuid;
  v_has_valid_invite boolean;
  v_has_existing_link boolean;
  v_is_primary boolean;
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
  ) INTO v_has_existing_link;

  IF p_link_token IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.portal_convites
      WHERE paciente_id = p_paciente_id
        AND link_token = p_link_token
        AND expira_em > now()
    ) INTO v_has_valid_invite;
  ELSE
    v_has_valid_invite := false;
  END IF;

  IF NOT v_has_existing_link AND NOT v_has_valid_invite THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  SELECT id INTO v_conta_id
  FROM public.portal_contas
  WHERE auth_user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_conta_id IS NULL THEN
    INSERT INTO public.portal_contas (
      paciente_id,
      auth_user_id,
      email,
      provider,
      status
    ) VALUES (
      p_paciente_id,
      v_user_id,
      p_email,
      COALESCE(NULLIF(p_provider, ''), 'email'),
      'active'
    )
    RETURNING id INTO v_conta_id;
  ELSE
    UPDATE public.portal_contas
    SET
      paciente_id = COALESCE(paciente_id, p_paciente_id),
      email = COALESCE(NULLIF(p_email, ''), email),
      provider = COALESCE(NULLIF(p_provider, ''), provider),
      status = COALESCE(status, 'active'),
      updated_at = now()
    WHERE id = v_conta_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.portal_conta_pacientes
    WHERE conta_id = v_conta_id
      AND paciente_id = p_paciente_id
  ) THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.portal_conta_pacientes
      WHERE conta_id = v_conta_id
    ) INTO v_is_primary;

    INSERT INTO public.portal_conta_pacientes (
      conta_id,
      paciente_id,
      relacao,
      is_primary
    ) VALUES (
      v_conta_id,
      p_paciente_id,
      'responsavel',
      v_is_primary
    );
  END IF;

  RETURN v_conta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_portal_account_link(uuid, text, text, text) TO authenticated;