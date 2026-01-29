-- Tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_audit_logs_clinic_id ON public.audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários podem inserir e ver logs da própria clínica
CREATE POLICY "Users can insert audit logs in own clinic"
  ON public.audit_logs FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can view audit logs from own clinic"
  ON public.audit_logs FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));