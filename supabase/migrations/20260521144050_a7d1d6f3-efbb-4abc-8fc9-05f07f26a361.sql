
-- 1) Custom tags per patient (with soft delete + audit fields)
CREATE TABLE IF NOT EXISTS public.paciente_etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  created_by UUID,
  updated_by UUID,
  deleted_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paciente_etiquetas_paciente
  ON public.paciente_etiquetas(paciente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_paciente_etiquetas_clinic
  ON public.paciente_etiquetas(clinic_id);

ALTER TABLE public.paciente_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tags in own clinic"
ON public.paciente_etiquetas FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert tags in own clinic"
ON public.paciente_etiquetas FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update tags in own clinic"
ON public.paciente_etiquetas FOR UPDATE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- No DELETE policy: soft delete only

CREATE TRIGGER tg_paciente_etiquetas_updated_at
  BEFORE UPDATE ON public.paciente_etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Audit table for tag operations
CREATE TABLE IF NOT EXISTS public.etiquetas_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  etiqueta_id UUID,
  etiqueta_nome TEXT NOT NULL,
  etiqueta_cor TEXT,
  accao TEXT NOT NULL CHECK (accao IN ('criada','editada','excluida','restaurada')),
  valor_anterior TEXT,
  valor_novo TEXT,
  realizado_por UUID NOT NULL,
  realizado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etiquetas_audit_paciente
  ON public.etiquetas_auditoria(paciente_id, created_at DESC);

ALTER TABLE public.etiquetas_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View tag audit in own clinic"
ON public.etiquetas_auditoria FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Insert tag audit in own clinic"
ON public.etiquetas_auditoria FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

-- 3) Portal security audit
CREATE TABLE IF NOT EXISTS public.portal_seguranca_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  accao TEXT NOT NULL CHECK (accao IN ('reset_senha_solicitado','senha_alterada','acesso_bloqueado','acesso_desbloqueado')),
  detalhes JSONB DEFAULT '{}'::jsonb,
  realizado_por UUID NOT NULL,
  realizado_por_nome TEXT,
  realizado_por_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sec_audit_paciente
  ON public.portal_seguranca_auditoria(paciente_id, created_at DESC);

ALTER TABLE public.portal_seguranca_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin views portal security audit"
ON public.portal_seguranca_auditoria FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Professionals can insert portal security audit"
ON public.portal_seguranca_auditoria FOR INSERT TO authenticated
WITH CHECK (public.is_professional(auth.uid()) AND clinic_id = public.get_user_clinic_id(auth.uid()));
