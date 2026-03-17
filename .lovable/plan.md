

## Fix: Respiratory Reports — Two Critical Bugs

### BUG 1 — History not loading after save

**Root Cause**: The save logic (`handleSaveAndReturn`) works correctly and switches to `view="history"`. However, `HistoricoRelatorios` is a separate component that runs `fetchReports` on mount via `useEffect`. The component unmounts when `view="new"` and remounts when `view="history"` — this should trigger a refetch. The save itself appears correct (with `clinic_id` and `created_by` from `getAuthContext`).

The likely issue is that `(supabase as any)` type casting may be masking type errors. Additionally, there's no `created_at` or `updated_at` in the select query, but that shouldn't prevent data from appearing. Let me verify — the `fetchReports` query on line 1238-1241 uses `.select("id, patient_name, report_date, data")` which should work.

**Fix**: Add `console.log` to `fetchReports` for error visibility, and also add `created_at` to the select + order by `created_at` (not `report_date`) so newly created reports appear first. Also ensure that `data` field in the select includes everything needed for the "Gerar novamente" flow.

The more likely root cause is that there's no "Gerar novamente" button — only Edit and Delete exist. The user expects a "Gerar novamente" option. Add this button.

### BUG 2 — Fields lose focus on every keystroke

**Root Cause**: Line 576-578 creates a `Field` wrapper component inside `StepEditor` using `useCallback` with `[data, setData]` as dependencies. Since `data` changes on every keystroke, `Field` gets a new reference, and React treats `<Field>` as a new component type — unmounting the old input and mounting a new one, destroying focus. The `EditorField` memo is completely bypassed.

Additionally, the progressao tab inputs (lines 699-718) directly use `onChange` handlers that call `updateProgressao` which updates `data`, but those inputs are inline `<input>` elements (not wrapped in a component that gets recreated), so they should be fine.

**Fix**: Remove the `Field` wrapper entirely. Replace all `<Field label="..." fieldKey="..." />` usages with `<EditorField label="..." fieldKey="..." data={data} setData={setData} />` directly. This ensures `EditorField`'s `React.memo` works properly — it only re-renders when its specific `fieldKey`'s value in `data` changes (well, it will re-render when `data` ref changes, but it won't unmount/remount since the component identity is stable).

### Changes

**File: `src/pages/RelatorioRespiratorio.tsx`**

1. **Remove the `Field` wrapper** (line 576-578) inside `StepEditor`
2. **Replace all `<Field ...>` with `<EditorField ... data={data} setData={setData}>`** throughout `StepEditor` (lines 614-669)
3. **Add error logging to `fetchReports`** — log error if fetch fails
4. **Add "Gerar novamente" button** to each report row in `HistoricoRelatorios` (opens the report in step 4 / preview mode)

