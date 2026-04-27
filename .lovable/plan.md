Vou ajustar o fluxo para que o questionário completo fique sempre disponível no Portal do Utente para continuar, editar e rever, incluindo os parágrafos explicativos do modelo original.

Problema identificado
- O template Bebé já está na base de dados com 93 perguntas, 16 secções e parágrafos (`intro`/`description`/`helpText`).
- Porém, no Portal do Utente (`/patient-portal`) o ecrã só mostra a vista completa (`FullQuestionnaireView`) quando `completo = true`.
- Quando `completo = false`, o portal mostra apenas um cartão com botão “Continuar preenchimento”, em vez de mostrar o questionário na íntegra ali mesmo.
- Além disso, se a conta estiver marcada como onboarding incompleto, o portal redireciona para `/portal/onboarding`, criando uma experiência fragmentada e dando a impressão de que o questionário completo não está disponível no portal.

Plano de ajuste
1. Tornar o questionário integral sempre renderizável no Portal do Utente
   - Alterar `PatientPortal.tsx` para remover a bifurcação que esconde o questionário quando está incompleto.
   - Sempre que existir modelo resolvível, abrir a aba “Questionário de Saúde” com `FullQuestionnaireView`, independentemente de `completo` estar true ou false.
   - Manter o indicador “incompleto”, mas sem bloquear a visualização/edição integral.

2. Permitir criação/continuação mesmo sem registo completo ainda
   - Ajustar `FullQuestionnaireView.tsx` para suportar o caso em que existe template, mas ainda não existe linha em `portal_questionario`.
   - Nesse cenário, o componente deve abrir em modo editável/criável e fazer `upsert` por `paciente_id`, vinculando `template_id`, `perfil_tipo`, `respostas` e `completo` conforme a ação.
   - Para respostas já guardadas parcialmente, continuará a carregar `respostas` e fundir dados legados sem perder nada.

3. Separar “Guardar progresso” de “Concluir”
   - No modo de edição do questionário integral, adicionar/ajustar ações para:
     - “Guardar progresso”: guarda `respostas` com `completo = false`.
     - “Concluir questionário”: guarda `respostas` com `completo = true`.
   - Isso permite editar e/ou terminar o preenchimento sem obrigar o utente a sair para outro fluxo.

4. Garantir parágrafos explicativos em todos os modos
   - Confirmar no renderer integral que:
     - secções sem perguntas aparecem como cartões de orientação;
     - `section.intro` e `section.description` aparecem no topo de cada secção;
     - `field.helpText` aparece junto da pergunta, tanto na leitura como na edição.
   - Preservar a ordem original do template.

5. Ajustar o fluxo `/portal/onboarding`
   - Quando o utente clica “Sair e continuar depois”, redirecionar para o Portal do Utente com a aba do questionário, não para um estado que pareça esconder o formulário.
   - Manter o autosave existente no `DynamicQuestionnaireRenderer`, mas deixar o portal ser o ponto único para continuar/editar depois.

6. Atualizar a aba do portal no lado profissional
   - Em `PatientPortalTab.tsx`, substituir a pré-visualização antiga que mostra apenas `dados_pessoais/perfil_saude/expectativas` por `FullQuestionnaireView` em modo apropriado, para que a clínica também veja o questionário integral ali.
   - Manter a vista do Prontuário já baseada em `FullQuestionnaireView`.

Detalhes técnicos
- Ficheiros principais:
  - `src/pages/PatientPortal.tsx`
  - `src/components/patient-portal/FullQuestionnaireView.tsx`
  - `src/pages/PortalOnboarding.tsx`
  - `src/components/patients/PatientPortalTab.tsx`
- Não é necessária alteração estrutural de base de dados.
- Se for preciso atualizar dados do template, será uma atualização de dados no `portal_questionario_templates`, não uma migration de schema.
- A auditoria em `portal_questionario_historico` continuará a registar alterações campo a campo quando o questionário já existir; para primeira criação, o foco será guardar integralmente sem perda de dados.

Resultado esperado
- O Portal do Utente terá o questionário completo disponível na íntegra, esteja ele incompleto ou concluído.
- O utente poderá continuar, editar e finalizar no próprio portal.
- Os parágrafos explicativos do modelo original aparecerão junto das secções e perguntas.
- Profissionais verão o mesmo conteúdo integral, sem recortes por campos legados.