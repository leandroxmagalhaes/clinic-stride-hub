
-- Enums
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('mbway','multibanco','dinheiro','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pendente','pago','expirado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessoes(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  method public.payment_method,
  status public.payment_status NOT NULL DEFAULT 'pendente',

  ifthenpay_request_id text,
  mb_entity text,
  mb_reference text,
  mbway_phone text,

  invoice_issued boolean NOT NULL DEFAULT false,
  toconline_invoice_id text,

  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_payment_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_mb_reference ON public.payments(mb_reference);
CREATE INDEX IF NOT EXISTS idx_payments_ifthenpay_request ON public.payments(ifthenpay_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_clinic ON public.payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON public.payments(patient_id);

-- GRANTs (obrigatório para Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_clinic"
  ON public.payments FOR SELECT
  TO authenticated
  USING (clinic_id IS NULL OR clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "payments_insert_staff"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','professional','secretary')
    )
  );

CREATE POLICY "payments_update_staff"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','professional','secretary')
    )
  );

CREATE POLICY "payments_delete_admin"
  ON public.payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- updated_at trigger (reusa função existente)
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- View de pendentes (usa security_invoker para respeitar RLS do chamador)
DROP VIEW IF EXISTS public.v_pending_payments;
CREATE VIEW public.v_pending_payments
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.session_id,
  p.patient_id,
  p.clinic_id,
  pa.full_name AS patient_name,
  pa.phone AS patient_phone,
  p.amount,
  p.method,
  p.mb_entity,
  p.mb_reference,
  p.created_at,
  now() - p.created_at AS pending_for
FROM public.payments p
JOIN public.pacientes pa ON pa.id = p.patient_id
WHERE p.status = 'pendente';

GRANT SELECT ON public.v_pending_payments TO authenticated;
GRANT ALL ON public.v_pending_payments TO service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
