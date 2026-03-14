

# Add Duplicate Patients Detection Modal

## Overview
Add a "Verificar Duplicados" button to the Pacientes page header and create a new `DuplicatePatientsModal` component that detects, displays, and allows merging of duplicate patient records.

## File Changes

### 1. New file: `src/components/patients/DuplicatePatientsModal.tsx`

Self-contained modal component. Props: `isOpen`, `onClose`, `patients` (Patient array), `onMergeComplete` (callback to refresh).

**Detection logic (runs on open via useMemo):**
- Normalize: lowercase, remove diacritics (NFD + strip combining chars), collapse whitespace
- For every pair (i, j) where i < j, flag as duplicate if:
  - Normalized name A contains normalized name B or vice-versa, OR
  - Word overlap >= 80% (intersection / max(wordsA, wordsB))
- Store pairs as `{patientA, patientB}[]`

**State:**
- `dismissedPairs` — Set of `"idA-idB"` strings (session-only, not persisted)
- `mergingPairKey` — which pair is in merge confirmation mode
- `mergeChoices` — `{name, phone, email, keepId}` for the active merge

**UI per pair (card with two columns):**
- Each side: name, phone, email, created_at (formatted), session count
- Session counts fetched on modal open via single query: `(supabase as any).from("sessoes").select("paciente_id")` then count per patient in JS
- Two buttons: "Mesclar" (opens inline merge form) and "Nao e duplicado" (adds to dismissedPairs)

**Merge confirmation (inline, replaces buttons):**
- Radio for name (if different)
- Radio for phone (if different)
- Radio for email (if different)
- "Confirmar Mesclagem" button that:
  1. Updates all `sessoes` rows: `(supabase as any).from("sessoes").update({paciente_id: keepId}).eq("paciente_id", discardId)`
  2. Deletes discarded patient: `supabase.from("pacientes").delete().eq("id", discardId)`
  3. If kept patient needs field updates (name/phone/email from discarded), update via `supabase.from("pacientes").update(...).eq("id", keepId)`
  4. Calls `onMergeComplete()`, removes pair from list

### 2. Update `src/pages/Pacientes.tsx`

- Import `DuplicatePatientsModal` and `Users` icon
- Add state: `isDuplicateModalOpen`
- Add button in the header actions (before "Relatório"): `Verificar Duplicados` with `Users` icon
- Render `<DuplicatePatientsModal>` with `patients={patients}`, `onMergeComplete={refreshPatients}`

