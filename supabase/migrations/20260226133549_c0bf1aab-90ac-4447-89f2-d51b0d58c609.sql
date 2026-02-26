
CREATE TABLE public.import_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  raw_data jsonb NOT NULL,
  suggested_patient_id uuid REFERENCES public.pacientes(id),
  suggested_service_id uuid REFERENCES public.servicos(id),
  match_confidence numeric,
  import_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.import_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view import queue from own clinic"
  ON public.import_queue FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert into import queue in own clinic"
  ON public.import_queue FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update import queue in own clinic"
  ON public.import_queue FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete import queue in own clinic"
  ON public.import_queue FOR DELETE
  USING (clinic_id = get_user_clinic_id(auth.uid()));
