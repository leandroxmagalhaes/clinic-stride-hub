ALTER TABLE public.sessoes DROP CONSTRAINT IF EXISTS sessoes_status_check;
ALTER TABLE public.sessoes ADD CONSTRAINT sessoes_status_check 
  CHECK (status = ANY (ARRAY[
    'agendado', 'confirmado', 'em_atendimento', 
    'finalizado', 'realizado', 'cancelado', 'faltou', 'falta'
  ]));