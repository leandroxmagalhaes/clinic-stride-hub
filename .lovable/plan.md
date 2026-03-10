

# Fix File constructor TypeScript errors

## Change
In `src/components/prontuarios/PatientDocuments.tsx`, cast `File` to `any` on lines 189 and 207:

- **Line 189**: `new File([blob], ...)` → `new (File as any)([blob], ...)`
- **Line 207**: `new File([blob], ...)` → `new (File as any)([blob], ...)`

