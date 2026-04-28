# Correção — Escala de Dor (EVA) inicia em 0

## Contexto

Após pesquisa no código (`escala_dor`, `EVA`, `escalaDor`), os únicos formulários clínicos onde o profissional regista a Escala de Dor (EVA, 0–10) com slider são:

- `src/components/prontuarios/NewEvolutionModal.tsx` — Nova Evolução Clínica
- `src/components/prontuarios/EditEvolutionModal.tsx` — Editar Evolução

Não existe um modal separado de "Nova Avaliação" com EVA — as avaliações usam o mesmo fluxo de evolução com templates dinâmicos (`SpecialtyService` / `DynamicFormRenderer`). Os templates de especialidade têm campos próprios definidos por schema JSON (sem default fixo de 5 no código).

Os campos `nivel_dor` do diário do utente (portal) são separados (`DiaryNewEntryForm` já usa `null`, e `DiaryEntryForm` é o diário do paciente, fora do âmbito desta correção clínica/EVA do profissional).

## Alterações

### 1. `src/components/prontuarios/NewEvolutionModal.tsx`

- Linha 70: `useState(5)` → `useState(0)`
- Linha 175 (dentro de `resetForm`): `setEscalaDor(5)` → `setEscalaDor(0)`

### 2. `src/components/prontuarios/EditEvolutionModal.tsx`

- Linha 81: `useState(5)` → `useState(0)` (apenas fallback inicial antes de carregar o registo)
- Linha 110: **manter** `setEscalaDor(evolution.escala_dor ?? 5)` mas alterar fallback para `?? 0` — para que registos antigos sem valor não apareçam falsamente como 5
- Linha 177 (dentro de `resetForm`): `setEscalaDor(5)` → `setEscalaDor(0)`

## Garantias

- Range continua 0–10 (slider `max={10}`, `step={1}`)
- Lógica de validação inalterada (`EvolutionService.validate` continua a aceitar 0–10)
- Registos guardados não são modificados — apenas os defaults de UI mudam
- Em "Editar Evolução", o valor real guardado continua a ser carregado da BD; apenas o fallback (caso `escala_dor` seja `null`) muda de 5 para 0
- Texto descritivo (`"Sem dor"` à esquerda) já existe nos dois modais e refletirá o valor 0/10 automaticamente
