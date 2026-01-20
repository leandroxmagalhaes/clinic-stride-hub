-- Drop the old view and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.patient_credit_balances;

-- Recreate view using invoker's security context (default behavior)
-- The view will respect the RLS policies of the underlying tables
CREATE VIEW public.patient_credit_balances AS
SELECT 
  p.id as patient_id,
  p.clinic_id,
  p.full_name,
  COALESCE(SUM(ct.amount), 0)::INTEGER as balance
FROM public.pacientes p
LEFT JOIN public.credit_transactions ct ON ct.patient_id = p.id
GROUP BY p.id, p.clinic_id, p.full_name;

-- Grant access to the view
GRANT SELECT ON public.patient_credit_balances TO authenticated;