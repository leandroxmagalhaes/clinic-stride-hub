CREATE OR REPLACE FUNCTION public.listar_conversas_recentes()
RETURNS TABLE (
  paciente_id UUID,
  paciente_nome TEXT,
  ultima_mensagem TEXT,
  ultima_data TIMESTAMPTZ,
  nao_lidas INTEGER,
  ultima_origem TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_professional(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH thread AS (
    -- mensagens unificadas
    SELECT m.paciente_id, m.texto, m.created_at, m.autor_tipo, m.lida_em
    FROM public.portal_mensagens m
    UNION ALL
    -- diário legacy
    SELECT d.paciente_id, d.texto, d.created_at, 'patient'::text, NULL::timestamptz
    FROM public.portal_diario d
    UNION ALL
    -- respostas legacy
    SELECT d2.paciente_id, r.texto, r.created_at, r.autor_tipo, NULL::timestamptz
    FROM public.portal_respostas r
    JOIN public.portal_diario d2 ON d2.id = r.diario_id
  ),
  last_per AS (
    SELECT DISTINCT ON (t.paciente_id)
      t.paciente_id, t.texto, t.created_at
    FROM thread t
    ORDER BY t.paciente_id, t.created_at DESC
  ),
  unread AS (
    SELECT m.paciente_id, count(*)::int AS n
    FROM public.portal_mensagens m
    WHERE m.autor_tipo = 'patient' AND m.lida_em IS NULL
    GROUP BY m.paciente_id
  )
  SELECT
    p.id,
    p.full_name,
    lp.texto,
    lp.created_at,
    COALESCE(u.n, 0),
    'unificado'::text
  FROM last_per lp
  JOIN public.pacientes p ON p.id = lp.paciente_id
  LEFT JOIN unread u ON u.paciente_id = p.id
  WHERE p.clinic_id = public.get_user_clinic_id(auth.uid())
  ORDER BY lp.created_at DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_conversas_recentes() TO authenticated;