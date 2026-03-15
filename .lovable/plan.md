

## Add debug logs to `send-automation-email`

### Verification results
- **`automation_flows.message_template`** — correct, matches the column in the DB schema
- **`profissionais.full_name`** — correct, matches the column in the DB schema

No field name corrections are needed.

### Changes

**File: `supabase/functions/send-automation-email/index.ts`**

Add 3 `console.log` statements:

1. **After `req.json()` (line 24):** `console.log('DEBUG body:', { flowId, pacienteId, sessaoId, triggerType, clinicId })`
2. **After fetching the flow (line 36):** `console.log('DEBUG flow:', JSON.stringify(flow))`
3. **Inside the `if (session)` block (line 86):** `console.log('DEBUG session:', JSON.stringify(session))`

Then deploy the edge function.

