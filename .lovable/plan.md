

# Replace NewSessionModal with 4-step Scheduling Wizard

## Overview
Complete replacement of the current single-form `NewSessionModal` with a 4-step wizard that unifies session and pack creation. The `PackManagerModal` will be kept for the patient detail view (it's embedded there) but removed from the agenda header.

## Database
The migration has already been executed — columns `tipo_agendamento`, `pack_grupo_id`, `valor_sessao`, `valor_pack_total`, `pagamento_estado`, `pagamento_metodo`, `pagamento_data` are already on `sessoes`.

## File Changes

### 1. Rewrite `src/components/agenda/NewSessionModal.tsx` (~700 lines → ~800 lines)

Complete rewrite as a 4-step wizard:

**Structure:**
- Progress bar at top showing current step (1/4, 2/4, etc.)
- Internal state machine: `step` (1–4), with Back/Next navigation
- All state local to the modal, reset on open

**Step 1 — Type & Quantity:**
- Toggle: Avulso (default) | Pack — styled as two large selectable cards
- Dynamic legend below toggle based on type + quantity
- Quick buttons: 1, 5, 10, 20 + editable numeric field (min 1, max 50)
- Next button

**Step 2 — Dates & Times:**
- Renders N session rows: "Sessão 1", "Sessão 2", etc.
- Each row: date picker (no past-date restriction) + time select (07:00–22:00, 15-min intervals)
- If pre-selected slot exists, pre-fill first session
- Pack sessions get a coloured "Pack" chip
- No conflict validation
- Scrollable container (max-h 400px) if N > 5
- If only 1 session and slot was pre-selected, auto-fill and allow skipping

**Step 3 — Patient / Service / Professional:**
- Searchable patient combobox (reuse existing pattern) + quick-create patient
- Service select with colour dot, duration, price
- Professional select
- Notes textarea
- Health tag warnings preserved

**Step 4 — Value & Payment:**
- Avulso: "Valor por sessão" field, calculated total (informational)
- Pack: "Valor total do Pack" field, calculated per-session (informational) + yellow warning
- Payment state toggle: Pago | Pendente | Parcial
- If Pago/Parcial: method select + payment date (default today)
- If Parcial: paid amount field
- "Confirmar Agendamento" button

**Save logic:**
- Generate `pack_grupo_id` (crypto.randomUUID()) for Pack or Avulso with 2+ sessions
- Insert sessions one-by-one via `supabase.from("sessoes").insert()` (not batch RPC)
- Each session gets: `tipo_agendamento`, `pack_grupo_id`, `status` (realizado if past, agendado if future), `valor_sessao`, `valor_pack_total`, `pagamento_estado`, `pagamento_metodo`, `pagamento_data`, plus standard fields
- Toast success, close modal, refresh sessions

**Props:** Simplified — remove lifted state props (`selectedPaciente`, `setSelectedPaciente`, etc.) since all state is internal. Keep `isOpen`, `onClose`, `selectedSlot`, `patients`, `professionals`, `services`, `onPatientCreated`. The `onSubmit` callback is removed; the wizard handles persistence directly.

### 2. Update `src/pages/Agenda.tsx`

- Remove all lifted form state (`selectedPaciente`, `setSelectedPaciente`, `selectedProfissional`, etc.)
- Remove `handleCreateSession`, `doCreateSession`, conflict dialog, `pendingSession` state
- Simplify `NewSessionModal` usage — just pass `isOpen`, `onClose`, `selectedSlot`, data lists, `onPatientCreated`, and a new `onSessionsCreated` callback (calls `refreshSessions`)
- Remove `PackageSubmitData` import reference
- Keep all other modals (reserved slots, batch, session management) unchanged

### 3. Session cards — payment alert indicator

In `src/components/agenda/DraggableSession.tsx` (and `AgendaMobileTimeline.tsx`):
- If session has `tipo_agendamento === 'pack'` and `pagamento_estado === 'pendente'` and `start_time` is in the past, show an orange 🔔 icon with tooltip "Pagamento pendente"
- Non-blocking, informational only

### 4. `PackManagerModal` — keep as-is

It's still used in `PatientDetailModal` for managing existing packs. No removal needed — only the wizard replaces the *scheduling* entry point.

## What is NOT changed
- `BatchSchedulingModal` — separate flow, unchanged
- `SessionManagementModal` — unchanged
- `ReservedSlotManagementModal` — unchanged
- Database triggers/RLS — unchanged
- `DataContext` pack methods — unchanged (wizard uses direct Supabase inserts for sessions)

## Estimated scope
- ~800 lines new wizard component
- ~100 lines removed from Agenda.tsx
- ~10 lines added to DraggableSession.tsx
- ~10 lines added to AgendaMobileTimeline.tsx

