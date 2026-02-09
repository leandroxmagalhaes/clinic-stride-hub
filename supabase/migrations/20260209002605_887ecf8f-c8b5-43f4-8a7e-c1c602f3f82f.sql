-- Corrigir Foreign Key: professional_id deve apontar para profiles, não profissionais

-- Remover FK antiga
ALTER TABLE public.horarios_reservados
DROP CONSTRAINT IF EXISTS horarios_reservados_professional_id_fkey;

-- Criar FK correta apontando para profiles
ALTER TABLE public.horarios_reservados
ADD CONSTRAINT horarios_reservados_professional_id_fkey
FOREIGN KEY (professional_id) REFERENCES public.profiles(id);