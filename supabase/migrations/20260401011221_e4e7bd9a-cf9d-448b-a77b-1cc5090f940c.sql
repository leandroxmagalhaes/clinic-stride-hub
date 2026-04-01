
-- Security definer function to check professional status without RLS recursion
CREATE OR REPLACE FUNCTION public.is_professional(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
    AND role IN ('admin', 'professional', 'admin_master', 'fisioterapeuta')
  )
$$;

-- Helper: get patient IDs linked to a portal account by auth user
CREATE OR REPLACE FUNCTION public.get_portal_patient_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pcp.paciente_id
  FROM public.portal_conta_pacientes pcp
  JOIN public.portal_contas pc ON pc.id = pcp.conta_id
  WHERE pc.auth_user_id = p_user_id
$$;

-- portal_diario: tighten RLS
DROP POLICY IF EXISTS "Acesso total portal_diario" ON portal_diario;

CREATE POLICY "Profissionais gerem todo o diario"
  ON portal_diario FOR ALL
  USING (public.is_professional(auth.uid()))
  WITH CHECK (public.is_professional(auth.uid()));

CREATE POLICY "Pacientes veem os seus registos diario"
  ON portal_diario FOR SELECT
  USING (paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid())));

CREATE POLICY "Pacientes inserem nos seus registos diario"
  ON portal_diario FOR INSERT
  WITH CHECK (paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid())));

-- portal_questionario: tighten RLS
DROP POLICY IF EXISTS "Acesso total portal_questionario" ON portal_questionario;

CREATE POLICY "Profissionais gerem todos os questionarios"
  ON portal_questionario FOR ALL
  USING (public.is_professional(auth.uid()))
  WITH CHECK (public.is_professional(auth.uid()));

CREATE POLICY "Pacientes veem o seu questionario"
  ON portal_questionario FOR SELECT
  USING (paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid())));

CREATE POLICY "Pacientes editam o seu questionario"
  ON portal_questionario FOR UPDATE
  USING (paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid())));

CREATE POLICY "Pacientes inserem o seu questionario"
  ON portal_questionario FOR INSERT
  WITH CHECK (paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid())));

-- portal_notificacoes: tighten RLS
DROP POLICY IF EXISTS "Acesso total portal_notificacoes" ON portal_notificacoes;

CREATE POLICY "Profissionais gerem todas as notificacoes"
  ON portal_notificacoes FOR ALL
  USING (public.is_professional(auth.uid()))
  WITH CHECK (public.is_professional(auth.uid()));

CREATE POLICY "Pacientes veem as suas notificacoes"
  ON portal_notificacoes FOR SELECT
  USING (paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid())));

-- portal_respostas: tighten RLS
DROP POLICY IF EXISTS "Acesso total portal_respostas" ON portal_respostas;

CREATE POLICY "Profissionais gerem todas as respostas"
  ON portal_respostas FOR ALL
  USING (public.is_professional(auth.uid()))
  WITH CHECK (public.is_professional(auth.uid()));

CREATE POLICY "Pacientes veem respostas dos seus diarios"
  ON portal_respostas FOR SELECT
  USING (diario_id IN (
    SELECT id FROM public.portal_diario
    WHERE paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid()))
  ));

CREATE POLICY "Pacientes inserem respostas nos seus diarios"
  ON portal_respostas FOR INSERT
  WITH CHECK (diario_id IN (
    SELECT id FROM public.portal_diario
    WHERE paciente_id IN (SELECT public.get_portal_patient_ids(auth.uid()))
  ));

-- portal_contas: tighten RLS
DROP POLICY IF EXISTS "Acesso total portal_contas" ON portal_contas;

CREATE POLICY "Profissionais gerem todas as contas"
  ON portal_contas FOR ALL
  USING (public.is_professional(auth.uid()))
  WITH CHECK (public.is_professional(auth.uid()));

CREATE POLICY "Pacientes veem a sua conta"
  ON portal_contas FOR SELECT
  USING (auth_user_id = auth.uid());

-- portal_conta_pacientes: tighten RLS
DROP POLICY IF EXISTS "Acesso total portal_conta_pacientes" ON portal_conta_pacientes;

CREATE POLICY "Profissionais gerem todas as associacoes"
  ON portal_conta_pacientes FOR ALL
  USING (public.is_professional(auth.uid()))
  WITH CHECK (public.is_professional(auth.uid()));

CREATE POLICY "Pacientes veem as suas associacoes"
  ON portal_conta_pacientes FOR SELECT
  USING (conta_id IN (
    SELECT id FROM public.portal_contas WHERE auth_user_id = auth.uid()
  ));
