
CREATE TABLE IF NOT EXISTS public.portal_diario (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL,
  autor_nome text NOT NULL,
  humor text,
  categoria text DEFAULT 'observation',
  texto text NOT NULL,
  nivel_dor integer,
  tem_foto boolean DEFAULT false,
  foto_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total portal_diario"
  ON public.portal_diario FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.portal_respostas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_id uuid NOT NULL REFERENCES public.portal_diario(id) ON DELETE CASCADE,
  autor_nome text NOT NULL,
  autor_tipo text NOT NULL DEFAULT 'professional',
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total portal_respostas"
  ON public.portal_respostas FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.portal_notificacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  texto_preview text,
  urgente boolean DEFAULT false,
  lida boolean DEFAULT false,
  referencia_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.portal_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total portal_notificacoes"
  ON public.portal_notificacoes FOR ALL
  USING (true)
  WITH CHECK (true);
