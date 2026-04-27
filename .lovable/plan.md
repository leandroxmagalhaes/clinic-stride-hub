Vou corrigir isto tratando o `template_id` do questionário já iniciado/preenchido como a fonte de verdade. Assim, se o utente começou o questionário Bebé (0-2 anos), ao editar/continuar no portal aparecerá sempre exatamente o mesmo modelo, e não o modelo sugerido por idade ou pelo convite mais recente.

Plano de implementação:

1. Corrigir a resolução do modelo no portal
- Ajustar `QuestionnaireTemplateService.resolveForPatient()` para priorizar rigidamente:
  1) `portal_questionario.template_id` existente;
  2) se não houver `template_id`, mapear `portal_questionario.perfil_tipo` corretamente, incluindo valores novos como `template_baby_complete`, `template_child`, etc.;
  3) convite mais recente apenas quando ainda não existir questionário iniciado;
  4) idade/data de nascimento apenas como último recurso.
- Isto evita que um convite posterior ou uma inferência por idade substitua o questionário que já estava em uso.

2. Corrigir o bug específico de `perfil_tipo`
- Atualmente há registos onde `perfil_tipo` pode estar como `template_baby_complete` em vez de `baby`. Vou tornar o mapeamento compatível com os dois formatos:
  - `baby` e `template_baby_complete` → Avaliação Bebé (0-2 anos)
  - `child` e `template_child` → Avaliação Criança (2-12 anos)
  - `adult` e `template_adult` → Avaliação Adulto
  - `elderly` e `template_elderly` → Avaliação Idoso

3. Sincronizar o onboarding e a edição no Portal do Utente
- Em `PortalOnboarding.tsx`, carregar primeiro o questionário existente e o seu `template_id` antes de sugerir qualquer modelo.
- Em `PatientPortal.tsx` e `FullQuestionnaireView.tsx`, manter o mesmo modelo já gravado no questionário ao abrir a edição.
- Ao guardar progresso ou concluir, preservar o `template_id` correto em vez de recalcular o modelo.

4. Corrigir os dados já afetados
- Aplicar uma migração/backfill segura para registos inconsistentes, incluindo o caso em que o convite indicava Bebé mas o questionário ficou associado a Criança.
- Regra da correção: só alterar `template_id` quando houver uma evidência mais forte do modelo original, como `perfil_tipo = 'baby'`/`template_baby_complete` ou convite utilizado com `template_baby_complete` e sem respostas incompatíveis.
- Não apagar respostas existentes.

5. Garantir que o conteúdo integral continua preservado
- Manter a renderização dos parágrafos explicativos (`intro`, `description`, `helpText`) já adicionada.
- Não remover nenhuma secção/campo do questionário.
- O badge/título no portal deverá mostrar “Avaliação Bebé (0-2 anos)” quando esse for o questionário iniciado.

Resultado esperado:
- O questionário que estava a ser preenchido como Bebé (0-2 anos) continuará a abrir como Bebé (0-2 anos) no Portal do Utente.
- O sistema deixará de trocar automaticamente para Criança (2-12 anos) ao editar/continuar.
- Convites futuros também manterão o modelo escolhido pela clínica de forma consistente.