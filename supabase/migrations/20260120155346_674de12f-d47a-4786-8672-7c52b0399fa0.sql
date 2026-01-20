-- Fix infinite recursion properly using a SECURITY DEFINER function

-- 1. Create a security definer function to get user's clinic_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_clinic_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id 
  FROM public.profiles 
  WHERE user_id = p_user_id
  LIMIT 1
$$;

-- 2. Drop the problematic policy again
DROP POLICY IF EXISTS "Users can view profiles from own clinic" ON public.profiles;

-- 3. Create a fixed policy using the security definer function
CREATE POLICY "Users can view profiles from own clinic" 
ON public.profiles 
FOR SELECT 
USING (
  user_id = auth.uid()
  OR
  clinic_id = public.get_user_clinic_id(auth.uid())
);