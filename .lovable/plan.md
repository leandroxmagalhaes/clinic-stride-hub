Vou corrigir isto como fluxo completo, não como mais um remendo. O problema principal é que hoje existem dois caminhos em paralelo:

1. O questionário dinâmico completo, com 15 secções e 93 campos para Bebé.
2. Um modal antigo/resumido de “Atualizar dados de saúde”, que continua a aparecer para alguns utentes e só mostra poucos campos.

Além disso, o acesso ao questionário depende demasiado de `template_id` no convite/questionário. Se o utente tiver um questionário antigo, incompleto, sem `template_id`, ou se voltar depois pelo portal, o sistema cai para a versão resumida ou para o diário.

## Plano de correção

### 1. Tornar o questionário integral a fonte única
- Remover do Portal do Utente a experiência resumida do `EditHealthProfileModal` para este caso.
- Usar sempre a vista integral (`FullQuestionnaireView`) quando existir ou puder existir um template clínico.
- O botão/aba do portal deixará claro: “Questionário de Saúde” / “Continuar questionário”.

### 2. Recuperar questionários existentes sem `template_id`
- Criar uma rotina segura para resolver o template correto quando o questionário existente não tem `template_id`.
- Para `perfil_tipo = baby` ou idade 0-2 anos: associar ao template completo `template_baby_complete`.
- Preservar os dados já preenchidos em `dados_pessoais`, `perfil_saude` e `expectativas`, convertendo-os para o formato dinâmico quando possível, sem apagar nada.
- Manter todos os campos do template completo disponíveis mesmo que ainda estejam vazios.

### 3. Garantir “preencher, guardar, sair e continuar depois”
- Corrigir o fluxo do Portal Onboarding para encontrar o template por esta ordem:
  1. questionário existente com `template_id`,
  2. convite mais recente com `template_id`,
  3. perfil/idade do utente, usando o template completo correspondente.
- Se já houver respostas parciais, abrir o questionário diretamente com as respostas carregadas ou mostrar a opção “Continuar de onde parei”.
- “Sair e continuar depois” deve guardar progresso e levar o utente ao portal sem perder a ligação.

### 4. Mostrar o questionário integral também no Portal do Utente após login
- No `/patient-portal`, a aba “Questionário de Saúde” ficará disponível mesmo quando o questionário antigo não tem `template_id`.
- Se o questionário ainda estiver incompleto, o portal mostrará “Continuar preenchimento” e abrirá o formulário integral, não o modal resumido.
- Se estiver completo, permitirá visualizar tudo e editar tudo.

### 5. Manter auditoria completa
- Toda edição posterior continuará a gravar histórico por campo alterado em `portal_questionario_historico`.
- A autoria continuará identificando se foi “utente” ou “profissional”.
- Para alterações feitas ao completar/editar o questionário integral, o histórico será registado campo a campo.

### 6. Corrigir a visão dos profissionais
- No Prontuário/Anamnese, quando o utente tiver questionário antigo ou sem `template_id`, o profissional também verá a versão integral reconstruída sempre que for possível inferir o template.
- Manter regra de permissões: Admin e profissional atribuído podem editar; secretaria só visualiza.

## Detalhes técnicos

- Criar helpers no `QuestionnaireTemplateService` para:
  - obter template por identifier,
  - sugerir template por `perfil_tipo` e data de nascimento,
  - migrar respostas legacy para `respostas` dinâmicas sem perda.
- Ajustar `PortalOnboarding.tsx` para não depender apenas do convite com `template_id`.
- Ajustar `PatientPortal.tsx` para substituir o botão/modal resumido por acesso integral ao questionário.
- Ajustar `FullQuestionnaireView.tsx` para poder criar/normalizar um questionário quando ele ainda não existe ou existe sem template.
- Ajustar `QuestionnaireHealthSummary.tsx` para usar a vista integral também nos registos legacy quando o template puder ser resolvido.
- Adicionar migração/rotina de dados para associar questionários legacy de bebé ao template completo, preservando dados existentes.

## Resultado esperado

Depois da correção:

- O utente consegue preencher o questionário completo.
- Pode sair e continuar depois.
- Ao voltar a fazer login, não cai no diário nem num formulário reduzido.
- Pode editar/aditar o questionário completo no portal.
- Profissionais visualizam e editam a versão completa quando autorizados.
- Secretárias apenas visualizam.
- O histórico mantém quem alterou, quando, perfil e valores alterados.
- O template Bebé mantém as 15 secções e 93 campos na íntegra.