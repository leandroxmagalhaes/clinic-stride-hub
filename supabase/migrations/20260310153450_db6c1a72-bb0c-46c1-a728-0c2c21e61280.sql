CREATE OR REPLACE FUNCTION public.batch_insert_sessions(p_sessions jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted integer;
BEGIN
  -- Disable overlap trigger for batch imports
  ALTER TABLE public.sessoes DISABLE TRIGGER validate_session_overlap;

  INSERT INTO public.sessoes (
    clinic_id, paciente_id, profissional_id, servico_id,
    start_time, end_time, status, notes, price, payment_status
  )
  SELECT
    (e->>'clinic_id')::uuid,
    (e->>'paciente_id')::uuid,
    (e->>'profissional_id')::uuid,
    (e->>'servico_id')::uuid,
    (e->>'start_time')::timestamptz,
    (e->>'end_time')::timestamptz,
    e->>'status',
    e->>'notes',
    (e->>'price')::numeric,
    e->>'payment_status'
  FROM jsonb_array_elements(p_sessions) AS e;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- Re-enable trigger for individual inserts
  ALTER TABLE public.sessoes ENABLE TRIGGER validate_session_overlap;

  RETURN inserted;
END;
$$;