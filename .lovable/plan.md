

## Analysis: `respiratory_reports` Insert — No Migration Needed

### Findings

The `clinic_id` column **already exists** on the `respiratory_reports` table:
- Column: `clinic_id uuid`, nullable, with FK to `clinics(id)`
- RLS policies are in place for INSERT (checks `clinic_id = get_user_clinic_id(auth.uid())`)
- The code in `handleSaveAndReturn` correctly calls `getAuthContext()` and includes `clinic_id: clinicId` in the payload
- There is already 1 record successfully saved in the table

**No database migration is needed.** The column and constraints are already in place.

### Possible Cause of Past 400 Errors

The most likely cause was a **timing issue** — the user may have attempted to save before the migration was applied in a previous session, or before being fully authenticated (causing `getAuthContext()` to fail silently with a null `clinicId`).

### Recommended Defensive Improvement

Add a guard in `handleSaveAndReturn` to validate `clinicId` before attempting the insert:

**File: `src/pages/RelatorioRespiratorio.tsx`** (line ~1436)

```tsx
const { userId, clinicId } = await getAuthContext();
if (!clinicId) {
  toast.error("Clínica não encontrada. Faça login novamente.");
  return;
}
```

This is a one-line guard addition — everything else is already correct and working.

