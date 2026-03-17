
ALTER TABLE public.respiratory_reports ADD COLUMN clinic_id uuid REFERENCES public.clinics(id);

UPDATE public.respiratory_reports r
SET clinic_id = p.clinic_id
FROM public.profiles p
WHERE r.created_by = p.user_id;

DROP POLICY IF EXISTS "Users can manage their own reports" ON public.respiratory_reports;

CREATE POLICY "Users can view reports from own clinic"
ON public.respiratory_reports FOR SELECT TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert reports in own clinic"
ON public.respiratory_reports FOR INSERT TO authenticated
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update reports in own clinic"
ON public.respiratory_reports FOR UPDATE TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete reports in own clinic"
ON public.respiratory_reports FOR DELETE TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));
