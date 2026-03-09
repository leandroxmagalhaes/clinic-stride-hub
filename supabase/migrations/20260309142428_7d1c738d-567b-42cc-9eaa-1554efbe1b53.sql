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