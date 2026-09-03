CREATE TABLE public.paciente_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  clinic_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('criado', 'indisponibilizado', 'reativado', 'arquivado', 'restaurado', 'excluido')),
  motivo text,
  executado_por uuid NOT NULL REFERENCES auth.users(id),
  executado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_paciente_auditoria_paciente ON public.paciente_auditoria (paciente_id);
CREATE INDEX idx_paciente_auditoria_clinic ON public.paciente_auditoria (clinic_id);

GRANT SELECT ON public.paciente_auditoria TO authenticated;
GRANT ALL ON public.paciente_auditoria TO service_role;

ALTER TABLE public.paciente_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem auditoria da sua clinica"
ON public.paciente_auditoria
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND clinic_id = public.get_user_clinic_id(auth.uid())
);

CREATE OR REPLACE FUNCTION public.registar_auditoria_paciente(
  p_paciente_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_clinic_id uuid;
  v_nome text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilizador nao autenticado';
  END IF;

  SELECT clinic_id INTO v_clinic_id
  FROM public.pacientes
  WHERE id = p_paciente_id;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Utente nao encontrado';
  END IF;

  SELECT full_name INTO v_nome
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  INSERT INTO public.paciente_auditoria (
    paciente_id, clinic_id, acao, motivo, executado_por, executado_por_nome
  ) VALUES (
    p_paciente_id, v_clinic_id, p_acao, p_motivo, v_user_id, v_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registar_auditoria_paciente(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_auditoria_paciente_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nome text;
BEGIN
  BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
      IF NEW.created_by IS NOT NULL THEN
        v_user_id := NEW.created_by;
      ELSE
        RETURN NEW;
      END IF;
    END IF;

    SELECT full_name INTO v_nome
    FROM public.profiles
    WHERE user_id = v_user_id
    LIMIT 1;

    INSERT INTO public.paciente_auditoria (
      paciente_id, clinic_id, acao, motivo, executado_por, executado_por_nome
    ) VALUES (
      NEW.id, NEW.clinic_id, 'criado', NULL, v_user_id, v_nome
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao registar auditoria de criacao do utente %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER paciente_auditoria_criado
AFTER INSERT ON public.pacientes
FOR EACH ROW
EXECUTE FUNCTION public.trg_auditoria_paciente_criado();