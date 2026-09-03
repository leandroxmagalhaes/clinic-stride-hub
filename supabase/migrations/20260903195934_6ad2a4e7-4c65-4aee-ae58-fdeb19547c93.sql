ALTER TABLE public.pacientes
ADD COLUMN estado_restricao text;

ALTER TABLE public.pacientes
ADD CONSTRAINT pacientes_estado_restricao_check
CHECK (estado_restricao IS NULL OR estado_restricao IN ('indisponivel', 'arquivado')) NOT VALID;

ALTER TABLE public.pacientes
ADD CONSTRAINT pacientes_estado_restricao_consistencia
CHECK (is_active IS FALSE OR estado_restricao IS NULL) NOT VALID;