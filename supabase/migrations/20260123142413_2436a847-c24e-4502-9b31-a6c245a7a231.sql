-- =====================================================
-- AUTOMATION: Auto-assign 'patient' role on user signup
-- =====================================================

-- Update the handle_new_user function to also assign 'patient' role by default
-- Professionals/Admins will have their roles managed manually or through the clinic panel
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    'fisioterapeuta'
  );
  
  -- Auto-assign 'patient' role to all new users by default
  -- Clinic admins can upgrade to 'professional' or 'admin' as needed
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER: Function to link pacientes record to auth user
-- =====================================================

-- When a patient is created via clinic panel with an email,
-- we need to track this for when/if they register
CREATE OR REPLACE FUNCTION public.link_patient_to_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_user_id UUID;
BEGIN
  -- If patient has an email, check if a matching auth user exists
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO matched_user_id
    FROM auth.users
    WHERE email = NEW.email
    LIMIT 1;
    
    -- If user exists, ensure they have patient role
    IF matched_user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (matched_user_id, 'patient')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for patient creation
DROP TRIGGER IF EXISTS on_patient_created ON public.pacientes;
CREATE TRIGGER on_patient_created
  AFTER INSERT ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.link_patient_to_user();

-- Also run on update (in case email is added later)
DROP TRIGGER IF EXISTS on_patient_updated ON public.pacientes;
CREATE TRIGGER on_patient_updated
  AFTER UPDATE OF email ON public.pacientes
  FOR EACH ROW 
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.link_patient_to_user();