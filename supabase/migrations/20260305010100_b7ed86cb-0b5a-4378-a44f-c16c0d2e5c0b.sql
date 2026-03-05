
-- Fix search_path on new functions
CREATE OR REPLACE FUNCTION public.validate_pack_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status NOT IN ('pago', 'pendente', 'parcial') THEN
    RAISE EXCEPTION 'payment_status inválido: %. Valores permitidos: pago, pendente, parcial', NEW.payment_status;
  END IF;
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('cash','mbway','multibanco','transferencia','cartao','pix') THEN
    RAISE EXCEPTION 'payment_method inválido: %', NEW.payment_method;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_pack_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.numero_pack := COALESCE(
    (SELECT MAX(numero_pack) FROM public.packs WHERE paciente_id = NEW.paciente_id AND clinic_id = NEW.clinic_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_packs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Fix security definer view by making it SECURITY INVOKER
DROP VIEW IF EXISTS public.packs_com_contagem;
CREATE VIEW public.packs_com_contagem WITH (security_invoker = true) AS
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
