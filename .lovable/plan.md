

## Portal do Paciente — Fase 2: Diário + Respostas + Notificações

This is a large feature adding 3 new tables, replacing the existing PatientPortal page with a richer diary, adding a new tab to Prontuários, a briefing section in SessionManagementModal, and diary notifications.

### Step 1: Database Migrations

Create 3 tables in a single migration:

- **`portal_diario`**: `id`, `paciente_id`, `autor_nome`, `humor`, `categoria`, `texto`, `nivel_dor`, `tem_foto`, `foto_url`, `created_at`. Open RLS (patient-facing, pre-auth scenarios).
- **`portal_respostas`**: `id`, `diario_id` (FK → `portal_diario.id` ON DELETE CASCADE), `autor_nome`, `autor_tipo`, `texto`, `created_at`. Open RLS.
- **`portal_notificacoes`**: `id`, `paciente_id`, `tipo`, `titulo`, `texto_preview`, `urgente`, `lida`, `referencia_id`, `created_at`. Open RLS.

### Step 2: Replace `PatientPortal.tsx` — New Diary with Profile-Adaptive Form

Rewrite the existing `PatientPortal.tsx` page to use the new `portal_diario` table instead of `patient_diary`.

**On mount**: Fetch patient's `perfil_tipo` from `portal_questionario` to determine available categories and placeholder text.

**New entry form**: Mood emoji row (5 options) → Pain scale (only adult/elderly, 1-10 color-coded buttons) → Category buttons (profile-specific) → Textarea (profile-specific placeholder) → Photo upload button (to `patient-documents` bucket, path `{paciente_id}/diary/{filename}`) → Submit.

**On submit**: Insert into `portal_diario` + insert notification into `portal_notificacoes` (urgent if category is worsening/fall or pain ≥ 6).

**Entry list**: Chronological with mood emoji, category badge, pain badge, text, photo indicator. Below each entry: reply thread from `portal_respostas` (blue bg for professional, grey for patient). Inline "Responder" button with textarea.

**On patient reply**: Insert into `portal_respostas` with `autor_tipo: 'patient'` + insert notification with `tipo: 'diary_reply'`.

Components to create:
- `src/components/patient-portal/DiaryNewEntryForm.tsx` — adaptive form
- `src/components/patient-portal/DiaryEntryCard.tsx` — single entry with replies
- `src/components/patient-portal/DiaryReplyThread.tsx` — reply list + reply form

The old `DiaryEntryForm.tsx` and `DiaryHistory.tsx` can remain (unused) or be removed.

### Step 3: New "Diário" Tab in `Prontuarios.tsx`

Add a 5th tab `📖 Diário` to the existing TabsList (line ~537):

```text
Evoluções | Relatórios | Documentos | Prontuário | 📖 Diário (badge: N)
```

**Tab content** (`src/components/prontuarios/PatientDiaryTab.tsx`):
- Header: "Diário do Paciente" + "Registos por: [Pais/Paciente/Cuidador]" + entry count
- **Alert box** (red, top): If entries with category `worsening`/`fall` or `nivel_dor ≥ 6` exist since last completed session → show "Pontos de atenção" with list
- **Timeline**: Vertical line connector, each entry shows mood emoji, date, author, category badge, pain badge, full text, photo link, reply thread
- **Reply button**: Professional can reply inline → inserts into `portal_respostas` with `autor_tipo: 'professional'`, `autor_nome` from logged-in user's profile

Data fetching: Query `portal_diario` by `paciente_id`, join `portal_respostas` by `diario_id`.

### Step 4: Pre-Session Briefing in `SessionManagementModal.tsx`

Add a "✨ Briefing Pré-Sessão" section after the patient info area (~line 200-300 area of the modal).

**Condition**: Only render if the patient has `portal_diario` entries since their last `realizado` session.

**Content**: 3 mini-cards (recent moods, category counters, entry count) + alerts if concerning entries + last 2-3 entries (compact: emoji + date + truncated text + badge) + "Ver diário completo →" link navigating to Prontuários diary tab.

Component: `src/components/prontuarios/DiaryBriefingSection.tsx`

### Step 5: Integrate Diary Notifications into `NotificationService.ts`

Add a new method `getDiaryNotifications()` that fetches unread entries from `portal_notificacoes` where `lida = false`.

Map to the existing `AppNotification` interface:
- `type`: extend `NotificationType` union with `'diary_entry' | 'diary_reply'`
- `priority`: `'high'` if `urgente`, else `'medium'`
- Icon differentiation happens in `NotificationItem.tsx`
- On click: navigate to `/prontuarios?paciente={paciente_id}&tab=diario`

Add to the aggregated `getNotifications()` call. Mark as read on click via update to `portal_notificacoes`.

### Files to Create
- `src/components/patient-portal/DiaryNewEntryForm.tsx`
- `src/components/patient-portal/DiaryEntryCard.tsx`
- `src/components/patient-portal/DiaryReplyThread.tsx`
- `src/components/prontuarios/PatientDiaryTab.tsx`
- `src/components/prontuarios/DiaryBriefingSection.tsx`
- Migration SQL

### Files to Modify
- `src/pages/PatientPortal.tsx` — rewrite to use new diary tables
- `src/pages/Prontuarios.tsx` — add 5th "Diário" tab
- `src/components/agenda/SessionManagementModal.tsx` — add briefing section
- `src/services/NotificationService.ts` — add diary notification source
- `src/components/notifications/NotificationItem.tsx` — handle diary notification types

### What stays untouched
- Evoluções, Relatórios, Documentos, Prontuário tabs — zero changes
- Portal verification & onboarding (Fase 1) — zero changes
- Existing notification types — preserved, diary adds alongside

