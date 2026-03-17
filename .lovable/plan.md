

## Fix: Input Fields Losing Focus on Every Keystroke

### Root Cause

`Field` component is defined **inside** `StepEditor` (line 530). Every time `setData` is called (on each keystroke), `StepEditor` re-renders, creating a **new** `Field` function reference. React treats it as a different component type, unmounting the old input and mounting a new one — destroying focus.

### Fix

**File: `src/pages/RelatorioRespiratorio.tsx`**

Move `Field` **outside** `StepEditor` as a standalone memoized component that receives `data`, `setData`, `fieldKey`, `label`, `type`, and `rows` as props.

```tsx
// Defined OUTSIDE StepEditor, at module level
const Field = React.memo(function Field({ label: lbl, fieldKey, data, setData, type = "text", rows = 3 }) {
  const handleChange = useCallback((e) => {
    setData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  }, [fieldKey, setData]);

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={label()}>{lbl}</label>
      {type === "textarea" ? (
        <textarea value={data[fieldKey] || ""} rows={rows} onChange={handleChange} style={...} />
      ) : (
        <input type={type} value={data[fieldKey] || ""} onChange={handleChange} style={...} />
      )}
    </div>
  );
});
```

Additionally, `setData` in the parent must use the **functional updater** pattern (`setData(prev => ...)`) instead of `setData({ ...data, ... })` so that `Field` can have a stable `setData` reference via `useCallback`.

**Changes needed:**
1. Move `Field` outside `StepEditor` to module level, wrap with `React.memo`
2. Add `data` and `setData` as explicit props to `Field`
3. Use functional updater in `handleChange`: `setData(prev => ({ ...prev, [fieldKey]: e.target.value }))`
4. Update all `<Field ... />` usages inside `StepEditor` to pass `data={data} setData={setData}`
5. Similarly fix `updateProgressao` to use functional updater

