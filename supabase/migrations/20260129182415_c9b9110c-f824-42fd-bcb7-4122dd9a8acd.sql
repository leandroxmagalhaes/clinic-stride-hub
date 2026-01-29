-- Tabela de convites de equipe
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'professional',
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_team_invites_clinic ON public.team_invites(clinic_id);
CREATE INDEX idx_team_invites_email ON public.team_invites(email);
CREATE INDEX idx_team_invites_token ON public.team_invites(token);
CREATE INDEX idx_team_invites_status ON public.team_invites(status);

-- Habilitar RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Política: membros da clínica podem ver convites
CREATE POLICY "Users can view invites from their clinic"
  ON public.team_invites FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Política: admins podem criar convites
CREATE POLICY "Admins can create invites"
  ON public.team_invites FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Política: admins podem atualizar convites
CREATE POLICY "Admins can update invites"
  ON public.team_invites FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Política pública para buscar convite por token (para signup)
CREATE POLICY "Anyone can read invite by token"
  ON public.team_invites FOR SELECT
  USING (true);

-- Função para processar convite após signup (SECURITY DEFINER para bypass RLS)
CREATE OR REPLACE FUNCTION public.process_team_invite(invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
BEGIN
  -- Buscar o convite válido
  SELECT * INTO v_invite FROM public.team_invites
  WHERE token = invite_token AND status = 'pending' AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Obter user_id do utilizador atual
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilizador não autenticado');
  END IF;
  
  -- Atualizar o perfil com a clínica
  UPDATE public.profiles
  SET clinic_id = v_invite.clinic_id
  WHERE user_id = v_user_id;
  
  -- Remover role de patient se existir (utilizador está a ser convidado como staff)
  DELETE FROM public.user_roles 
  WHERE user_id = v_user_id AND role = 'patient';
  
  -- Adicionar o role do convite
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Marcar convite como aceito
  UPDATE public.team_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;
  
  RETURN jsonb_build_object('success', true, 'clinic_id', v_invite.clinic_id, 'role', v_invite.role);
END;
$$;

-- Função para buscar detalhes do convite (pública, para página de signup)
CREATE OR REPLACE FUNCTION public.get_invite_details(invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_clinic_name TEXT;
BEGIN
  -- Buscar o convite
  SELECT ti.*, c.name as clinic_name 
  INTO v_invite 
  FROM public.team_invites ti
  JOIN public.clinics c ON c.id = ti.clinic_id
  WHERE ti.token = invite_token AND ti.status = 'pending' AND ti.expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'full_name', v_invite.full_name,
    'role', v_invite.role,
    'clinic_name', v_invite.clinic_name
  );
END;
$$;