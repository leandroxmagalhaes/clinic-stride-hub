
-- Backfill template_id on portal_questionario records that still don't have one,
-- mapping by perfil_tipo to the corresponding system template. Existing answers
-- in dados_pessoais / perfil_saude / expectativas are preserved untouched —
-- this only links them to the full template so the integral view becomes available.
UPDATE public.portal_questionario q
SET template_id = t.id
FROM public.portal_questionario_templates t
WHERE q.template_id IS NULL
  AND t.is_system = true
  AND (
    (q.perfil_tipo = 'baby'    AND t.identifier = 'template_baby_complete') OR
    (q.perfil_tipo = 'child'   AND t.identifier = 'template_child') OR
    (q.perfil_tipo = 'adult'   AND t.identifier = 'template_adult') OR
    (q.perfil_tipo = 'elderly' AND t.identifier = 'template_elderly')
  );
