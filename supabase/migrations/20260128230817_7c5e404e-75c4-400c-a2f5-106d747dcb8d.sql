-- Add website column to clinics table
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS website text;

-- Add UPDATE policy for clinics (currently missing)
CREATE POLICY "Users can update own clinic"
ON public.clinics
FOR UPDATE
USING (id IN (
  SELECT clinic_id FROM profiles WHERE user_id = auth.uid()
))
WITH CHECK (id IN (
  SELECT clinic_id FROM profiles WHERE user_id = auth.uid()
));