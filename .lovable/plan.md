
## Objectivo

Repor o questionário **Bebé (0-2 anos)** com a mesma profundidade técnica do formulário original da clínica, garantir que tanto o utente como os profissionais autorizados conseguem **ver e editar a versão integral**, e registar **todas** as alterações em auditoria. Adulto, Criança e Idoso ficam intactos.

Linguagem: pt-PT em todos os textos novos.

---

## 1. Reconstruir o template Bebé (`template_baby_complete`)

Novo schema JSON com **15 secções** que reproduzem fielmente o questionário original (d7_1 + d7_2), mantendo a ordem do PDF e os textos descritivos como subtítulos.

| # | Secção | Notas |
|---|--------|-------|
| 1 | Identificação do menor | Nome, data nasc., sexo, morada completa (rua, complemento, código postal, localidade, distrito) |
| 2 | Filiação e responsável | Nome do pai, ocupação; nome da mãe, ocupação; NIF do responsável financeiro; email e telemóvel da filiação; observações de faturação |
| 3 | Indicação clínica | Quem indicou (nome + telefone); pediatra responsável (nome + telefone) |
| 4 | Ficha Clínica – paragrafo introdutório | Diagnóstico clínico (se houver); queixa principal; quando começou |
| 5 | Histórico Pré-Natal | Alterações de saúde da mãe; medicação contínua; idade da mãe ao nascer; primeiro filho; primeira gestação (Sim/Não); gestações anteriores; bebé planeado; tipo de gestação (5 opções); ecografias (Sim/Não); alterações detectadas; movimentação fetal; intercorrências/traumas; sangramento (Sim/Não); semanas de sangramento; ácido fólico (período + dose); medicamentos durante a gravidez |
| 6 | Estado da Mãe (escalas 0-10) | Capacidade de cuidar do bebé; tempo a sentir-se feliz; recuperação física do parto; doulagem/preparo perineal; preparo das mamas; fisioterapia pélvica; uso de epi-no |
| 7 | Parto – paragrafo introdutório | Descrição completa do parto; modalidade (vaginal/cesariana/emergência); anestesia; ocitocina sintética; idade gestacional (semanas); peso ao nascer; apresentação do bebé (6 opções); auxiliares de parto (3 opções); manobras realizadas; experiência do parto 0-10 |
| 8 | Nascimento e primeiros minutos | APGAR; primeiro choro (intensidade/duração); mamou (após quanto tempo); desconexão do cordão (4 opções); dias para cair o cordão |
| 9 | Primeiros Dias do bebé – paragrafo introdutório | Dias de internação pós-parto; sonda de alimentação; auxílio respiratório; cirurgias; frénulo lingual; estomia; descrição da alimentação; medicação actual com doses |
| 10 | Desenvolvimento do bebé – paragrafo introdutório | Alterações de forma/assimetrias; **checklist motora completa** (~30 opções multiselect com toda a lista do PDF — supino, prono, rolar, pivotear, gato, rastejar, engatinhar, etc); idade actual em meses |
| 11 | Saúde e Vacinação | Vacinas em dia (Sim/Não/Parcial); alergias conhecidas; doenças/internamentos posteriores; episódios respiratórios |
| 12 | Sono e Comportamento | Padrão de sono; horas por dia; cólicas/refluxo; choro fácil/inconsolável |
| 13 | Eliminações | Padrão urinário; padrão intestinal; uso de fralda |
| 14 | Expectativas dos pais | O que esperam alcançar; preocupações principais; frequência pretendida |
| 15 | Consentimento | Autoriza fotos/vídeos clínicos; uso anónimo educativo; contacto WhatsApp/email; aceita RGPD; assinatura (nome do responsável); data |

Tipos de campo usados (já suportados pelo `DynamicQuestionnaireRenderer`): `text`, `textarea`, `date`, `select`, `multiselect`, `slider`, `checkbox`. Cada secção pode incluir um campo `description` (parágrafo explicativo) — adiciono suporte simples para isso na renderização.

---

## 2. Visualização e edição integral no Prontuário (lado profissional)

O componente `QuestionnaireHealthSummary.tsx` actualmente mostra apenas um conjunto fixo de ~15 campos. Vou:

- Detectar se existe `template_id` + `respostas` no registo `portal_questionario`.
  - **Se sim** (questionário dinâmico): carregar o template e renderizar **todas** as secções e campos exactamente como o paciente preencheu, agrupados por secção, em modo só-leitura por defeito.
  - **Se não** (registo legado): manter o comportamento actual com os campos fixos para compatibilidade.
- Adicionar botão **"Editar questionário"** visível apenas a:
  - `admin` da clínica, **OU**
  - profissional com atribuição directa ao utente em `professional_patient_assignments` (uso o helper já existente `professional_can_access_patient`).
  - `secretary` vê mas **não** edita.
- Em modo edição, usar o mesmo `DynamicQuestionnaireRenderer` (ou variante leve) para permitir alteração campo-a-campo.
- Ao gravar: para cada campo alterado, gerar **um insert** em `portal_questionario_historico` (`alterado_por` = nome do profissional + " (profissional)"; `campo_alterado`, `valor_anterior`, `valor_novo`). O componente `ChangeHistorySection` já lê esta tabela e mostra a timeline, mantenho-o.

---

## 3. Edição pelo paciente no Portal

No `PatientPortal.tsx` adicionar uma nova entrada de menu **"Meu questionário de saúde"** (além do diário existente) que:

- Abre o `DynamicQuestionnaireRenderer` em modo **leitura + edição**, pré-carregado com `respostas` do registo do paciente.
- Permite alterar qualquer campo e submeter.
- No submit, faz `upsert` em `portal_questionario` (mantém `template_id`) e regista cada campo alterado em `portal_questionario_historico` com `alterado_por` = nome do utente + " (utente)".
- Substitui o `EditHealthProfileModal` actual (que opera sobre os campos fixos legados) — fica a apontar para esta nova vista, evitando divergência.

---

## 4. Auditoria — garantir cobertura total

A tabela `portal_questionario_historico` já existe com o schema correcto (`questionario_id`, `paciente_id`, `campo_alterado`, `valor_anterior`, `valor_novo`, `alterado_por`, `created_at`) e a RLS permite leitura ao utente e a profissionais. Não é preciso migration.

Para que a auditoria seja consistente, crio um helper utilitário `logQuestionnaireChanges(questionarioId, pacienteId, antes, depois, alteradoPor)` em `src/services/QuestionnaireTemplateService.ts` que:

- Compara objecto `respostas` antes/depois (recursivamente por secção→campo).
- Para cada diferença, faz **um insert individual** em `portal_questionario_historico` (respeitando a regra do projecto de nunca usar inserts em batch).
- O campo `campo_alterado` recebe `"<id_seccao>.<chave_campo>"` para distinguir; o `FIELD_LABELS` no `QuestionnaireHealthSummary` é alargado para mapear estas chaves para o `label` legível do template carregado.

---

## 5. Migrations e dados

Uma única migration que:

1. Faz `UPDATE` ao registo `template_baby_complete` em `portal_questionario_templates` substituindo o `schema` pelo novo JSON completo (e actualizando `name`, `description`, `estimated_minutes`).
2. Mantém `is_system = true` para impedir alteração acidental no UI.

Não toca em RLS, tabelas ou triggers — tudo o que é necessário já existe.

---

## 6. Ficheiros a alterar

- `supabase/migrations/<novo>.sql` — update do template Bebé.
- `src/services/QuestionnaireTemplateService.ts` — adicionar `logQuestionnaireChanges()` e tipos auxiliares.
- `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx` — suportar `description` opcional nas secções; modo leitura.
- `src/components/prontuarios/QuestionnaireHealthSummary.tsx` — fluxo dinâmico + edição com permissões.
- `src/pages/PatientPortal.tsx` — entrada para o questionário completo.
- `src/components/patient-portal/EditHealthProfileModal.tsx` — substituir conteúdo pelo novo fluxo dinâmico (ou tornar wrapper).
- (Sem alterações a `portal_questionario` schema, `portal_questionario_historico`, RLS ou triggers.)

---

## Regras invioláveis

- Inserts individuais (uma linha de cada vez), conforme convenção do projecto.
- Linguagem em pt-PT.
- Nada removido das outras templates.
- Histórico **completo**: cada alteração a cada campo gera um registo, com identificação da pessoa, perfil (utente/profissional) e timestamp.
