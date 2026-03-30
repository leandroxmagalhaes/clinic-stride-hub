

## Reativar, Excluir e Filtrar Pacientes

### Step 1: Database Migration — Create `pacientes_excluidos` table

```sql
CREATE TABLE IF NOT EXISTS public.pacientes_excluidos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid,
  paciente_id_original uuid,
  dados_paciente jsonb NOT NULL,
  excluido_por uuid,
  excluido_em timestamptz DEFAULT now(),
  motivo text DEFAULT 'Exclusão manual'
);

ALTER TABLE public.pacientes_excluidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage deleted patients in own clinic"
  ON public.pacientes_excluidos FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
```

Note: Adding `clinic_id` column (not in user's SQL) for proper RLS scoping consistent with the project's security model.

### Step 2: Modify `PatientDetailModal.tsx` — Dynamic Inativar/Reativar + Excluir button

**Inativar/Reativar logic:**
- If `patient.is_active === true`: show current red "Inativar" button (unchanged)
- If `patient.is_active === false`: show green "Reativar" button (RotateCcw icon, green text, outline style)
- Add `onReactivatePatient` prop callback
- Reactivation sets `is_active = true` via the existing `onUpdatePatient` callback

**Excluir Permanentemente button:**
- Replace the existing `onPermanentlyDeletePatient` button/dialog with new two-step confirmation:
  - Step 1: Simple warning dialog
  - Step 2: Type patient name to confirm (input must match exactly to enable button)
- Before deleting: copy full patient data to `pacientes_excluidos` via `(supabase as any).from('pacientes_excluidos').insert(...)`, then call cascade delete

### Step 3: Modify `Pacientes.tsx` — Add status filter chips

**Above the patient grid (below search bar):**
- Three toggle chips: "Ativos (N)", "Inativos (N)", "Todos (N)"
- Default: "Ativos"
- State: `statusFilter: "ativos" | "inativos" | "todos"`
- Filter `filteredPatients` by `is_active` before rendering
- Style: same chip pattern as Quick Panel filters (border, blue highlight when active)

**Add "Excluídos" tab** (visible only when `isAdminMaster`):
- Fourth chip "Excluídos (N)" that switches to a list view of `pacientes_excluidos`
- Fetch from `(supabase as any).from('pacientes_excluidos').select('*').order('excluido_em', { ascending: false })`
- Each row shows: name (from jsonb), deletion date, deleted by
- "Ver dados" button → read-only modal showing all jsonb fields
- "Recuperar" button → insert into `pacientes` from jsonb data (with `is_active: false`), then delete from `pacientes_excluidos`, refresh lists

### Step 4: Wire up in `Pacientes.tsx`

- Pass `onReactivatePatient` to `PatientDetailModal` (calls `supabase.from('pacientes').update({ is_active: true })` then `refreshPatients()`)
- Update the `onPermanentlyDeletePatient` flow to archive first, then cascade delete
- Add counters for active/inactive patients using `useMemo`

### Files changed
- **New migration**: `pacientes_excluidos` table
- **Modified**: `src/components/patients/PatientDetailModal.tsx` (dynamic button + two-step delete)
- **Modified**: `src/pages/Pacientes.tsx` (filter chips + excluídos tab)

### Technical notes
- Uses `(supabase as any).from('pacientes_excluidos')` since table won't be in generated types
- Individual inserts only (no arrays)
- All existing visual layout preserved — only adding filter chips and swapping button text/color conditionally

