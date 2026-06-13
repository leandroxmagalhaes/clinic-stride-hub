
DROP VIEW IF EXISTS public.packs_com_contagem CASCADE;
DROP TABLE IF EXISTS public.scheduling_packages CASCADE;

ALTER TABLE public.sessoes
  DROP COLUMN IF EXISTS pack_grupo_id,
  DROP COLUMN IF EXISTS valor_pack_total,
  DROP COLUMN IF EXISTS package_id;

DROP TABLE IF EXISTS public.packs CASCADE;

ALTER TABLE public.sessoes DROP CONSTRAINT IF EXISTS sessoes_status_check;
ALTER TABLE public.sessoes ADD CONSTRAINT sessoes_status_check
  CHECK (status = ANY (ARRAY['agendado','confirmado','em_atendimento','finalizado','realizado','cancelado','faltou','falta','falta_cobrada']));

ALTER TABLE public.sessoes
  ADD COLUMN IF NOT EXISTS isento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS isento_motivo text,
  ADD COLUMN IF NOT EXISTS isento_por uuid,
  ADD COLUMN IF NOT EXISTS isento_em timestamptz;

CREATE TABLE public.packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  numero_pack int NOT NULL,
  total_sessoes int NOT NULL CHECK (total_sessoes > 0),
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente','pago')),
  payment_method text,
  paid_at timestamptz,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_validade date,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','expirado','cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, numero_pack)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packs TO authenticated;
GRANT ALL ON public.packs TO service_role;

ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY packs_select_own_clinic ON public.packs FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY packs_insert_own_clinic ON public.packs FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY packs_update_own_clinic ON public.packs FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY packs_delete_own_clinic ON public.packs FOR DELETE USING (clinic_id = public.get_user_clinic_id(auth.uid()));

ALTER TABLE public.sessoes
  ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE SET NULL,
  ADD COLUMN numero_no_pack int;

CREATE INDEX IF NOT EXISTS idx_sessoes_pack_id ON public.sessoes(pack_id);
CREATE INDEX IF NOT EXISTS idx_packs_paciente_status ON public.packs(paciente_id, status);

CREATE OR REPLACE FUNCTION public.packs_set_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.numero_pack IS NULL OR NEW.numero_pack = 0 THEN
    SELECT COALESCE(MAX(numero_pack), 0) + 1 INTO NEW.numero_pack
    FROM public.packs WHERE paciente_id = NEW.paciente_id;
  END IF;
  IF NEW.data_validade IS NULL THEN
    NEW.data_validade := NEW.data_inicio + INTERVAL '3 months';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER packs_set_defaults_trg BEFORE INSERT ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.packs_set_defaults();

CREATE TRIGGER packs_updated_at_trg BEFORE UPDATE ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recompute_pack_status(p_pack_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_total int; v_used int; v_status text;
BEGIN
  IF p_pack_id IS NULL THEN RETURN; END IF;
  SELECT total_sessoes, status INTO v_total, v_status FROM public.packs WHERE id = p_pack_id;
  IF v_total IS NULL THEN RETURN; END IF;
  IF v_status IN ('cancelado','expirado') THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_used FROM public.sessoes
  WHERE pack_id = p_pack_id AND isento = false
    AND status IN ('realizado','finalizado','falta_cobrada');

  IF v_used >= v_total THEN
    UPDATE public.packs SET status = 'concluido' WHERE id = p_pack_id AND status <> 'concluido';
  ELSE
    UPDATE public.packs SET status = 'ativo' WHERE id = p_pack_id AND status = 'concluido';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_session_recompute_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.recompute_pack_status(OLD.pack_id); RETURN OLD; END IF;
  PERFORM public.recompute_pack_status(NEW.pack_id);
  IF TG_OP = 'UPDATE' AND OLD.pack_id IS DISTINCT FROM NEW.pack_id THEN
    PERFORM public.recompute_pack_status(OLD.pack_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessoes_pack_recompute
AFTER INSERT OR DELETE OR UPDATE OF status, pack_id, isento ON public.sessoes
FOR EACH ROW EXECUTE FUNCTION public.trg_session_recompute_pack();

CREATE OR REPLACE FUNCTION public.trg_set_numero_no_pack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.pack_id IS NULL THEN
    NEW.numero_no_pack := NULL;
  ELSIF NEW.numero_no_pack IS NULL THEN
    SELECT COALESCE(MAX(numero_no_pack), 0) + 1 INTO NEW.numero_no_pack
    FROM public.sessoes WHERE pack_id = NEW.pack_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessoes_set_numero_no_pack
BEFORE INSERT OR UPDATE OF pack_id ON public.sessoes
FOR EACH ROW EXECUTE FUNCTION public.trg_set_numero_no_pack();

CREATE OR REPLACE FUNCTION public.cancel_session_with_pack_rule(p_session_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_session public.sessoes%ROWTYPE; v_deadline timestamptz; v_new_status text;
BEGIN
  SELECT * INTO v_session FROM public.sessoes WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;

  IF v_session.pack_id IS NULL THEN
    UPDATE public.sessoes
    SET status = 'cancelado',
        notes = COALESCE(notes || E'\n','') || COALESCE('Cancelamento: ' || p_reason, '')
    WHERE id = p_session_id;
    RETURN jsonb_build_object('status','cancelado','cobrado',false);
  END IF;

  v_deadline := (((v_session.start_time AT TIME ZONE 'Europe/Lisbon')::date - INTERVAL '1 day')::date + TIME '14:00') AT TIME ZONE 'Europe/Lisbon';

  IF now() <= v_deadline THEN v_new_status := 'cancelado';
  ELSE v_new_status := 'falta_cobrada'; END IF;

  UPDATE public.sessoes
  SET status = v_new_status,
      notes = COALESCE(notes || E'\n','') || COALESCE('Cancelamento: ' || p_reason, '')
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', v_new_status, 'cobrado', v_new_status = 'falta_cobrada', 'deadline', v_deadline);
END;
$$;

CREATE OR REPLACE FUNCTION public.isentar_falta_cobrada(p_session_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.sessoes
  SET isento = true, isento_motivo = p_motivo, isento_por = auth.uid(), isento_em = now()
  WHERE id = p_session_id AND status = 'falta_cobrada';
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada ou não está em falta_cobrada'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_packs()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  UPDATE public.packs SET status = 'expirado'
  WHERE status = 'ativo' AND data_validade < CURRENT_DATE;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
