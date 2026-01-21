
-- Create clinic_settings table for storing all configuration
CREATE TABLE public.clinic_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL UNIQUE,
  
  -- General settings
  clinic_name TEXT,
  timezone TEXT DEFAULT 'Europe/Lisbon',
  language TEXT DEFAULT 'pt-PT',
  
  -- Appearance/Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#10B981',
  
  -- Automation settings
  whatsapp_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view settings from own clinic"
ON public.clinic_settings
FOR SELECT
USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert settings for own clinic"
ON public.clinic_settings
FOR INSERT
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update settings in own clinic"
ON public.clinic_settings
FOR UPDATE
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_clinic_settings_updated_at
BEFORE UPDATE ON public.clinic_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
