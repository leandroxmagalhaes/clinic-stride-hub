ALTER TABLE public.solicitacoes_vaga
  ADD COLUMN IF NOT EXISTS paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'novo';

ALTER TABLE public.solicitacoes_vaga
  DROP CONSTRAINT IF EXISTS solicitacoes_vaga_origem_check;

ALTER TABLE public.solicitacoes_vaga
  ADD CONSTRAINT solicitacoes_vaga_origem_check
  CHECK (origem IN ('novo','ativo','inativo'));