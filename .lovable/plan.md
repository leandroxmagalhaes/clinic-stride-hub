

## Envio do Link de Acesso + Questionário Editável com Histórico

---

### Step 1: Fix "Enviar Link do Portal" button in PatientPortalTab

The edge function `send-patient-portal-link` already exists and uses Resend. Add a "Enviar Link do Portal" button to `PatientPortalTab.tsx` that invokes it with the patient's email, name, portal URL (`https://physione.app/portal/login`), and clinic name. Show the button when the account exists and has email.

**File**: `src/components/patients/PatientPortalTab.tsx`

---

### Step 2: Auto-send link after onboarding completion

In `PortalOnboarding.tsx`, after `saveStep3` marks `onboarding_completo = true`, invoke `send-patient-portal-link` with the user's email to send the "Your portal is ready" email automatically.

**File**: `src/pages/PortalOnboarding.tsx`

---

### Step 3: Update edge function sender and template

Update `send-patient-portal-link/index.ts` to use sender `Physione <noreply@respiraedesenvolve.com>` and a branded template with "Respira & Desenvolve" footer. Keep the existing structure but update the `from` field and email content to match the branding.

**File**: `supabase/functions/send-patient-portal-link/index.ts`

---

### Step 4: Database migration — `portal_questionario_historico` table

Create table with columns: id, questionario_id, paciente_id, campo_alterado, valor_anterior, valor_novo, alterado_por, created_at. RLS: professionals SELECT via `is_professional()`, INSERT open (`WITH CHECK (true)`).

---

### Step 5: Patient can edit questionnaire from portal

Add an "Atualizar dados de saúde" button in `PatientPortal.tsx`. When clicked, fetch current questionnaire data, show the health profile form (reusing the onboarding field structure), and on save: compare field-by-field, insert changes into `portal_questionario_historico`, update `portal_questionario`, and create a notification in `portal_notificacoes`.

**File**: `src/pages/PatientPortal.tsx`

---

### Step 6: Professional sees change history in Anamnese

Extend `QuestionnaireHealthSummary.tsx`:
- Show "Última atualização" date below the title
- Add "Ver histórico" button that opens a collapsible/modal listing all changes from `portal_questionario_historico`
- Each entry shows: date, who changed it, field label (mapped from key), old value (strikethrough red) → new value (green)
- When the professional edits and saves, also record changes to the history table with `alterado_por: professionalName`

**File**: `src/components/prontuarios/QuestionnaireHealthSummary.tsx`

---

### Files Summary

| Action | File |
|--------|------|
| Modified | `src/components/patients/PatientPortalTab.tsx` — add send link button |
| Modified | `src/pages/PortalOnboarding.tsx` — auto-send after onboarding |
| Modified | `supabase/functions/send-patient-portal-link/index.ts` — update branding |
| Migration | `portal_questionario_historico` table |
| Modified | `src/pages/PatientPortal.tsx` — patient edits questionnaire |
| Modified | `src/components/prontuarios/QuestionnaireHealthSummary.tsx` — history viewer + record changes |

