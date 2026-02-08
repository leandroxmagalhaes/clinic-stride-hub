-- =====================================================
-- TABELA: horarios_reservados (Bloqueios Recorrentes)
-- =====================================================

CREATE TABLE public.horarios_reservados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
  
  -- Tipo de bloqueio: 'fixo' (padrão semanal) ou 'personalizado' (datas específicas)
  tipo TEXT NOT NULL DEFAULT 'fixo' CHECK (tipo IN ('fixo', 'personalizado')),
  titulo TEXT NOT NULL,
  
  -- Para tipo 'fixo': dias da semana (1=Segunda, 7=Domingo - ISO)
  dias_semana INTEGER[],
  horario_inicio TIME NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  
  -- Para tipo 'personalizado': array de {dia: INTEGER, hora: TIME}
  horarios_personalizados JSONB,
  
  -- Período de validade
  data_inicio DATE NOT NULL,
  data_fim DATE,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'cancelado')),
  cor TEXT DEFAULT '#FCD34D',
  observacoes TEXT,
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentário da tabela
COMMENT ON TABLE public.horarios_reservados IS 'Horários reservados recorrentes para pacientes (bloqueios fixos ou personalizados)';

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_horarios_reservados_clinic ON public.horarios_reservados(clinic_id);
CREATE INDEX idx_horarios_reservados_patient ON public.horarios_reservados(patient_id);
CREATE INDEX idx_horarios_reservados_professional ON public.horarios_reservados(professional_id) WHERE professional_id IS NOT NULL;
CREATE INDEX idx_horarios_reservados_status_ativo ON public.horarios_reservados(status) WHERE status = 'ativo';
CREATE INDEX idx_horarios_reservados_data_inicio ON public.horarios_reservados(data_inicio);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.horarios_reservados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reservations from own clinic"
  ON public.horarios_reservados FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can create reservations in own clinic"
  ON public.horarios_reservados FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update reservations in own clinic"
  ON public.horarios_reservados FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete reservations in own clinic"
  ON public.horarios_reservados FOR DELETE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- =====================================================
-- TRIGGER: updated_at automático
-- =====================================================

CREATE TRIGGER update_horarios_reservados_updated_at
  BEFORE UPDATE ON public.horarios_reservados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNÇÃO HELPER: check_horario_reservado
-- Verifica se um horário específico está bloqueado
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_horario_reservado(
  p_date DATE,
  p_time TIME,
  p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE (
  reservado BOOLEAN,
  reservation_id UUID,
  patient_id UUID,
  patient_name TEXT,
  tipo TEXT,
  cor TEXT,
  titulo TEXT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as reservado,
    hr.id as reservation_id,
    hr.patient_id,
    pac.full_name as patient_name,
    hr.tipo,
    hr.cor,
    hr.titulo
  FROM public.horarios_reservados hr
  INNER JOIN public.pacientes pac ON pac.id = hr.patient_id
  WHERE hr.status = 'ativo'
    AND hr.clinic_id = get_user_clinic_id(auth.uid())
    AND (p_professional_id IS NULL OR hr.professional_id IS NULL OR hr.professional_id = p_professional_id)
    AND p_date >= hr.data_inicio
    AND (hr.data_fim IS NULL OR p_date <= hr.data_fim)
    AND (
      -- Tipo FIXO: verifica dia da semana e horário
      (hr.tipo = 'fixo' 
       AND EXTRACT(ISODOW FROM p_date)::INTEGER = ANY(hr.dias_semana)
       AND hr.horario_inicio = p_time)
      OR
      -- Tipo PERSONALIZADO: verifica no JSONB
      (hr.tipo = 'personalizado'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(hr.horarios_personalizados) elem
         WHERE (elem->>'dia')::INTEGER = EXTRACT(ISODOW FROM p_date)::INTEGER
         AND (elem->>'hora')::TIME = p_time
       ))
    )
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.check_horario_reservado IS 'Verifica se um horário específico está bloqueado por uma reserva recorrente';