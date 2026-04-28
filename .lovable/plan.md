
# Correção do Questionário Errado no Portal

## Causa-raiz (já diagnosticada)

`QuestionnaireTemplateService.resolveForPatient` considera `dados_pessoais` (bucket legacy de identificação) como "respostas". Como o Bernardo tem morada/telefone/encarregado preenchidos lá, a função classifica o questionário como "preenchido" e ignora os 3 convites recentes que apontam para `template_baby_complete`. Devolve então o `template_id` antigo (`template_child`) gravado em 2026-03-31.

## Passo 1 — Ajustar deteção de "respostas" em `resolveForPatient`

Em `src/services/QuestionnaireTemplateService.ts`, substituir a função interna `hasAnswers` por `hasClinicalAnswers` que **olha apenas para o bucket `respostas`** (sectionId → fieldKey → valor), ignorando `dados_pessoais`, `perfil_saude` e `expectativas`. Estes três últimos são identificação/onboarding legacy e nunca devem trancar o template.

## Passo 2 — Reforçar override por convite recente

Sempre que exista questionário sem respostas clínicas e um convite com `template_id`, o convite ganha se:
- foi criado **depois** de `portal_questionario.updated_at`, OU
- aponta para um `template_id` **diferente** do gravado.

Isto é o que permite ao profissional corrigir um modelo errado simplesmente reenviando o convite com o template certo.

## Passo 3 — Sincronizar registo (best-effort)

Adicionar helper `syncResolvedTemplate(tpl)` que faz `UPDATE portal_questionario SET template_id, perfil_tipo` quando a função resolve um template diferente do gravado. Encapsulado em try/catch — se falhar, a UI continua a receber o template correto na mesma. Aplicado:
- após override por convite (passo 2)
- após resolução por `perfil_tipo` legacy

Não toca em `respostas`, `dados_pessoais`, `perfil_saude`, `expectativas`, `completo`, `created_at`.

## Passo 4 — Backfill SQL APENAS para o Bernardo

**Estado atual confirmado** (registo `2dab93bf-486c-47ad-90a1-68f96aec2b80`):

| Campo | Atual | Após backfill |
|---|---|---|
| `template_id` | `fc710d04…` (child) | `f6833e55-c2e9-4220-b5eb-94d15342f2c4` (baby_complete) |
| `perfil_tipo` | `child` | `template_baby_complete` |
| `respostas` | `{}` | **inalterado** |
| `dados_pessoais` | morada/telefone/encarregado preenchidos | **inalterado** |
| `perfil_saude`, `expectativas` | — | **inalterado** |
| `completo` | `true` | **inalterado** |
| `created_at` | 2026-03-31 22:21 | **inalterado** |

SQL exato (via insert-tool de migração de dados, com filtro duplo por `id` + `paciente_id` para evitar acidentes):

```sql
UPDATE public.portal_questionario
SET 
  template_id = 'f6833e55-c2e9-4220-b5eb-94d15342f2c4',
  perfil_tipo = 'template_baby_complete',
  updated_at  = now()
WHERE id = '2dab93bf-486c-47ad-90a1-68f96aec2b80'
  AND paciente_id = 'addc7d95-5226-42f1-9a09-b222225d69c7';
```

Sem `DELETE`, sem `TRUNCATE`, sem `ALTER`, sem alterações a outros pacientes. A Luiza Te Magalhães (`8e0bf437…`, 7 anos) **não é tocada** — `child` está correto para ela.

## Validação pós-execução

Após aplicar tudo, reporto ponto a ponto:
- [ ] Bernardo passa a mostrar "Avaliação Bebé (0-2 anos)" no portal.
- [ ] `dados_pessoais` do Bernardo intactos (morada Rua Fernandes Coelho, telefone, encarregado, email, birthDate).
- [ ] Luiza e restantes pacientes não afetados (query de verificação).
- [ ] Trace simulado de `resolveForPatient` para o Bernardo agora devolve `template_baby_complete` mesmo antes do backfill (graças aos passos 1 e 2), e o backfill apenas torna a decisão persistente.

## Ficheiros tocados

- `src/services/QuestionnaireTemplateService.ts` — função `resolveForPatient` (passos 1, 2, 3).
- Migração de dados (passo 4) — `UPDATE` único e seletivo no registo do Bernardo.

Nenhum outro ficheiro é alterado. Nenhuma tabela tem o esquema modificado.
