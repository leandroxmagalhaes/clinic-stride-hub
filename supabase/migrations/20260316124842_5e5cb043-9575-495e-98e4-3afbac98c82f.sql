
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  UNIQUE (clinic_id, role)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can view role permissions in own clinic" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));
