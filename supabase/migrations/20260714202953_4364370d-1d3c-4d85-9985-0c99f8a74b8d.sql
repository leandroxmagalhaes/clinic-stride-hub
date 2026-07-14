CREATE POLICY "Profissionais apagam historico"
ON public.portal_questionario_historico
FOR DELETE
USING (public.is_professional(auth.uid()));