-- =====================================================
-- MIGRAÇÃO: Persistência Completa do Sistema
-- =====================================================

-- 1. TABELA PROFISSIONAIS (separada de profiles/auth)
-- Para profissionais cadastrados pela recepção sem login
CREATE TABLE public.profissionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  council_number TEXT, -- CREFITO, CRM, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  working_hours JSONB DEFAULT '{}', -- {"seg": {"start": "08:00", "end": "18:00"}, ...}
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para profissionais
CREATE INDEX idx_profissionais_clinic ON public.profissionais(clinic_id);
CREATE INDEX idx_profissionais_active ON public.profissionais(clinic_id, is_active);
CREATE UNIQUE INDEX idx_profissionais_email_clinic ON public.profissionais(clinic_id, email) WHERE email IS NOT NULL;

-- RLS para profissionais
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view professionals from own clinic"
ON public.profissionais FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert professionals in own clinic"
ON public.profissionais FOR INSERT
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update professionals in own clinic"
ON public.profissionais FOR UPDATE
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete professionals in own clinic"
ON public.profissionais FOR DELETE
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger updated_at para profissionais
CREATE TRIGGER update_profissionais_updated_at
BEFORE UPDATE ON public.profissionais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. ATUALIZAR TABELA SESSOES (adicionar campos faltantes)
-- =====================================================
ALTER TABLE public.sessoes 
ADD COLUMN IF NOT EXISTS gympass_booking_id TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Índice para Gympass
CREATE INDEX IF NOT EXISTS idx_sessoes_gympass ON public.sessoes(gympass_booking_id) WHERE gympass_booking_id IS NOT NULL;

-- =====================================================
-- 3. CONSTRAINT PARA EVITAR AGENDAMENTOS SOBREPOSTOS
-- =====================================================
-- Função para validar conflito de horário
CREATE OR REPLACE FUNCTION public.check_session_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se existe outra sessão para o mesmo profissional
  -- no mesmo horário (excluindo sessões canceladas)
  IF EXISTS (
    SELECT 1 FROM public.sessoes
    WHERE profissional_id = NEW.profissional_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status NOT IN ('cancelado', 'falta')
      AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Conflito de horário: Este profissional já possui uma sessão neste horário';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para validar antes de inserir/atualizar
DROP TRIGGER IF EXISTS validate_session_overlap ON public.sessoes;
CREATE TRIGGER validate_session_overlap
BEFORE INSERT OR UPDATE ON public.sessoes
FOR EACH ROW
EXECUTE FUNCTION public.check_session_overlap();

-- =====================================================
-- 4. TABELA EVOLUCOES (nova estrutura)
-- =====================================================
CREATE TABLE public.evolucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
  session_id UUID REFERENCES public.sessoes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'evolucao', -- 'evolucao', 'avaliacao', 'alta', 'intercorrencia'
  anexos JSONB DEFAULT '[]', -- [{url, name, type, size}]
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para evoluções
CREATE INDEX idx_evolucoes_clinic ON public.evolucoes(clinic_id);
CREATE INDEX idx_evolucoes_patient ON public.evolucoes(patient_id);
CREATE INDEX idx_evolucoes_professional ON public.evolucoes(professional_id);
CREATE INDEX idx_evolucoes_session ON public.evolucoes(session_id);
CREATE INDEX idx_evolucoes_created ON public.evolucoes(created_at DESC);

-- RLS para evoluções
ALTER TABLE public.evolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evolutions from own clinic"
ON public.evolucoes FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert evolutions in own clinic"
ON public.evolucoes FOR INSERT
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update evolutions in own clinic"
ON public.evolucoes FOR UPDATE
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete evolutions in own clinic"
ON public.evolucoes FOR DELETE
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger updated_at para evoluções
CREATE TRIGGER update_evolucoes_updated_at
BEFORE UPDATE ON public.evolucoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. TABELA TRANSACOES_CREDITO (nova estrutura ledger)
-- =====================================================
CREATE TABLE public.transacoes_credito (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'compra', 'uso', 'estorno', 'expiracao', 'ajuste'
  quantidade INTEGER NOT NULL, -- positivo = entrada, negativo = saída
  session_id UUID REFERENCES public.sessoes(id) ON DELETE SET NULL,
  package_id UUID, -- para referência a pacotes futuros
  valor_pago NUMERIC(10,2), -- valor monetário da transação
  metodo_pagamento TEXT, -- 'mbway', 'multibanco', 'cartao', 'numerario', 'transferencia', 'pix'
  expira_em TIMESTAMP WITH TIME ZONE, -- data de expiração dos créditos
  motivo TEXT, -- descrição/justificativa
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para transações
CREATE INDEX idx_transacoes_credito_clinic ON public.transacoes_credito(clinic_id);
CREATE INDEX idx_transacoes_credito_patient ON public.transacoes_credito(patient_id);
CREATE INDEX idx_transacoes_credito_session ON public.transacoes_credito(session_id);
CREATE INDEX idx_transacoes_credito_created ON public.transacoes_credito(created_at DESC);
CREATE INDEX idx_transacoes_credito_expira ON public.transacoes_credito(expira_em) WHERE expira_em IS NOT NULL;

-- RLS para transações de crédito
ALTER TABLE public.transacoes_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit transactions from own clinic"
ON public.transacoes_credito FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert credit transactions in own clinic"
ON public.transacoes_credito FOR INSERT
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update credit transactions in own clinic"
ON public.transacoes_credito FOR UPDATE
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete credit transactions in own clinic"
ON public.transacoes_credito FOR DELETE
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger para idempotência de uso de crédito por sessão
CREATE OR REPLACE FUNCTION public.check_credit_usage_idempotency_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Só valida para tipo 'uso' com session_id
  IF NEW.tipo = 'uso' AND NEW.session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.transacoes_credito
      WHERE session_id = NEW.session_id
        AND tipo = 'uso'
    ) THEN
      RAISE EXCEPTION 'Crédito já debitado para esta sessão (idempotência)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_credit_idempotency
BEFORE INSERT ON public.transacoes_credito
FOR EACH ROW
EXECUTE FUNCTION public.check_credit_usage_idempotency_v2();

-- =====================================================
-- 6. VIEW SALDO_CREDITOS (saldo atual por paciente)
-- =====================================================
CREATE VIEW public.saldo_creditos
WITH (security_invoker=on) AS
SELECT 
  p.id AS patient_id,
  p.clinic_id,
  p.full_name,
  COALESCE(
    SUM(
      CASE 
        -- Ignora créditos expirados
        WHEN tc.expira_em IS NOT NULL AND tc.expira_em < now() THEN 0
        ELSE tc.quantidade
      END
    ), 
    0
  )::INTEGER AS saldo,
  COUNT(DISTINCT tc.id) FILTER (WHERE tc.tipo = 'compra') AS total_compras,
  MAX(tc.created_at) FILTER (WHERE tc.tipo = 'compra') AS ultima_compra
FROM public.pacientes p
LEFT JOIN public.transacoes_credito tc ON tc.patient_id = p.id
GROUP BY p.id, p.clinic_id, p.full_name;

-- Grant para view
GRANT SELECT ON public.saldo_creditos TO authenticated;

-- =====================================================
-- 7. FUNÇÃO HELPER PARA OBTER SALDO
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_patient_credit_balance(p_patient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN expira_em IS NOT NULL AND expira_em < now() THEN 0
        ELSE quantidade
      END
    ), 
    0
  ) INTO balance
  FROM public.transacoes_credito
  WHERE patient_id = p_patient_id;
  
  RETURN balance;
END;
$$;

-- Grant para função
GRANT EXECUTE ON FUNCTION public.get_patient_credit_balance(UUID) TO authenticated;