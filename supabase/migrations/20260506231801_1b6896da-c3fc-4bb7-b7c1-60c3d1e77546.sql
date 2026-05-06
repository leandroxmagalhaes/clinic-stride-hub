
-- 1) Limpar mensagens antigas (apenas 2 registos) para uniformizar
DELETE FROM public.portal_mensagens;

-- 2) Adicionar coluna tipo + colunas para suportar diário no mesmo fluxo
ALTER TABLE public.portal_mensagens
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'mensagem',
  ADD COLUMN IF NOT EXISTS humor text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS nivel_dor integer;

-- Validação simples via trigger (CHECK seria suficiente, mas mantemos imutável)
ALTER TABLE public.portal_mensagens
  DROP CONSTRAINT IF EXISTS portal_mensagens_tipo_check;
ALTER TABLE public.portal_mensagens
  ADD CONSTRAINT portal_mensagens_tipo_check CHECK (tipo IN ('mensagem','diario'));

-- 3) RPC unificada para enviar mensagem ou entrada de diário
CREATE OR REPLACE FUNCTION public.enviar_mensagem_unificada(
  p_paciente_id uuid,
  p_texto text,
  p_autor_tipo text,
  p_autor_nome text,
  p_tipo text DEFAULT 'mensagem',
  p_humor text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_nivel_dor integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_msg_id uuid;
  v_allowed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_autor_tipo NOT IN ('patient','professional') THEN
    RAISE EXCEPTION 'autor_tipo inválido';
  END IF;

  IF p_tipo NOT IN ('mensagem','diario') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;

  -- Verificar permissão
  IF p_autor_tipo = 'professional' THEN
    v_allowed := public.is_professional(v_user_id);
  ELSE
    v_allowed := EXISTS (
      SELECT 1 FROM public.get_portal_patient_ids(v_user_id) gp
      WHERE gp = p_paciente_id
    );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para enviar nesta conversa';
  END IF;

  INSERT INTO public.portal_mensagens (
    paciente_id, autor_tipo, autor_id, autor_nome,
    texto, tipo, humor, categoria, nivel_dor
  ) VALUES (
    p_paciente_id, p_autor_tipo, v_user_id, p_autor_nome,
    p_texto, p_tipo, p_humor, p_categoria, p_nivel_dor
  )
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

-- 4) RPC para listar thread unificado: mensagens + diário legacy + respostas legacy
CREATE OR REPLACE FUNCTION public.listar_thread_unificado(p_paciente_id uuid)
RETURNS TABLE (
  id uuid,
  paciente_id uuid,
  autor_tipo text,
  autor_nome text,
  texto text,
  tipo text,
  humor text,
  categoria text,
  nivel_dor integer,
  created_at timestamptz,
  origem text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Mensagens (novo fluxo unificado)
  SELECT m.id, m.paciente_id, m.autor_tipo, m.autor_nome, m.texto,
         m.tipo, m.humor, m.categoria, m.nivel_dor, m.created_at,
         'mensagem'::text AS origem
  FROM public.portal_mensagens m
  WHERE m.paciente_id = p_paciente_id

  UNION ALL

  -- Entradas legacy do diário
  SELECT d.id, d.paciente_id, 'patient'::text, d.autor_nome, d.texto,
         'diario'::text, d.humor, d.categoria, d.nivel_dor, d.created_at,
         'diario_legacy'::text
  FROM public.portal_diario d
  WHERE d.paciente_id = p_paciente_id

  UNION ALL

  -- Respostas legacy
  SELECT r.id, p_paciente_id, r.autor_tipo, r.autor_nome, r.texto,
         'mensagem'::text, NULL, NULL, NULL, r.created_at,
         'resposta_legacy'::text
  FROM public.portal_respostas r
  JOIN public.portal_diario d2 ON d2.id = r.diario_id
  WHERE d2.paciente_id = p_paciente_id

  ORDER BY created_at ASC;
$$;
