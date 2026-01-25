-- Add 'secretary' role to the existing app_role enum
-- This must be done in a separate transaction before using the value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretary';