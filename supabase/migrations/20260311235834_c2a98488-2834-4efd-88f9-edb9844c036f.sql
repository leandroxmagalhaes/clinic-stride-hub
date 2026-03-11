ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS tipo_agendamento TEXT NOT NULL DEFAULT 'avulso';
ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS pack_grupo_id UUID;
ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS valor_sessao NUMERIC(10,2);
ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS valor_pack_total NUMERIC(10,2);
ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS pagamento_estado TEXT DEFAULT 'pendente';
ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS pagamento_metodo TEXT;
ALTER TABLE public.sessoes ADD COLUMN IF NOT EXISTS pagamento_data DATE;