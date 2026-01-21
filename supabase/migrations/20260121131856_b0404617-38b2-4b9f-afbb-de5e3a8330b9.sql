-- Create sales_leads table for CRM/Commercial module
CREATE TABLE public.sales_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Lead info
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT DEFAULT 'manual', -- 'instagram', 'website', 'referral', 'manual'
  
  -- Kanban status
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'agendado', 'proposta', 'ganho', 'perdido')),
  
  -- Business data
  estimated_value NUMERIC DEFAULT 0,
  notes TEXT,
  
  -- Conversion tracking
  converted_patient_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view leads from own clinic"
  ON public.sales_leads FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert leads in own clinic"
  ON public.sales_leads FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update leads in own clinic"
  ON public.sales_leads FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete leads in own clinic"
  ON public.sales_leads FOR DELETE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_sales_leads_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_sales_leads_clinic_status ON public.sales_leads(clinic_id, status);
CREATE INDEX idx_sales_leads_created_at ON public.sales_leads(created_at DESC);