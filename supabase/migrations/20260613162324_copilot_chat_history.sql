-- Histórico de conversas do Copiloto (persistente por utilizador)
CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL,
  user_id     uuid NOT NULL,
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  content     text NOT NULL DEFAULT '',
  file_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_user
  ON public.copilot_messages (user_id, created_at);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

-- Cada utilizador só vê e escreve as suas próprias mensagens, dentro da sua clínica
CREATE POLICY copilot_messages_select_own ON public.copilot_messages
  FOR SELECT USING (user_id = auth.uid() AND clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY copilot_messages_insert_own ON public.copilot_messages
  FOR INSERT WITH CHECK (user_id = auth.uid() AND clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY copilot_messages_delete_own ON public.copilot_messages
  FOR DELETE USING (user_id = auth.uid());
