ALTER TABLE public.solicitacoes_vaga ADD COLUMN IF NOT EXISTS nif text;
ALTER TABLE public.solicitacoes_vaga ADD COLUMN IF NOT EXISTS possivel_homonimo boolean NOT NULL DEFAULT false;