

## Clientes Fixos (Recorrentes) no Painel Rápido

Add a "Clientes Fixos" collapsible section at the top of the "Lista de Espera" tab, with Supabase persistence and automatic session counting.

### Step 1: Database Migration

Create `clientes_fixos` table with proper RLS scoped by `clinic_id`:

```sql
CREATE TABLE IF NOT EXISTS public.clientes_fixos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid,
  paciente_id uuid,
  nome text NOT NULL,
  telefone text,
  especialidade text,
  frequencia text NOT NULL DEFAULT 'weekly',
  sessoes_por_periodo integer NOT NULL DEFAULT 1,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clientes_fixos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage clientes_fixos in own clinic"
  ON public.clientes_fixos FOR ALL
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
```

Note: Using `clinic_id` (not `id_da_clínica`) and proper RLS via `get_user_clinic_id` instead of open policy.

### Step 2: Extend `useQuickPanelData.ts`

Add to the existing hook:
- State: `fixedClients` array + `fixedClientSessions` map (clientId → count of sessions in period)
- `fetchFixedClients()`: query `clientes_fixos` where `ativo = true`, `clinic_id = clinicId`
- `fetchFixedClientSessions()`: for each client with `paciente_id`, query `sessoes` count within the calculated period (using `start_time` field, not `data`)
- CRUD: `addFixedClient`, `editFixedClient`, `removeFixedClient` (soft delete: `ativo = false`)
- Period calculation helper: given frequency, compute start/end dates for current period
- Return `totalMissingSessions` count for badge use

### Step 3: New Components

**`src/components/agenda/quick-panel/FixedClientsSection.tsx`** — Collapsible section:
- Header bar: 📅 icon + "Clientes Fixos" + alert badge (red pulse if missing, green if all ok) + chevron
- When expanded: list of `FixedClientCard` components + "Adicionar Cliente Fixo" button
- Form for add/edit (inline, same pattern as WaitingPatientForm): name with patient autocomplete, specialty select, frequency select, sessions per period buttons (1-5)

**`src/components/agenda/quick-panel/FixedClientCard.tsx`** — Individual card:
- Left border colored by status (green/red)
- Name + specialty + frequency badge ("3x/sem", "1x/mês", etc.)
- Status badge (✓ 3/3 or 1/3 — faltam 2)
- 4px progress bar (green/yellow/red)
- Action buttons: "Agendar" (opens new session wizard with patient pre-selected, only when missing), edit, remove

### Step 4: Integrate into `WaitingListTab.tsx`

Add `FixedClientsSection` at the top of the component, before the filter chips. Pass fixed clients data and callbacks as props. Separated by `border-b border-[#e2e8f0]`.

New props needed on `WaitingListTab`:
- `fixedClients`, `fixedClientSessions`, `onAddFixedClient`, `onEditFixedClient`, `onRemoveFixedClient`
- `onOpenNewSession(patientId)` — callback to open scheduling wizard with pre-selected patient

### Step 5: Update `QuickPanelButton.tsx`

Add `missingSessions` prop. Render a third badge section at the top:
- If `missingSessions > 0`: red badge with `!X`
- If zero: nothing or subtle green ✓

### Step 6: Wire up in `QuickPanel.tsx` and `Agenda.tsx`

- Pass new props through `QuickPanel` → `WaitingListTab`
- In `Agenda.tsx`: destructure new returns from `useQuickPanelData`, pass to `QuickPanel`, add `onOpenNewSession` callback that opens `NewSessionModal` with patient pre-selected

### Files Changed
- **New migration**: `clientes_fixos` table
- **Modified**: `src/hooks/useQuickPanelData.ts` (add fixed clients CRUD + session counting)
- **New**: `src/components/agenda/quick-panel/FixedClientsSection.tsx`
- **New**: `src/components/agenda/quick-panel/FixedClientCard.tsx`
- **Modified**: `src/components/agenda/quick-panel/WaitingListTab.tsx` (add section at top)
- **Modified**: `src/components/agenda/quick-panel/QuickPanel.tsx` (pass new props)
- **Modified**: `src/components/agenda/quick-panel/QuickPanelButton.tsx` (third badge)
- **Modified**: `src/pages/Agenda.tsx` (wire everything)

### What stays untouched
- Waiting list cards, form, filters, sorting — zero changes
- Notes tab — zero changes
- Panel layout, tabs, header — zero changes

