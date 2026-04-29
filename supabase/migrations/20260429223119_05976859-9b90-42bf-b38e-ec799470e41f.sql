
-- 1. Adicionar coluna tipo aos convites
ALTER TABLE public.portal_convites
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'codigo_otp';

-- 2. Tabela de mensagens do portal
CREATE TABLE IF NOT EXISTS public.portal_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('professional','patient')),
  autor_id uuid,
  autor_nome text NOT NULL,
  texto text NOT NULL,
  lida_em timestamp with time zone,
  broadcast_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_mensagens_paciente_created
  ON public.portal_mensagens(paciente_id, created_at DESC);

ALTER TABLE public.portal_mensagens ENABLE ROW LEVEL SECURITY;

-- RLS: profissionais gerem tudo
CREATE POLICY "Profissionais gerem todas as mensagens"
ON public.portal_mensagens
FOR ALL
USING (is_professional(auth.uid()))
WITH CHECK (is_professional(auth.uid()));

-- RLS: utente vê e cria as suas mensagens
CREATE POLICY "Utente vê as suas mensagens"
ON public.portal_mensagens
FOR SELECT
USING (paciente_id IN (SELECT get_portal_patient_ids(auth.uid())));

CREATE POLICY "Utente envia mensagens nos seus chats"
ON public.portal_mensagens
FOR INSERT
WITH CHECK (
  paciente_id IN (SELECT get_portal_patient_ids(auth.uid()))
  AND autor_tipo = 'patient'
);

CREATE POLICY "Utente marca como lida"
ON public.portal_mensagens
FOR UPDATE
USING (paciente_id IN (SELECT get_portal_patient_ids(auth.uid())));

-- 3. Trigger: quando o profissional envia, cria notificação in-app + chama edge function de email
CREATE OR REPLACE FUNCTION public.on_portal_mensagem_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.autor_tipo = 'professional' THEN
    INSERT INTO public.portal_notificacoes (
      paciente_id, tipo, titulo, texto_preview, urgente, referencia_id
    ) VALUES (
      NEW.paciente_id,
      'mensagem',
      'Nova mensagem da clínica',
      LEFT(NEW.texto, 120),
      false,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_mensagem_insert ON public.portal_mensagens;
CREATE TRIGGER trg_portal_mensagem_insert
  AFTER INSERT ON public.portal_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.on_portal_mensagem_insert();

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_mensagens;
ALTER TABLE public.portal_mensagens REPLICA IDENTITY FULL;

-- 5. RPC para listar conversas do profissional (último msg + não lidas)
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
    AND EXISTS (SELECT 1 FROM public.portal_contas pc WHERE pc.paciente_id = p.id)
  ORDER BY u.created_at DESC NULLS LAST, p.full_name;
$$;
