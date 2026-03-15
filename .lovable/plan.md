

## Fix professional lookup in `send-automation-email`

### Root Cause

The `sessoes.profissional_id` column stores `profiles.id` values (e.g. `3ef68f68-...`), **not** `profissionais.id` values (e.g. `e159f8b3-...`). The Edge Function queries `profissionais` directly with this ID, so it always returns null.

Database evidence:
- `sessoes.profissional_id` = `3ef68f68-...` → exists in `profiles` as profile ID
- `profissionais` table only has `e159f8b3-...` for the same person
- They share the same email (`te.camila@gmail.com`)

### Fix

**File: `supabase/functions/send-automation-email/index.ts`**

Change the professional lookup to query `profiles` instead of `profissionais`:

```typescript
// BEFORE (broken):
const { data: prof, error: profError } = await supabase
  .from("profissionais")
  .select("full_name")
  .eq("id", session.profissional_id)
  .single();

// AFTER (fixed):
const { data: prof, error: profError } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("id", session.profissional_id)
  .single();
```

Keep the existing debug logs. Deploy the function.

