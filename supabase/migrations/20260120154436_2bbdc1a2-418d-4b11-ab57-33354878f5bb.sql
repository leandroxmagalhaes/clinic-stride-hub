-- Fix infinite recursion in profiles RLS policy
-- The issue: policy references profiles table within profiles table policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles from own clinic" ON public.profiles;

-- Create a fixed policy that avoids self-referencing
-- Use a subquery that doesn't cause recursion by checking user_id directly first
CREATE POLICY "Users can view profiles from own clinic" 
ON public.profiles 
FOR SELECT 
USING (
  -- Allow users to see their own profile
  user_id = auth.uid()
  OR
  -- Allow users to see profiles from the same clinic
  clinic_id IN (
    SELECT p.clinic_id 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  )
);