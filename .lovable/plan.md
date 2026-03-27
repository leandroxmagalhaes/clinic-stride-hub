

## Fix: Specialty Dropdown Showing Only "Motora"

### Root Cause

The native `<select>` element inside `WaitingPatientForm.tsx` is rendered within a container that has `overflow-hidden` (in `QuickPanel.tsx` line 84). On some browsers/viewports, the native dropdown options get clipped by the panel's fixed positioning and overflow constraints, making it appear as if only "Motora" is available.

The code already has all 7 specialties — the issue is purely visual/rendering.

### Fix

**File: `src/components/agenda/quick-panel/WaitingPatientForm.tsx`**

Replace the native `<select>` element (lines 53-59) with the shadcn `Select` component, which renders its dropdown via a **Radix portal** — outside the DOM hierarchy, unaffected by parent overflow constraints.

```tsx
// Replace native <select> with:
<Select value={specialty} onValueChange={setSpecialty}>
  <SelectTrigger className="h-9 text-sm">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {SPECIALTIES.map((s) => (
      <SelectItem key={s} value={s}>{s}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Add import: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";`

**One file changed. Zero visual/layout changes. Zero Supabase changes.**

