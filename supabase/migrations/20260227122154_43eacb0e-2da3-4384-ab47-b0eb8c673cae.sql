
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  patient_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_clinic_read_created ON public.notifications(clinic_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic members can manage notifications"
ON public.notifications FOR ALL
USING (clinic_id = get_user_clinic_id(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
