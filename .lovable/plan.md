

## Fix: Packs Modal Freezing on Close

### Root Cause

In `PatientDetailModal.tsx`, the `PackManagerModal` is embedded **inline** within a tab:

```tsx
<PackManagerModal isOpen={true} onClose={() => {}} ... />
```

- `isOpen` is hardcoded to `true`
- `onClose` is a no-op `() => {}`

The `PackManagerModal` renders a full `<Dialog>` with overlay. When the user clicks X or outside the dialog, `onOpenChange` fires the no-op, so the dialog stays open. But the overlay captures all pointer events, blocking interaction with everything — causing the screen to appear frozen.

### Fix

Since the Packs tab embeds the modal inline (not as a popup), the `PackManagerModal` should **not render** its `<Dialog>` wrapper when used in embedded mode. Two changes:

**1. `src/components/agenda/PackManagerModal.tsx`**
- Add an optional `embedded?: boolean` prop
- When `embedded` is true, render just the content (without `<Dialog>`, `<DialogContent>`, `<DialogOverlay>`) — directly return the form/list JSX
- When `embedded` is false (default), keep current Dialog-wrapped behavior

**2. `src/components/patients/PatientDetailModal.tsx`**
- Pass `embedded={true}` to the `PackManagerModal` used inside the Packs tab:
  ```tsx
  <PackManagerModal embedded isOpen={true} onClose={() => {}} ... />
  ```

This eliminates the nested Dialog overlay issue entirely while preserving the modal behavior when PackManagerModal is used standalone (e.g., from the agenda).

