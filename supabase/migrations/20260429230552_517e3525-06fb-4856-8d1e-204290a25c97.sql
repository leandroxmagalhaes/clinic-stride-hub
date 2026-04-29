CREATE OR REPLACE FUNCTION public.list_portal_conversations(p_clinic_id uuid)
RETURNS TABLE(
  paciente_id uuid,
  paciente_nome text,
  paciente_email text,
  ultima_mensagem text,
  ultima_mensagem_em timestamp with time zone,
  ultima_autor_tipo text,
  nao_lidas integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ultimas AS (
    SELECT DISTINCT ON (m.paciente_id)
      m.paciente_id, m.texto, m.created_at, m.autor_tipo
    FROM public.portal_mensagens m
    JOIN public.pacientes p ON p.id = m.paciente_id
    WHERE p.clinic_id = p_clinic_id
    ORDER BY m.paciente_id, m.created_at DESC
  ),
  nao_lidas AS (
    SELECT m.paciente_id, COUNT(*)::int AS total
    FROM public.portal_mensagens m
    JOIN public.pacientes p ON p.id = m.paciente_id
    WHERE p.clinic_id = p_clinic_id
      AND m.autor_tipo = 'patient'
      AND m.lida_em IS NULL
    GROUP BY m.paciente_id
  )
  SELECT
    p.id,
    p.full_name,
    p.email,
    u.texto,
    u.created_at,
    u.autor_tipo,
    COALESCE(n.total, 0)
  FROM public.pacientes p
  LEFT JOIN ultimas u ON u.paciente_id = p.id
  LEFT JOIN nao_lidas n ON n.paciente_id = p.id
  WHERE p.clinic_id = p_clinic_id
    AND (
      EXISTS (SELECT 1 FROM public.portal_contas pc WHERE pc.paciente_id = p.id)
      OR EXISTS (SELECT 1 FROM public.portal_mensagens m2 WHERE m2.paciente_id = p.id)
    )
  ORDER BY u.created_at DESC NULLS LAST, p.full_name;
$$;