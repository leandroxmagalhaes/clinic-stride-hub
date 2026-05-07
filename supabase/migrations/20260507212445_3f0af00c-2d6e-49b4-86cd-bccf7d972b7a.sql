-- Table for tracking recent patient access by professionals
CREATE TABLE IF NOT EXISTS public.pacientes_acessos_recentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  acessado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pacientes_acessos_user
  ON public.pacientes_acessos_recentes(user_id, acessado_em DESC);

ALTER TABLE public.pacientes_acessos_recentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais gerem os seus acessos recentes"
ON public.pacientes_acessos_recentes
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RPC for shortcut: recent + search
CREATE OR REPLACE FUNCTION public.listar_pacientes_para_atalho(
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  paciente_id UUID,
  paciente_nome TEXT,
  ultima_mensagem TEXT,
  ultima_data TIMESTAMPTZ,
  nao_lidas INTEGER,
  portal_activo BOOLEAN,
  acessado_em TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic UUID;
BEGIN
  IF NOT public.is_professional(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_clinic := public.get_user_clinic_id(auth.uid());

  IF p_query IS NOT NULL AND length(trim(p_query)) >= 2 THEN
    RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      (SELECT pm.texto FROM public.portal_mensagens pm WHERE pm.paciente_id = p.id ORDER BY pm.created_at DESC LIMIT 1),
      (SELECT pm.created_at FROM public.portal_mensagens pm WHERE pm.paciente_id = p.id ORDER BY pm.created_at DESC LIMIT 1),
      (SELECT count(*)::INTEGER FROM public.portal_mensagens pm
        WHERE pm.paciente_id = p.id AND pm.autor_tipo = 'patient' AND pm.lida_em IS NULL),
      EXISTS(SELECT 1 FROM public.portal_contas pc WHERE pc.paciente_id = p.id AND pc.auth_user_id IS NOT NULL),
      (SELECT par.acessado_em FROM public.pacientes_acessos_recentes par
        WHERE par.paciente_id = p.id AND par.user_id = auth.uid())
    FROM public.pacientes p
    WHERE p.clinic_id = v_clinic
      AND (
        p.full_name ILIKE '%' || p_query || '%'
        OR p.email ILIKE '%' || p_query || '%'
        OR p.phone ILIKE '%' || p_query || '%'
      )
    ORDER BY
      (SELECT count(*) FROM public.portal_mensagens pm
        WHERE pm.paciente_id = p.id AND pm.autor_tipo = 'patient' AND pm.lida_em IS NULL) DESC,
      p.full_name ASC
    LIMIT 50;
  ELSE
    RETURN QUERY
    WITH base AS (
      SELECT p.id, p.full_name, par.acessado_em AS sort_at
      FROM public.pacientes p
      INNER JOIN public.pacientes_acessos_recentes par
        ON par.paciente_id = p.id AND par.user_id = auth.uid()
      WHERE p.clinic_id = v_clinic
      UNION
      SELECT p.id, p.full_name,
        (SELECT max(pm.created_at) FROM public.portal_mensagens pm WHERE pm.paciente_id = p.id) AS sort_at
      FROM public.pacientes p
      WHERE p.clinic_id = v_clinic
        AND EXISTS(SELECT 1 FROM public.portal_mensagens pm WHERE pm.paciente_id = p.id)
    )
    SELECT DISTINCT ON (b.id)
      b.id,
      b.full_name,
      (SELECT pm.texto FROM public.portal_mensagens pm WHERE pm.paciente_id = b.id ORDER BY pm.created_at DESC LIMIT 1),
      (SELECT pm.created_at FROM public.portal_mensagens pm WHERE pm.paciente_id = b.id ORDER BY pm.created_at DESC LIMIT 1),
      (SELECT count(*)::INTEGER FROM public.portal_mensagens pm
        WHERE pm.paciente_id = b.id AND pm.autor_tipo = 'patient' AND pm.lida_em IS NULL),
      EXISTS(SELECT 1 FROM public.portal_contas pc WHERE pc.paciente_id = b.id AND pc.auth_user_id IS NOT NULL),
      b.sort_at
    FROM base b
    ORDER BY b.id, b.sort_at DESC NULLS LAST
    LIMIT p_limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_pacientes_para_atalho(TEXT, INTEGER) TO authenticated;