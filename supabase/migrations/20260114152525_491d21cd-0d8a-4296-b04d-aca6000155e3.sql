-- Add DELETE policy for profiles table (admin only or own profile)
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (user_id = auth.uid());

-- Add DELETE policy for pacientes table (same clinic members)
CREATE POLICY "Users can delete patients in own clinic" ON public.pacientes
  FOR DELETE USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Add trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    'fisioterapeuta'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();