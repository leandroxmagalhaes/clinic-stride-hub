ALTER TABLE public.clinics ADD COLUMN slug text UNIQUE;
UPDATE public.clinics SET slug = 'respira-desenvolve' WHERE slug IS NULL;
ALTER TABLE public.clinics ALTER COLUMN slug SET NOT NULL;