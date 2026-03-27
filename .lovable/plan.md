

## Persistência do Painel Rápido — Supabase

Replace mock data with Supabase-backed persistence for the Quick Panel. Zero UI changes.

### Step 1: Create database tables

Two migrations:

**Migration 1 — `lista_espera`**
```sql
CREATE TABLE IF NOT EXISTS public.lista_espera (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  nome text NOT NULL,
  telefone text NOT NULL,
  especialidade text NOT NULL,
  prioridade text NOT NULL DEFAULT 'normal',
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage waiting list in own clinic"
  ON public.lista_espera FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
```

**Migration 2 — `notas_lembretes`**
```sql
CREATE TABLE IF NOT EXISTS public.notas_lembretes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id),
  tipo text NOT NULL DEFAULT 'tarefa',
  texto text NOT NULL,
  concluida boolean DEFAULT false,
  data_prazo date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notas_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notes in own clinic"
  ON public.notas_lembretes FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
```

Note: Using proper clinic-scoped RLS (not open `USING (true)`) to match the project's security model. The column is named `clinic_id` (not `id_da_clínica`) to follow existing conventions.

### Step 2: Create a custom hook `useQuickPanelData`

**New file: `src/hooks/useQuickPanelData.ts`**

This hook encapsulates all Supabase operations and field mapping. It:
- Fetches both lists on mount (so collapsed button badges are accurate)
- Re-fetches when panel opens
- Provides `addPatient`, `editPatient`, `removePatient`, `addNote`, `editNote`, `removeNote`, `toggleNote` — each does the Supabase mutation, then refreshes the list
- Maps DB fields (Portuguese) to component fields (English): `nome→name`, `telefone→phone`, `especialidade→specialty`, `prioridade→priority`, `observacoes→observations`, `texto→text`, `tipo→type`, `concluida→completed`, `data_prazo→deadline`
- Computes `daysWaiting` from `created_at`
- Uses `(supabase as any).from(...)` since tables aren't in generated types
- Exposes `loading` boolean for a subtle loading indicator
- Includes `clinic_id` from the already-fetched `clinicId` state in Agenda

### Step 3: Modify `src/pages/Agenda.tsx`

- Remove import of `MOCK_WAITING_PATIENTS`, `MOCK_NOTES` and `mockData`
- Remove all inline handler functions (`handleAddWaitingPatient`, `handleEditWaitingPatient`, etc.)
- Remove `waitingPatients` and `quickNotes` useState
- Import and call `useQuickPanelData(clinicId)` hook
- Pass hook's data and callbacks to `<QuickPanel>`
- Pass `quickPanelOpen` to hook so it re-fetches on open

### Step 4: Delete mock data file

Delete `src/components/agenda/quick-panel/mockData.ts` (no longer needed).

### What stays untouched

All visual components (`QuickPanel`, `QuickPanelButton`, `WaitingListTab`, `WaitingPatientCard`, `WaitingPatientForm`, `NotesTab`, `NoteCard`, `NoteForm`, `types.ts`) remain exactly as they are. The props interface is unchanged — only where the data comes from changes.

