

## Corrigir Chat Flutuante + Questionário + Login de Utente

### Problem Analysis

**Issue 1 — Chat navigates away**: `DiaryFloatingButton.tsx` line 94 calls `navigate()` on notification click. Needs to be replaced with a two-state inline chat (conversation list → individual chat thread).

**Issue 2 — Questionnaire data not showing**: The onboarding saves health data with English keys (`gestation`, `deliveryType`, `reason`, `activity`, etc.) but `QuestionnaireHealthSummary.tsx` looks up Portuguese keys (`semanas_gestacao`, `tipo_parto`, `motivo_consulta`, etc.). The keys don't match, so all values show "—".

**Issue 3 — No patient login**: After onboarding, patients have no way to return to the diary. Need a `/portal/login` page.

---

### Step 1: Fix QuestionnaireHealthSummary field key mapping

**File**: `src/components/prontuarios/QuestionnaireHealthSummary.tsx`

Update the field key arrays to match what the onboarding actually saves:

- Baby: `gestation`, `deliveryType`, `induced`, `instruments`, `birthWeight`, `birthLength`, `breastfeeding`, `reflux`, `colic`, `sleep`, `bowel`, `respiratoryInfections`, `posturalPreference`, `vaccines`, `allergies`, `medication`, `diagnosis`
- Adult: `reason`, `activity`, `objective`, `previousInjuries`, `surgeries`, `medication`, `allergies`, `chronicConditions`
- Elderly: `chronicConditions`, `medication`, `allergies`, `fallHistory`, `walkingAid`, `autonomy`, `caregiverName`
- Child: `reason`, `activity`, `schoolDifficulties`, `surgeries`, `allergies`, `medication`, `vaccines`, `diagnosis`

Also update expectativas keys from `objetivos`/`preocupacoes` to `expectations`/`concerns` (matching onboarding step 3 line 174).

---

### Step 2: Rewrite DiaryFloatingButton as two-state inline chat

**File**: `src/components/notifications/DiaryFloatingButton.tsx` — full rewrite

**State 1 — Conversation list**: Group `portal_notificacoes` by `paciente_id`. Show patient avatar (initials), name, last message preview, unread count per patient, urgency indicator. Click patient → State 2.

**State 2 — Chat thread**: Fetch `portal_diario` entries + `portal_respostas` for that patient. Display chronologically (oldest first, like WhatsApp). Patient messages left-aligned (grey bg), professional replies right-aligned (blue bg). Include mood emoji, category badge, pain badge. Bottom: textarea + send button to insert into `portal_respostas` with `autor_tipo: 'professional'`. On open: mark all that patient's notifications as read. Header: back arrow, patient name, "Ver prontuário" link (only navigation point).

**Critical**: Remove all `navigate()` calls from notification clicks. Only "Ver prontuário" link navigates.

Panel specs: `w-[380px]`, `max-h-[500px]`, `z-[95]`, slide-up animation.

---

### Step 3: Create patient login page

**New file**: `src/pages/PortalLogin.tsx`

- Route: `/portal/login` (public)
- Physione branding (blue P square + "Portal do Paciente")
- Email + password login via `supabase.auth.signInWithPassword()`
- Google OAuth button via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- "Esqueci a password" link → `supabase.auth.resetPasswordForEmail()`
- After login: check `portal_contas` for `auth_user_id` match → if not found, show error → if `onboarding_completo` false, redirect to `/portal/onboarding` → else redirect to `/patient-portal`
- Footer link: "É profissional? Aceda aqui ao Physione →" → `/login`

**Modify**: `src/pages/Login.tsx` — add footer link "É utente? Aceda ao Portal do Paciente →" → `/portal/login`

**Modify**: `src/App.tsx` — add route `/portal/login` → `PortalLogin`

---

### Files Changed
- **Modified**: `src/components/prontuarios/QuestionnaireHealthSummary.tsx` (fix field keys)
- **Rewritten**: `src/components/notifications/DiaryFloatingButton.tsx` (two-state chat)
- **New**: `src/pages/PortalLogin.tsx`
- **Modified**: `src/pages/Login.tsx` (add portal link)
- **Modified**: `src/App.tsx` (add route)

