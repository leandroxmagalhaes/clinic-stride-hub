-- Create automation_flows table for managing engagement automation rules
CREATE TABLE public.automation_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('appointment_created', '24h_before', 'post_consultation', 'birthday', 'inactive_30_days')),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message_template TEXT NOT NULL,
  attachment_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0
);

-- Create index for faster lookups
CREATE INDEX idx_automation_flows_clinic_id ON public.automation_flows(clinic_id);
CREATE INDEX idx_automation_flows_trigger_type ON public.automation_flows(trigger_type);
CREATE INDEX idx_automation_flows_is_active ON public.automation_flows(is_active);

-- Enable RLS
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view automation flows from own clinic"
ON public.automation_flows
FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert automation flows in own clinic"
ON public.automation_flows
FOR INSERT
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update automation flows in own clinic"
ON public.automation_flows
FOR UPDATE
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete automation flows in own clinic"
ON public.automation_flows
FOR DELETE
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_automation_flows_updated_at
BEFORE UPDATE ON public.automation_flows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();