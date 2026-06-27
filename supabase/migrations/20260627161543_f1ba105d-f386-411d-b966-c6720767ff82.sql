ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS reminder_saudacao text
  DEFAULT 'Olá! Lembramos a consulta do/a {nome} no dia {data} às {hora}. Estamos a contar consigo 💙';

UPDATE public.clinic_settings
SET reminder_saudacao = 'Olá! Lembramos a consulta do/a {nome} no dia {data} às {hora}. Estamos a contar consigo 💙'
WHERE reminder_saudacao IS NULL;