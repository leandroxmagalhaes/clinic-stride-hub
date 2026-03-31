
-- Table: portal_convites (invite tokens with 6-digit codes)
CREATE TABLE IF NOT EXISTS public.portal_convites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL,
  codigo text NOT NULL,
  link_token text NOT NULL UNIQUE,
  enviado_para_email text,
  enviado_para_telefone text,
  tentativas integer DEFAULT 0,
  max_tentativas integer DEFAULT 3,
  utilizado boolean DEFAULT false,
  expira_em timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access portal_convites"
  ON public.portal_convites FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table: portal_contas (portal accounts)
CREATE TABLE IF NOT EXISTS public.portal_contas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL UNIQUE,
  auth_user_id uuid,
  email text,
  provider text DEFAULT 'email',
  status text DEFAULT 'active',
  onboarding_completo boolean DEFAULT false,
  ultimo_acesso timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access portal_contas"
  ON public.portal_contas FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table: portal_questionario (adaptive health questionnaire)
CREATE TABLE IF NOT EXISTS public.portal_questionario (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL UNIQUE,
  perfil_tipo text NOT NULL,
  dados_pessoais jsonb DEFAULT '{}',
  perfil_saude jsonb DEFAULT '{}',
  expectativas jsonb DEFAULT '{}',
  completo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_questionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access portal_questionario"
  ON public.portal_questionario FOR ALL
  USING (true)
  WITH CHECK (true);
