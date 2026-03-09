

# Create PatientDocuments Component + Storage Bucket

## Overview
Create the `PatientDocuments` component for uploading, listing, downloading, and deleting patient clinical documents. This also requires creating the `patient-documents` storage bucket since none exist yet.

## Changes

### 1. Create storage bucket via SQL migration
Create the `patient-documents` bucket with RLS policies allowing clinic members to manage files scoped to their clinic path.

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false);

CREATE POLICY "Clinic members can upload patient documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-documents' AND (storage.foldername(name))[1] = (SELECT clinic_id::text FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Clinic members can view patient documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-documents' AND (storage.foldername(name))[1] = (SELECT clinic_id::text FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Clinic members can delete patient documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-documents' AND (storage.foldername(name))[1] = (SELECT clinic_id::text FROM public.profiles WHERE user_id = auth.uid()));
```

### 2. Create `src/components/prontuarios/PatientDocuments.tsx`
The user's pasted content has JSX stripped (HTML rendering artifact). I will reconstruct the full component faithfully based on the provided logic:

- **Upload zone** with drag-and-drop, file validation (PDF, images, Word, Excel, max 20MB)
- **Upload form** with category selector (7 categories) and optional description
- **Document list** showing file icon, category badge, size, date, description
- **Download** via signed URL (60s expiry)
- **Delete** with AlertDialog confirmation
- **Progress bar** during upload
- Uses `patient-documents` storage bucket and `patient_documents` DB table (already exists)

### 3. No other files modified
Per user's implicit request, only the new component file is created. Integration into `Prontuarios.tsx` can be done separately.

