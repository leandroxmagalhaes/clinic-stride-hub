

## Add Permanent Delete Option for Admin Master

### Problem
Currently, "Apagar" only soft-deletes (sets `is_active = false`). The Admin Master needs an option to permanently delete a patient record from the database, with proper confirmation.

### Changes

**1. `src/contexts/DataContext.tsx`**
- Add a new `permanentlyDeletePatient` function that does a hard `DELETE` from `pacientes` table
- Add audit log entry before deletion
- Refresh patients list after
- Export it in the context

**2. `src/components/patients/PatientDetailModal.tsx`**
- Add new props: `onPermanentlyDeletePatient` and `isAdminMaster`
- Add a second `DeleteConfirmationDialog` for permanent deletion with stronger warnings
- Show two separate buttons in the footer when Admin Master:
  - "Inativar" (existing soft-delete) 
  - "Excluir Permanentemente" (new hard-delete, only for Admin Master)
- Non-admin users only see "Inativar"

**3. `src/pages/Pacientes.tsx`**
- Import `usePermissions` hook to get `isAdminMaster`
- Create `handlePermanentlyDeletePatient` that calls `supabase.from('pacientes').delete().eq('id', patientId)` + audit log + refresh
- Pass `onPermanentlyDeletePatient` and `isAdminMaster` to `PatientDetailModal`

### UX
- "Excluir Permanentemente" button is red/destructive, only visible to Admin Master
- Confirmation dialog has strong warning: "Esta ação é irreversível. Todos os dados do paciente serão apagados permanentemente."
- Existing "Inativar" button remains for all users with delete permission

