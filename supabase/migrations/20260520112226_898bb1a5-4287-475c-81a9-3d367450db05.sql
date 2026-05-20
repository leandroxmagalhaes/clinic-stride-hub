
-- 1. Tighten portal_convites: drop blanket anon read/update policies
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.portal_convites;
DROP POLICY IF EXISTS "Anon can read invite by token" ON public.portal_convites;
DROP POLICY IF EXISTS "Anon can update invite attempts" ON public.portal_convites;

-- Allow portal users (patients) to read their own invites for legitimate flows
CREATE POLICY "Portal users can view own invites"
  ON public.portal_convites
  FOR SELECT
  TO authenticated
  USING (paciente_id IN (SELECT get_portal_patient_ids(auth.uid())));

-- Token-scoped lookup via SECURITY DEFINER RPC (replaces anon SELECT-by-token)
CREATE OR REPLACE FUNCTION public.get_portal_invite_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  paciente_id uuid,
  enviado_para_email text,
  expira_em timestamptz,
  utilizado boolean,
  tipo text,
  template_id uuid,
  tentativas integer,
  max_tentativas integer,
  codigo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, paciente_id, enviado_para_email, expira_em, utilizado, tipo,
         template_id, tentativas, max_tentativas, codigo
  FROM public.portal_convites
  WHERE link_token = p_token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_portal_invite_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_portal_invite_by_token(text) TO anon, authenticated;

-- Scoped increment (only the matched token, only the tentativas column)
CREATE OR REPLACE FUNCTION public.increment_portal_invite_attempts(p_token text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_attempts integer;
BEGIN
  UPDATE public.portal_convites
  SET tentativas = COALESCE(tentativas, 0) + 1
  WHERE link_token = p_token
    AND utilizado = false
    AND expira_em > now()
  RETURNING tentativas INTO new_attempts;
  RETURN new_attempts;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_portal_invite_attempts(text) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_portal_invite_attempts(text) TO anon, authenticated;

-- 2. Tighten team_invites: drop blanket anon read policy
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.team_invites;

-- Token-scoped + email-scoped RPCs
CREATE OR REPLACE FUNCTION public.get_team_invite_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role app_role,
  clinic_id uuid,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, full_name, role, clinic_id, status, expires_at
  FROM public.team_invites
  WHERE token = p_token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_team_invite_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_invite_by_token(text) TO anon, authenticated;

-- Returns a pending team invite for the currently authenticated user's own email only
CREATE OR REPLACE FUNCTION public.get_pending_team_invite_for_me()
RETURNS TABLE (
  token text,
  role app_role,
  full_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  IF v_email IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT ti.token, ti.role, ti.full_name
  FROM public.team_invites ti
  WHERE lower(ti.email) = v_email
    AND ti.status = 'pending'
    AND ti.expires_at > now()
  ORDER BY ti.created_at DESC
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.get_pending_team_invite_for_me() FROM public;
GRANT EXECUTE ON FUNCTION public.get_pending_team_invite_for_me() TO authenticated;

-- 3. portal_questionario_historico: scope INSERT to professionals or owning patient
DROP POLICY IF EXISTS "Authenticated can insert history" ON public.portal_questionario_historico;
CREATE POLICY "Scoped insert history"
  ON public.portal_questionario_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_professional(auth.uid())
    OR paciente_id IN (SELECT get_portal_patient_ids(auth.uid()))
  );

-- 4. portal_questionario_templates: don't expose clinic-specific templates to anon
DROP POLICY IF EXISTS "Anyone authenticated can view active templates" ON public.portal_questionario_templates;
-- Anon: only public/system templates (used by /pre-registo flow)
CREATE POLICY "Anon can view active public templates"
  ON public.portal_questionario_templates
  FOR SELECT
  TO anon
  USING (is_active = true AND clinic_id IS NULL);
-- Authenticated users: see active templates from their clinic or system-wide
CREATE POLICY "Authenticated can view active templates in scope"
  ON public.portal_questionario_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (clinic_id IS NULL OR clinic_id = get_user_clinic_id(auth.uid()))
  );
