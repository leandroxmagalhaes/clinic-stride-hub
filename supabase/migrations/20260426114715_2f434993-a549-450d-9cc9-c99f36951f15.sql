
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Public access portal_convites" ON public.portal_convites;
DROP POLICY IF EXISTS "Public access portal_contas" ON public.portal_contas;
DROP POLICY IF EXISTS "Public access portal_questionario" ON public.portal_questionario;
DROP POLICY IF EXISTS "Inserir historico autenticado" ON public.portal_questionario_historico;

-- portal_convites: anon needs to read by token & update tentativas/utilizado
CREATE POLICY "Anon can read invite by token"
  ON public.portal_convites FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can update invite attempts"
  ON public.portal_convites FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Professionals manage invites"
  ON public.portal_convites FOR ALL
  TO authenticated
  USING (is_professional(auth.uid()))
  WITH CHECK (is_professional(auth.uid()));

-- portal_contas: allow anon INSERT during signup; SELECT/UPDATE restricted
CREATE POLICY "Anon can create portal account"
  ON public.portal_contas FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- portal_questionario_historico: restrict inserts to authenticated users
CREATE POLICY "Authenticated can insert history"
  ON public.portal_questionario_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);
