
## Objetivo

Reescrever por completo o template **`template_baby_complete`** para que fique **idêntico ao questionário original** anexado, **sem remover nenhuma pergunta**, e adicionar os **parágrafos explicativos** (boas‑vindas, cabeçalhos de secção e instruções por pergunta) que aparecem no Google Forms original. O questionário disponível para edição no Portal do Utente passará a mostrar o conteúdo na íntegra, com esses textos.

## Diagnóstico

O template atual no banco (`identifier = template_baby_complete`, 15 secções) já tem todas as perguntas estruturais, mas:

1. Não tem o **texto de boas‑vindas** ("Esse formulário é o primeiro passo… 20 a 30 minutos…").
2. Os **cabeçalhos de secção** estão curtos — faltam os parágrafos explicativos do original (ex.: "Nesse item vamos descrever toda a história do seu bebê…", "O parto - nasce um bebé e uma nova mãe…", "Quase acabando, descreva hábitos intestinais…").
3. Algumas **perguntas longas perderam o texto auxiliar** (ex.: "Em qual etapa se encontra o bebé? Marque as janelas que ele já faz lembrando que as aquisições estão em ordem…").
4. O renderizador (`DynamicQuestionnaireRenderer` e `FullQuestionnaireView`) **já mostra** `section.description`, mas **não mostra** texto explicativo por campo (`field.helpText`).

## Plano

### 1. Estender o schema do template (sem quebrar dados existentes)

Adicionar dois campos opcionais ao tipo `TemplateField` em `src/services/QuestionnaireTemplateService.ts`:

- `helpText?: string` — parágrafo explicativo mostrado por baixo do label da pergunta.
- `placeholder?: string` — já existe; manter.

E ao `TemplateSection`:
- `intro?: string` — parágrafo longo de abertura da secção (além do `description` curto), opcional.

Estes campos são opcionais e não afetam respostas guardadas nem migrações anteriores.

### 2. Renderizar os textos explicativos no Portal e no Prontuário

Atualizar **`FullQuestionnaireView.tsx`** e **`DynamicQuestionnaireRenderer.tsx`**:

- Mostrar `section.description` + `section.intro` (parágrafo longo) no topo da secção.
- Mostrar `field.helpText` em texto pequeno (`text-xs text-muted-foreground`) por baixo do label de cada pergunta que tenha esse texto.
- Aplicar tanto no modo de preenchimento como no modo de visualização do profissional.

### 3. Migração: reescrever o `schema` do `template_baby_complete`

Migração SQL que faz `UPDATE` no registo existente (mesmo `id`, mesmo `identifier`) para substituir o `schema` por uma versão completa contendo:

- **Secção 0 (nova): "Boas‑vindas"** apenas com `description`/`intro` (sem campos), com o texto:
  > "Este formulário é o primeiro passo para iniciarmos a avaliação e aproveitarmos ao máximo o seu horário de sessão. Vai levar entre 20 e 30 minutos para completar. Quanto mais completo, melhor o perfil analisado."
- Para cada secção do questionário original, manter **todas as perguntas atuais** e adicionar `intro` com o texto explicativo do Google Forms (ex.: "Nesse item vamos descrever toda a história do seu bebé…", "O parto — nasce um bebé e uma nova mamãe…", "Primeiros dias do bebé — vamos começar a conhecer a história do bebé, suas dificuldades…", "Desenvolvimento do bebé — vamos analisar as funções básicas…", "Quase acabando, descreva hábitos intestinais…").
- Para perguntas que tinham instruções longas no original, preencher `helpText` (ex.: "Em qual etapa se encontra o bebé? — Marque as janelas que ele já faz lembrando que as aquisições estão em ordem; se o bebé é muito pequeno, pode parar quando as respostas começarem a não encaixar…").
- Manter **exatamente** os mesmos `key`s já gravados nas respostas, para que o que já foi preenchido **não se perca**.
- Manter a ordem das 15 secções existentes (apenas adicionando "Boas‑vindas" como secção 1 informativa, sem campos obrigatórios).

A migração será **idempotente** (só atualiza o registo `identifier = 'template_baby_complete'`).

### 4. Validar que nada se perde

- O renderizador continua a usar `respostas[sectionId][fieldKey]`. Como nenhum `key` é alterado, todas as respostas existentes continuam a aparecer.
- A lógica de auditoria (`logQuestionnaireChanges`) e de merge de legados (`mergeLegacyIntoRespostas`) não muda.
- Secções sem campos (apenas informativas, como "Boas‑vindas") são suportadas pelo renderizador (já itera fields, vazio = só mostra cabeçalho/intro).

### 5. RBAC e fluxo (sem alterações)

- Portal do Utente: aba "Questionário de Saúde" mostra a versão integral, com textos.
- Prontuário/Anamnese: profissionais autorizados veem e editam tudo; secretárias só visualizam.
- "Sair e continuar depois" continua a funcionar via `PortalAccountService` + retomada por `PortalOnboarding`.

## Ficheiros a alterar

- `src/services/QuestionnaireTemplateService.ts` — adicionar `helpText` e `intro` aos tipos.
- `src/components/patient-portal/FullQuestionnaireView.tsx` — render de `intro` e `helpText`.
- `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx` — render de `intro` e `helpText`.
- Nova migração SQL — `UPDATE portal_questionario_templates SET schema = … WHERE identifier = 'template_baby_complete'`.

## Resultado esperado

- O utente vê o questionário **idêntico ao Google Forms original**, com os parágrafos de "Boas‑vindas", os textos explicativos por secção (Ficha Clínica, Histórico Pré‑Natal, Parto, Primeiros dias, Desenvolvimento, etc.) e as instruções longas em perguntas específicas.
- **Nenhuma pergunta é removida**; todas as respostas já gravadas continuam visíveis.
- Disponível para preencher, continuar mais tarde e editar a partir do Portal e do Prontuário.
