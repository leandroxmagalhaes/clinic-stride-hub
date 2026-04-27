
-- 1) Garantir unicidade nas associações conta↔utente
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_conta_pacientes_unique
  ON public.portal_conta_pacientes (conta_id, paciente_id);

-- 2) Função única para resolver a melhor conta válida do utilizador no portal.
--    Devolve uma linha por (conta_id, paciente_id) ainda válido, ordenado por:
--    - conta com onboarding completo primeiro
--    - associação primária primeiro
--    - mais recente
CREATE OR REPLACE FUNCTION public.portal_resolve_account(p_user_id uuid)
RETURNS TABLE (
  conta_id uuid,
  paciente_id uuid,
  onboarding_completo boolean,
  is_primary boolean,
  paciente_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pc.id              AS conta_id,
    pcp.paciente_id    AS paciente_id,
    COALESCE(pc.onboarding_completo, false) AS onboarding_completo,
    COALESCE(pcp.is_primary, false)         AS is_primary,
    p.full_name        AS paciente_nome
  FROM public.portal_contas pc
  LEFT JOIN public.portal_conta_pacientes pcp ON pcp.conta_id = pc.id
  LEFT JOIN public.pacientes p ON p.id = pcp.paciente_id
  WHERE pc.auth_user_id = p_user_id
    AND p.id IS NOT NULL  -- só associações com utente real (descarta órfãs)
  ORDER BY
    COALESCE(pc.onboarding_completo, false) DESC,
    COALESCE(pcp.is_primary, false) DESC,
    pc.updated_at DESC NULLS LAST,
    pc.created_at DESC NULLS LAST;
$$;

-- 3) Limpeza segura: remover associações órfãs (paciente inexistente)
DELETE FROM public.portal_conta_pacientes pcp
WHERE NOT EXISTS (
  SELECT 1 FROM public.pacientes p WHERE p.id = pcp.paciente_id
);

-- 4) Limpeza: remover questionários ligados a utentes inexistentes
DELETE FROM public.portal_questionario q
WHERE NOT EXISTS (
  SELECT 1 FROM public.pacientes p WHERE p.id = q.paciente_id
);

-- 5) Limpeza: remover contas portal sem nenhuma associação válida E sem
--    paciente_id legacy válido (evita "Conta não associada" para sempre).
DELETE FROM public.portal_contas pc
WHERE NOT EXISTS (
    SELECT 1 FROM public.portal_conta_pacientes pcp
    WHERE pcp.conta_id = pc.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.pacientes p WHERE p.id = pc.paciente_id
  );
