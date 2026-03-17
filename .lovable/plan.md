

## Fix: Respiratory Reports Not Appearing in History

### Root Cause

Two issues:

1. **RLS policy blocks clinic-wide visibility**: The `respiratory_reports` table has no `clinic_id` column. The only RLS policy is `created_by = auth.uid()` for ALL commands, meaning each user can only see their own reports. If `created_by` isn't set correctly during insert, the row becomes invisible.

2. **No error handling on insert**: `handleSaveAndReturn` doesn't check for errors from the insert/update call, so failures are silent. Also, when returning to history view, the `HistoricoRelatorios` component remounts and refetches — but if the insert failed, there's nothing to fetch.

3. **No `clinic_id` column**: The table lacks `clinic_id`, making it impossible to show all clinic reports. Need to add it and update RLS.

### Plan

**1. Database migration** — Add `clinic_id` column to `respiratory_reports` and update RLS:

```sql
ALTER TABLE public.respiratory_reports ADD COLUMN clinic_id uuid REFERENCES public.clinics(id);

-- Backfill existing rows
UPDATE public.respiratory_reports r
SET clinic_id = p.clinic_id
FROM public.profiles p
WHERE r.created_by = p.user_id;

-- Drop old policy
DROP POLICY "Users can manage their own reports" ON public.respiratory_reports;

-- New policies: clinic-scoped
CREATE POLICY "Users can view reports from own clinic"
ON public.respiratory_reports FOR SELECT TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert reports in own clinic"
ON public.respiratory_reports FOR INSERT TO authenticated
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update reports in own clinic"
ON public.respiratory_reports FOR UPDATE TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete reports in own clinic"
ON public.respiratory_reports FOR DELETE TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));
```

**2. Update `src/pages/RelatorioRespiratorio.tsx`**:

- **`handleSaveAndReturn`**: Add `clinic_id` to the insert/update payload (fetch from profile via `getAuthContext`). Add error handling with console.error and user feedback.
- **`fetchReports`**: Query already has no user filter (correct), but RLS will now scope to clinic automatically.
- **`handleDelete`**: Add error handling.

### Technical Details

- Import `getAuthContext` from `@/lib/auth-helpers`
- In `handleSaveAndReturn`, call `getAuthContext()` to get `clinicId` and include it in `reportData`
- Wrap insert/update in try-catch, show alert on failure
- The `HistoricoRelatorios` component remounts on view change, triggering `fetchReports` via `useEffect` — this is fine, no additional refetch logic needed

