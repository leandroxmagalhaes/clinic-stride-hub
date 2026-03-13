

# Add full field editing to SessionManagementModal

## What exists
The edit mode (lines 539–713) already has: date, start/end time, professional, service, status, price, notes. The `useData()` hook already provides `patients`, `professionals`, `services`.

## What to add

### New state variables (after line 155)
- `editPaciente` — patient ID string
- `editTipoAgendamento` — 'avulso' | 'pack'
- `editPackGrupoId` — UUID string or empty
- `editPaymentStatus` — 'pago' | 'pendente' | 'parcial'
- `editPaymentMethod` — string
- `editPaymentDate` — string (date)
- `packGroups` — array of `{pack_grupo_id, count}` fetched when patient+type=pack

### Initialize in useEffect (lines 168–197)
Set all new state vars from session data (using `(session as any)` for extended columns).

### Fetch pack groups
Add a `useEffect` that triggers when `editPaciente` changes and `editTipoAgendamento === 'pack'`: query `sessoes` grouped by `pack_grupo_id` for that patient.

### Edit form UI additions (inside the editing block, lines 539–713)
1. **Patient** — searchable combobox (Popover + Command pattern, same as NewSessionModal). Placed before the date field.
2. **Session type** — two toggle buttons (Avulso / Pack) after service.
3. **Pack group** — visible only when type=pack. Select with existing groups + "Criar novo grupo" option.
4. **Payment status** — Select with pago/pendente/parcial, after price.
5. **Payment method** — Select (reuse `PAYMENT_METHOD_OPTIONS`), visible when status is pago/parcial.
6. **Payment date** — date input, visible when status is pago/parcial.

### Save handler update (lines 232–264)
Add `paciente_id`, `tipo_agendamento`, `pack_grupo_id`, `pagamento_estado`, `pagamento_metodo`, `pagamento_data` to the `.update()` payload via `onUpdateSession`. Since `onUpdateSession` passes through to supabase, include all fields.

### Import additions
Add `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` from `@/components/ui/command` for the patient search.

### No other files changed

