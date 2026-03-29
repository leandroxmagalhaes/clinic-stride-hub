

## New 5-Step Scheduling Wizard (Patient First)

Replace the existing 4-step wizard in `NewSessionModal.tsx` with a new 5-step flow that starts with patient selection and auto-detects active packs.

### Flow Overview

```text
Step 1: Patient     → Search/select patient, detect active packs
Step 2: Type        → Avulso / Pack existente / Novo pack
Step 3: Dates       → Date+time per session
Step 4: Details     → Service + Professional + Notes
Step 5: Confirmation → Summary + Confirm button
```

### File Changes

**Replace: `src/components/agenda/NewSessionModal.tsx`** (full rewrite, ~750 lines → ~900 lines)

Key changes:

1. **Step 1 — Patient**: Debounced search (300ms) querying `pacientes` by `full_name`. On select, fetch active packs from `packs` table (`is_active = true, paciente_id = selected`). Show patient card with avatar (initials), name, phone, email, "Alterar" button. Green banner if active packs detected. "Criar paciente rápido" link always visible; inline form with name (required), phone, email. If search yields no results, show create link with pre-filled name.

2. **Step 2 — Type**: Three vertical card options:
   - **Avulso**: quantity selector (1/5/10/20 + custom). Always available.
   - **Pack existente**: Only rendered if patient has active packs. Lists packs as sub-cards with progress bar (sessoes_usadas/quantidade_sessoes), payment badge. Auto-selects if single pack. Sets quantity = remaining sessions.
   - **Criar novo pack**: Quantity selector + valor total input + pago/pendente toggle.

3. **Step 3 — Dates**: Contextual banner (grey/green/blue by type). One row per session with date input + time select (07:00–21:30, 30min intervals). Yellow border on empty rows. Counter "X de Y preenchidas". Scrollable if >~360px.

4. **Step 4 — Details**: Service select (pre-filled from pack if applicable), Professional select, Notes textarea.

5. **Step 5 — Confirmation**: Summary card with patient info, type badge (color-coded), service, professional, session list table, notes. Green "Confirmar Agendamento" button.

### Data Integration

- **Patient search**: Query `pacientes` with `ilike` filter on `full_name`, limit 10
- **Pack detection**: Query `packs` where `paciente_id = X`, `is_active = true`; join with `servicos` to get service name
- **Pack creation** (new pack flow): Insert into `packs` table before creating sessions, then set `package_id` on each session
- **Session creation**: Same individual insert logic as current wizard, with `package_id` set when applicable
- **Professional mapping**: Keep existing behavior — `sessoes.profissional_id` references `profiles` table (use professionals list passed as props which already has the correct IDs)

### Progress Bar

5 segments rendered as 5 divs in a flex row. Active segment: `bg-[#3b82f6]`, others: `bg-[#e2e8f0]`. Replaces current `<Progress>` component.

### Props Interface

No changes to `NewSessionModalProps` — same props, same callbacks. The `selectedSlot` prop pre-fills date/time on the first session slot in Step 3.

### What stays unchanged

- `BatchSchedulingModal` (Lote) — untouched
- `NewReservedSlotModal` (Reservar) — untouched
- `Agenda.tsx` integration — same props passed, no changes needed
- Automation trigger on session creation — preserved
- `PackageSubmitData` export — kept for backward compatibility

