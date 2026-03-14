CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES public.automation_flows(id) ON DELETE SET NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  sessao_id UUID REFERENCES public.sessoes(id) ON DELETE SET NULL,
  trigger_type TEXT,
  channel TEXT DEFAULT 'email',
  recipient_email TEXT,
  subject TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation logs from own clinic"
  ON public.automation_logs FOR SELECT
  TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert automation logs in own clinic"
  ON public.automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));