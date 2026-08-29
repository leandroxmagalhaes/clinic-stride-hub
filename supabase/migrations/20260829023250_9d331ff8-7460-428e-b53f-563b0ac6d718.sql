DROP POLICY IF EXISTS "Authenticated can view active templates in scope" ON public.portal_questionario_templates;
CREATE POLICY "Authenticated can view active templates in scope"
ON public.portal_questionario_templates
FOR SELECT
TO authenticated
USING (clinic_id IS NULL OR clinic_id = get_user_clinic_id(auth.uid()));

UPDATE public.portal_questionario_templates
SET is_active = false
WHERE identifier = 'template_child' AND clinic_id IS NULL;