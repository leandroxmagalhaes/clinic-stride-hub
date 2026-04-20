

## Editar Data e Horário de Evoluções

### Confirmação de proteção de dados

Inspeccionei a tabela `evolucoes_clinicas`. Campos existentes relevantes:
- `created_at` (timestamptz, default `now()`) — **será este o campo de data/hora da evolução**
- `descricao`, `escala_dor`, `specialty_id`, `structured_data`

**Não existe** `updated_at` na tabela. **Nenhuma alteração de schema será feita.** Apenas frontend + UPDATE selectivo nos campos já existentes (`created_at`, `descricao`, `escala_dor`, `specialty_id`, `structured_data`). Todas as evoluções existentes permanecem intactas.

Como não há `updated_at`, o indicador visual "Editado" do passo 4 do prompt não pode ser implementado sem migração — será omitido (o prompt marca este passo como opcional).

---

### Step 1: `EditEvolutionModal.tsx` — adicionar campos Data e Hora

- Adicionar dois `Input` (`type="date"` e `type="time"`) no topo do formulário, antes do seletor de Especialidade.
- Pré-preencher com `created_at` da evolução (separar em `YYYY-MM-DD` e `HH:mm`).
- Validação: data e hora obrigatórias; data não pode ser futura.
- Estender o tipo `onSubmit` para incluir `created_at: string` (ISO).
- Combinar data + hora em ISO string e enviar no submit.

### Step 2: `Prontuarios.tsx` — `handleEditEvolution` faz UPDATE selectivo

Adicionar `created_at: data.created_at` ao `.update({...})` existente (linhas ~296-300). Continua a actualizar APENAS os 5 campos: `descricao`, `escala_dor`, `specialty_id`, `structured_data`, `created_at`. Nenhum outro campo é tocado.

### Step 3: `NewEvolutionModal.tsx` — adicionar campos Data e Hora

- Adicionar `Input` `type="date"` e `type="time"` com default = data/hora actual.
- Se `prefilledDate` veio da agenda, usar essa data; hora default = agora.
- Permite ao profissional registar sessões retroactivas.
- Estender `onSubmit` com `created_at: string` (ISO) opcional.

### Step 4: `Prontuarios.tsx` — `handleCreateEvolucao` usa data/hora do formulário

Adicionar `created_at: data.created_at` ao `.insert({...})` (linha ~248). Se omitido, mantém o default `now()` da BD.

---

### Ficheiros alterados (apenas frontend)

| Ação | Ficheiro |
|------|----------|
| Modificado | `src/components/prontuarios/EditEvolutionModal.tsx` |
| Modificado | `src/components/prontuarios/NewEvolutionModal.tsx` |
| Modificado | `src/pages/Prontuarios.tsx` (handlers create + edit) |

### O que NÃO muda
- ❌ Nenhuma migração SQL
- ❌ Nenhum DROP, ALTER, TRUNCATE, DELETE
- ❌ Nenhuma alteração de schema
- ❌ Nenhuma alteração no visual dos cards de evolução
- ✅ UPDATE selectivo apenas nos campos editados
- ✅ Todas as evoluções existentes preservadas

