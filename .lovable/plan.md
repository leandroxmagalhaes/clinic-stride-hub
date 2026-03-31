

## Portal do Paciente — Fase 1: Onboarding Seguro + Questionário Adaptativo

This is a large feature spanning database tables, an edge function, multiple new pages, and integration into the existing patient detail modal. The scope is significant (~2000+ lines of new code across ~10 files).

### Step 1: Database Migrations

Create 3 new tables:

**`portal_convites`** — invite tokens with 6-digit verification codes
- Fields: `paciente_id`, `codigo`, `link_token` (unique), `enviado_para_email`, `enviado_para_telefone`, `tentativas`, `max_tentativas` (default 3), `utilizado`, `expira_em`, `created_at`
- RLS: open policy (public access needed for unauthenticated verification flow)

**`portal_contas`** — portal accounts linked to patients
- Fields: `paciente_id` (unique), `auth_user_id`, `email`, `provider` (email/google), `status` (active/blocked), `onboarding_completo`, `ultimo_acesso`, timestamps
- RLS: open policy (needed during account creation flow before auth)

**`portal_questionario`** — adaptive health questionnaire responses
- Fields: `paciente_id` (unique), `perfil_tipo` (baby/child/adult/elderly), `dados_pessoais` jsonb, `perfil_saude` jsonb, `expectativas` jsonb, `completo`, timestamps
- RLS: open policy (accessed during onboarding)

### Step 2: Edge Function `generate-portal-invite`

New edge function that:
1. Receives `paciente_id`, `email`, `telefone`
2. Generates random 16-char `link_token` and 6-digit numeric `codigo`
3. Invalidates previous invites for the same patient
4. Inserts new invite record (expires in 48h)
5. Sends email via Resend with the link and code
6. Returns `{ link, codigo, expira_em }`

Uses service role key for DB access. CORS headers included.

### Step 3: Portal Verification Page (`/portal/:token`)

New public route and page component `src/pages/PortalVerificacao.tsx`:

- Validates token against `portal_convites` table
- Shows error states for invalid/expired/used/max-attempts tokens
- Displays patient first name only (e.g., "Miguel F.") for privacy
- 6-digit OTP input with auto-advance (using existing `InputOTP` component)
- Auto-verify on last digit entry
- Shake animation on wrong code, increment `tentativas`
- On success: mark invite as used, proceed to account creation
- "Reenviar" link calls `generate-portal-invite` again
- Physione branding: blue square with "P" + "Portal do Paciente"

### Step 4: Account Creation Page

After code verification, show account creation screen within the same page component:

**Option 1 — Google OAuth** (primary):
- Use `supabase.auth.signInWithOAuth({ provider: 'google' })` (no Lovable managed OAuth for portal — this is patient-facing, standard Supabase auth)
- After auth callback: create `portal_contas` record with `provider: 'google'`

**Option 2 — Email + Password**:
- Email + password + confirm password fields
- Use `supabase.auth.signUp({ email, password })`
- Create `portal_contas` record with `provider: 'email'`

After account creation: redirect to onboarding.

### Step 5: Onboarding Wizard (4 Steps)

New page component `src/pages/PortalOnboarding.tsx` at route `/portal/onboarding`:

**Progress bar**: 4 segments — "Dados Pessoais" → "Perfil de Saúde" → "Expectativas" → "Pronto!"

**Step 1 — Dados Pessoais**: Pre-filled from `pacientes` table. Fields: name, phone, email, birth date, NIF, address. If age < 12: show guardian fields. Auto-detect `perfil_tipo` from birth date (0-2: baby, 2-12: child, 12-65: adult, 65+: elderly). Saves to `portal_questionario.dados_pessoais` jsonb and updates `pacientes` table.

**Step 2 — Perfil de Saúde (adaptive)**: Content changes based on `perfil_tipo`:
- **Baby**: Birth details (gestation slider 24-42, delivery type, etc.), feeding/routine (breastfeeding, reflux, colic, sleep), health (respiratory infections, postural preference, vaccines, allergies, medications, diagnosis)
- **Child**: Consultation reason, physical activity, school difficulties, surgeries, allergies, medication, vaccines, diagnosis
- **Adult**: Main complaint, physical activity level, treatment objective, previous injuries, surgeries, medication, allergies, chronic conditions
- **Elderly**: Chronic conditions, medication, allergies, fall history, walking aid, daily autonomy, caregiver info

All multi-option questions use clickable card buttons (not dropdowns/radios). All yes/no include "Não sei". Saves to `portal_questionario.perfil_saude` jsonb.

**Step 3 — Expectativas**: Two textareas (treatment goals + concerns). Saves to `portal_questionario.expectativas` jsonb. Marks `completo = true`.

**Step 4 — Conclusão**: Celebration screen. Updates `portal_contas.onboarding_completo = true`. Button "Ir para o Diário →" redirects to existing `/patient-portal`.

### Step 6: Portal Management Section in Patient Detail Modal

Add a new tab "Portal" to `PatientDetailModal.tsx` (4th tab alongside Dados, Etiquetas, Packs):

**Status badge**: Not activated (grey) / Invite sent (yellow) / Active account (green) / Blocked (red)

**Info panel** (when account exists): email, last access, onboarding status

**Action buttons**:
- "Gerar convite" — calls `generate-portal-invite` edge function, shows link + code
- "Copiar link" — clipboard copy
- "Bloquear/Reactivar acesso" — toggles `portal_contas.status`

**Last invite details** (collapsible): link, code (visible for receptionist), sent date, status

**Questionnaire preview** (when onboarding complete): read-only grid of answers from jsonb

### Step 7: Routing Updates in `App.tsx`

Add public routes:
- `/portal/:token` → `PortalVerificacao` (public, no auth required)
- `/portal/onboarding` → `PortalOnboarding` (requires auth, patient role)

### Files to Create
- `src/pages/PortalVerificacao.tsx` (~400 lines — verification + account creation)
- `src/pages/PortalOnboarding.tsx` (~800 lines — 4-step wizard with adaptive questionnaire)
- `supabase/functions/generate-portal-invite/index.ts` (~120 lines)
- Migration SQL for 3 tables

### Files to Modify
- `src/App.tsx` — add 2 new routes
- `src/components/patients/PatientDetailModal.tsx` — add Portal tab with management UI

### Technical Notes
- All new table queries use `(supabase as any).from(...)` pattern
- Individual inserts only (no arrays)
- Google OAuth uses standard `supabase.auth.signInWithOAuth` (not Lovable managed, since this is patient-facing)
- The existing `/patient-portal` route and `PatientPortal.tsx` page remain as-is — the diary lives there
- Edge function uses Resend (already configured with `RESEND_API_KEY` secret)
- Portal links use `getPublicBaseUrl()` for correct domain

