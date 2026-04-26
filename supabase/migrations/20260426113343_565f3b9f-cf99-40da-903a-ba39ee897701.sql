
-- 1. Create templates table
CREATE TABLE public.portal_questionario_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  identifier text NOT NULL,
  name text NOT NULL,
  description text,
  estimated_minutes text,
  schema jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX portal_questionario_templates_identifier_unique
  ON public.portal_questionario_templates (COALESCE(clinic_id::text, 'system'), identifier);

ALTER TABLE public.portal_questionario_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone authenticated can view active templates"
  ON public.portal_questionario_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Professionals can insert templates in own clinic"
  ON public.portal_questionario_templates
  FOR INSERT
  WITH CHECK (
    public.is_professional(auth.uid())
    AND (clinic_id IS NULL OR clinic_id = public.get_user_clinic_id(auth.uid()))
  );

CREATE POLICY "Professionals can update non-system templates in own clinic"
  ON public.portal_questionario_templates
  FOR UPDATE
  USING (
    public.is_professional(auth.uid())
    AND is_system = false
    AND (clinic_id IS NULL OR clinic_id = public.get_user_clinic_id(auth.uid()))
  );

CREATE POLICY "Professionals can delete non-system templates in own clinic"
  ON public.portal_questionario_templates
  FOR DELETE
  USING (
    public.is_professional(auth.uid())
    AND is_system = false
    AND (clinic_id IS NULL OR clinic_id = public.get_user_clinic_id(auth.uid()))
  );

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_portal_questionario_templates_updated_at
  BEFORE UPDATE ON public.portal_questionario_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add template_id to portal_convites (nullable, no defaults change)
ALTER TABLE public.portal_convites
  ADD COLUMN template_id uuid REFERENCES public.portal_questionario_templates(id) ON DELETE SET NULL;

-- 3. Add template_id + respostas to portal_questionario (nullable, preserves all existing data)
ALTER TABLE public.portal_questionario
  ADD COLUMN template_id uuid REFERENCES public.portal_questionario_templates(id) ON DELETE SET NULL,
  ADD COLUMN respostas jsonb DEFAULT '{}'::jsonb;
