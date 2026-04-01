

## Segurança e Restrição de Acesso do Paciente

This addresses a critical security vulnerability where patients can access all Physione professional screens.

### Root Cause

The `ProtectedRoute` component only checks if a user is authenticated — it does not check roles. The `ProtectedPage` wrapper (which includes `PersistentLayout` with sidebar, header, chat) wraps all professional routes. Any authenticated user (including patients) gets full access.

---

### Step 1: Role-Aware Route Guard in `ProtectedRoute.tsx`

Modify `ProtectedRoute` to accept an optional `requireProfessional` prop (default `true` for Physione routes). Use `useUserRole()` to check roles. If user only has `patient` role, redirect to `/patient-portal`.

Update `ProtectedPage` in `App.tsx` to pass `requireProfessional={true}`.

The `/patient-portal` route uses `ProtectedRoute` without the professional requirement — `PatientPortal.tsx` already checks `isPatient` internally.

---

### Step 2: Fix Login.tsx Role-Based Redirect

After successful authentication, check `user_roles`:
- If user has `admin`/`professional`/`secretary` role → navigate to Physione (`/`)
- If user has `portal_role === 'both'` → show existing dual-role dialog
- If user only has `patient` role → navigate to `/patient-portal`
- If no recognized role → sign out + show error

This replaces the current logic that defaults to navigating to `/` (Dashboard).

---

### Step 3: Hide Chat Button for Patients

In `DiaryFloatingButton.tsx`, add a role check at the top. Use `useUserRole()` — if `isPatient && !isProfessional && !isAdmin`, return `null`. This removes the floating chat from the patient portal entirely.

Alternatively (simpler): since `DiaryFloatingButton` is rendered inside `PersistentLayout` which is only used by `ProtectedPage` (professional routes), and the patient portal (`PatientPortal.tsx`) has its own layout without `PersistentLayout`, the chat button should already not appear on the portal. But we add the guard as defense-in-depth.

---

### Step 4: Database Migration — Tighten RLS Policies

Single migration to replace the permissive `USING (true)` policies on portal tables:

**`portal_diario`**: Drop "Acesso total" policy. Add:
- Professionals (via `profiles.role` check using a security definer function) → full access
- Patients (via `portal_conta_pacientes` lookup by `auth.uid()`) → SELECT/INSERT only on their own `paciente_id`

**`portal_questionario`**: Same pattern — professionals full access, patients read/update own only.

**`portal_notificacoes`**: Professionals full access only.

**`portal_respostas`**: Professionals full access. Patients SELECT/INSERT on entries linked to their patients.

**`portal_contas`**: Professionals full access. Patients SELECT own record only.

**`portal_conta_pacientes`**: Professionals full access. Patients SELECT own links only.

Will create a security definer function `is_professional()` to avoid recursive RLS:
```sql
CREATE OR REPLACE FUNCTION public.is_professional(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND role IN ('admin', 'professional', 'admin_master')
  )
$$;
```

---

### Step 5: Editable Questionnaire in Anamnese

Modify `QuestionnaireHealthSummary.tsx`:
- Add `editable` state toggle with "Editar" button in header
- In edit mode: render inputs/selects for each field based on `perfilTipo`
- Save: upsert to `portal_questionario` with updated JSONB objects
- If no questionnaire exists: show "Preencher manualmente" button that opens the same form
- Profile detection: calculate from `pacientes.birth_date` (0-2=baby, 2-12=child, 12-65=adult, 65+=elderly), with manual selector fallback if no birth date

---

### Files Changed

| Action | File |
|--------|------|
| Modified | `src/components/auth/ProtectedRoute.tsx` — add role check |
| Modified | `src/pages/Login.tsx` — role-based redirect after login |
| Modified | `src/components/notifications/DiaryFloatingButton.tsx` — guard for professionals only |
| Modified | `src/components/prontuarios/QuestionnaireHealthSummary.tsx` — add edit/create mode |
| Migration | RLS policies for portal tables + `is_professional()` function |

### What stays untouched
- PatientPortal.tsx (already has its own layout, no sidebar)
- PersistentLayout.tsx (no changes needed)
- All professional features (Agenda, Financeiro, etc.)
- Portal onboarding and verification flows

