-- Fix the patient_credit_balances view to use security_invoker
-- This makes the view respect RLS policies of the underlying tables (pacientes, credit_transactions)

-- Drop the existing view
DROP VIEW IF EXISTS public.patient_credit_balances;

-- Recreate with security_invoker=on to inherit RLS from base tables
CREATE VIEW public.patient_credit_balances
WITH (security_invoker=on) AS
SELECT 
    p.id AS patient_id,
    p.clinic_id,
    p.full_name,
    COALESCE(sum(ct.amount), 0::bigint)::integer AS balance
FROM pacientes p
LEFT JOIN credit_transactions ct ON ct.patient_id = p.id
GROUP BY p.id, p.clinic_id, p.full_name;

-- Grant access to authenticated users (view will respect RLS of underlying tables)
GRANT SELECT ON public.patient_credit_balances TO authenticated;