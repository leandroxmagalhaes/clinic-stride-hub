-- Tabela para permissões customizadas por utilizador
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  
  -- Permissões por módulo (JSONB para flexibilidade)
  -- Estrutura: { "dashboard": { "view": true, "edit": true, "delete": false, "financial": false }, ... }
  permissions JSONB NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, clinic_id)
);

-- Índices para performance
CREATE INDEX idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_clinic ON public.user_permissions(clinic_id);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem gerenciar permissões da sua clínica
CREATE POLICY "Admins can manage user permissions" 
ON public.user_permissions
FOR ALL
USING (
  has_role(auth.uid(), 'admin') 
  AND clinic_id = get_user_clinic_id(auth.uid())
);

-- Policy: Utilizador pode ver suas próprias permissões
CREATE POLICY "Users can view own permissions" 
ON public.user_permissions
FOR SELECT 
USING (user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();