

## Fix: Cascade Delete Failing Due to `import_queue` FK Constraint

### Root Cause
The console logs show error `23503`: the `import_queue` table has a foreign key `import_queue_suggested_patient_id_fkey` referencing `pacientes`. The cascade delete service does not clear this reference before deleting the patient.

### Fix

**`src/services/PatientCascadeDeleteService.ts`**
- Add nullification of `import_queue.suggested_patient_id` before deleting the patient (same pattern as `sales_leads`)
- Add it to step 5 alongside the existing `sales_leads` nullification:
  ```typescript
  await supabase.from('import_queue').update({ suggested_patient_id: null }).eq('suggested_patient_id', patientId);
  ```

Single line addition. No other changes needed.

