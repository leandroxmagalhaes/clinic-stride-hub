
-- 1. Criar tabela packs
CREATE TABLE IF NOT EXISTS public.packs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id        uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  numero_pack      integer NOT NULL DEFAULT 1,
  data_inicio      date NOT NULL,
  quantidade_sessoes integer NOT NULL DEFAULT 10,
  sessoes_usadas   integer NOT NULL DEFAULT 0,
  valor_total      numeric(10,2) NOT NULL DEFAULT 0,
  payment_status   text NOT NULL DEFAULT 'pendente',
  payment_method   text,
  paid_at          timestamptz,
  notes            text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_packs_paciente ON public.packs(paciente_id);
CREATE INDEX IF NOT EXISTS idx_packs_clinic   ON public.packs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_packs_active   ON public.packs(paciente_id, is_active);

-- 3. Validation trigger para payment_status (em vez de CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_pack_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status NOT IN ('pago', 'pendente', 'parcial') THEN
    RAISE EXCEPTION 'payment_status inválido: %. Valores permitidos: pago, pendente, parcial', NEW.payment_status;
  END IF;
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('cash','mbway','multibanco','transferencia','cartao','pix') THEN
    RAISE EXCEPTION 'payment_method inválido: %', NEW.payment_method;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_pack_payment
  BEFORE INSERT OR UPDATE ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.validate_pack_payment_status();

-- 4. RLS
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packs_select_own_clinic" ON public.packs
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "packs_insert_own_clinic" ON public.packs
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "packs_update_own_clinic" ON public.packs
  FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "packs_delete_own_clinic" ON public.packs
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- 5. Trigger auto-incrementar numero_pack por paciente
CREATE OR REPLACE FUNCTION public.set_pack_numero()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_pack := COALESCE(
    (SELECT MAX(numero_pack) FROM public.packs WHERE paciente_id = NEW.paciente_id AND clinic_id = NEW.clinic_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pack_numero
  BEFORE INSERT ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.set_pack_numero();

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_packs_updated_at
  BEFORE UPDATE ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.update_packs_updated_at();

-- 7. View packs_com_contagem (usa package_id que já existe na tabela sessoes)
CREATE OR REPLACE VIEW public.packs_com_contagem AS
SELECT
  p.*,
  pac.full_name AS paciente_nome,
  COUNT(s.id) FILTER (WHERE s.status = 'realizado') AS sessoes_realizadas_real,
  COUNT(s.id) AS sessoes_associadas,
  p.quantidade_sessoes - p.sessoes_usadas AS sessoes_restantes,
  CASE
    WHEN p.sessoes_usadas >= p.quantidade_sessoes THEN 'esgotado'
    WHEN p.sessoes_usadas >= p.quantidade_sessoes - 1 THEN 'ultima_sessao'
    WHEN p.sessoes_usadas >= p.quantidade_sessoes - 2 THEN 'penultima_sessao'
    ELSE 'activo'
  END AS alert_status
FROM public.packs p
JOIN public.pacientes pac ON pac.id = p.paciente_id
LEFT JOIN public.sessoes s ON s.package_id = p.id
GROUP BY p.id, pac.full_name;
