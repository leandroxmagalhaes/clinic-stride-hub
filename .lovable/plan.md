

# Bypass overlap check for batch scheduling

## Problem
The `validate_session_overlap` trigger on `sessoes` raises an exception when inserting sessions that overlap in time for the same professional. This blocks batch imports where overlaps are intentional.

## Approach
Create a database RPC function (`batch_insert_sessions`) that disables the trigger, inserts all rows, then re-enables it — all within one transaction. Update `BatchSchedulingModal.tsx` to call this RPC instead of direct `.insert()`.

## Changes

### 1. SQL migration — create `batch_insert_sessions` RPC

```sql
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
```

### 2. `BatchSchedulingModal.tsx` — use RPC for both batch paths

**`handleSaveManual` (~line 268)**: Replace `supabase.from("sessoes").insert(inserts)` with `supabase.rpc("batch_insert_sessions", { p_sessions: inserts })`.

**`handleSave` (~line 478)**: Same replacement for the file-import batch path.

Add a code comment in both places:
```ts
// NOTE: Uses batch RPC to bypass the DB trigger `validate_session_overlap`
// which blocks overlapping sessions. Individual scheduling still validates.
```

### 3. No other files changed
The individual scheduling flow (`NewSessionModal`, `SessionService`) continues to hit the trigger normally.

