ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS reminder_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_antecedencia_horas integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS mbway_nome_1 text,
  ADD COLUMN IF NOT EXISTS mbway_numero_1 text,
  ADD COLUMN IF NOT EXISTS mbway_nome_2 text,
  ADD COLUMN IF NOT EXISTS mbway_numero_2 text,
  ADD COLUMN IF NOT EXISTS iban_nome text,
  ADD COLUMN IF NOT EXISTS iban text;

UPDATE public.clinic_settings SET
  mbway_nome_1   = 'Camila',
  mbway_numero_1 = '936199832',
  mbway_nome_2   = 'Leandro',
  mbway_numero_2 = '936199829',
  iban_nome      = 'Camila',
  iban           = 'PT50 0018 0003 5725 0334 0202 7'
WHERE clinic_id IN (SELECT id FROM public.clinics WHERE name ILIKE '%Respira%');