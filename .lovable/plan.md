

## Make Permission Matrix Editable by Admin Master

### Problem
The permission matrix on Configurações → Permissões currently displays hardcoded values. The Admin Master cannot change role-level defaults directly from the matrix UI.

### Solution
Create a new `role_permissions` table to store editable role-level defaults per clinic. Replace the static matrix with clickable toggles that save to the database. Update `usePermissions` to read from this table.

### Database Changes

**New table: `role_permissions`**
- `id` (uuid, PK)
- `clinic_id` (uuid, NOT NULL)
- `role` (app_role, NOT NULL)
- `permissions` (jsonb, NOT NULL, default '{}')
- `updated_at` (timestamptz)
- `updated_by` (uuid)
- Unique constraint on (clinic_id, role)
- RLS: admins can manage in own clinic; authenticated users can SELECT in own clinic

### File Changes

**1. `src/services/RolePermissionService.ts`** (new)
- `getRolePermissions(clinicId, role)` — fetch from `role_permissions` table
- `saveRolePermissions(clinicId, role, permissions)` — upsert
- `getAllRolePermissions(clinicId)` — fetch all roles for the matrix display
- Falls back to `DEFAULT_PERMISSIONS` from `UserPermissionService` if no DB record exists

**2. `src/components/settings/PermissionsSettingsPanel.tsx`**
- Replace `PERMISSION_MATRIX` hardcoded constant with state loaded from `RolePermissionService`
- Replace `PermissionMatrixTable` to render clickable toggles (Checkbox) for professional/secretary tabs
- Admin tab remains read-only (all checked, not editable)
- On toggle change: update local state + debounced save to `role_permissions` table
- Show save indicator / toast on successful save

**3. `src/hooks/usePermissions.ts`**
- When no custom `user_permissions` exist, fetch role defaults from `role_permissions` table instead of using hardcoded `DEFAULT_PERMISSIONS`
- Add a new effect to load role-level permissions from the database
- Fallback chain: Admin → custom user_permissions → role_permissions (DB) → DEFAULT_PERMISSIONS (hardcoded)

**4. `src/services/UserPermissionService.ts`**
- Add a method `getRoleDefaultsFromDB(clinicId, role)` that queries `role_permissions`
- Update `getEffectivePermissions` to check DB role defaults before hardcoded ones

### Permission Fallback Chain
```text
1. Admin Master? → full access (always)
2. user_permissions record? → use custom per-user permissions
3. role_permissions record? → use clinic's editable role defaults
4. DEFAULT_PERMISSIONS → hardcoded fallback (initial state)
```

### UX Details
- Each cell becomes a Checkbox toggle for Fisioterapeuta and Secretaria tabs
- Admin tab shows all green checks, non-interactive
- Auto-save on each toggle with toast feedback
- "Restaurar Padrão" button resets a role to the hardcoded defaults

