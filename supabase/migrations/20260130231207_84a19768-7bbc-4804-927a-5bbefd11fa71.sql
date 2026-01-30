-- =============================================
-- TABELA: relatorios_clinicos
-- Relatórios clínicos para enviar a médicos
-- =============================================

CREATE TABLE public.relatorios_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
  
  -- Dados básicos
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('avaliacao_inicial', 'evolucao_periodica', 'alta', 'progresso_mensal')),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  
  -- Conteúdo clínico
  diagnostico_clinico TEXT,
  objetivo_tratamento TEXT,
  sessoes_realizadas INTEGER DEFAULT 0,
  evolucao_paciente TEXT,
  resultados_obtidos TEXT,
  recomendacoes TEXT,
  observacoes TEXT,
  
  -- Destinatário
  destinatario_nome TEXT,
  destinatario_especialidade TEXT,
  destinatario_identificacao TEXT,
  
  -- Controle de prazo
  data_validade DATE,
  dias_aviso_antecedencia INTEGER DEFAULT 7,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado', 'enviado', 'entregue')),
  
  -- Rastreabilidade
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_relatorios_patient ON public.relatorios_clinicos(patient_id);
CREATE INDEX idx_relatorios_professional ON public.relatorios_clinicos(professional_id);
CREATE INDEX idx_relatorios_clinic ON public.relatorios_clinicos(clinic_id);
CREATE INDEX idx_relatorios_validade ON public.relatorios_clinicos(data_validade) WHERE status NOT IN ('entregue');
CREATE INDEX idx_relatorios_status ON public.relatorios_clinicos(status);

-- Trigger para updated_at
CREATE TRIGGER update_relatorios_clinicos_updated_at
BEFORE UPDATE ON public.relatorios_clinicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- POLÍTICAS RLS
-- =============================================

ALTER TABLE public.relatorios_clinicos ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuários podem ver relatórios da sua clínica
CREATE POLICY "Users can view clinical reports from own clinic"
ON public.relatorios_clinicos FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- INSERT: Admins e profissionais podem criar relatórios
CREATE POLICY "Admins and professionals can create clinical reports"
ON public.relatorios_clinicos FOR INSERT
WITH CHECK (
  clinic_id = get_user_clinic_id(auth.uid())
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'professional'))
);

-- UPDATE: Admins podem atualizar qualquer um, profissionais só os próprios
CREATE POLICY "Users can update clinical reports"
ON public.relatorios_clinicos FOR UPDATE
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin') 
    OR professional_id IN (
      SELECT id FROM public.profissionais 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
);

-- DELETE: Apenas admins podem deletar
CREATE POLICY "Only admins can delete clinical reports"
ON public.relatorios_clinicos FOR DELETE
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);