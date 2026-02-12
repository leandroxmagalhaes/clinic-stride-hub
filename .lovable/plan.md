

# Modalidades de Agendamento no Modal "Novo Agendamento"

## Objetivo

Adicionar ao modal de "Novo Agendamento" existente a possibilidade de escolher entre 4 modalidades de atendimento, com configuracoes especificas de frequencia e dias para as modalidades recorrentes/pacotes.

## Modalidades

1. **Atendimento Avulso** - Comportamento atual (sessao unica)
2. **Servico Recorrente** - Sessoes repetidas com frequencia definida, pagamento antecipado
3. **Pacote Fixo** - Quantidade fixa de sessoes (ex: 4, 8, 12) com dias pre-definidos
4. **Pacote Personalizado** - Quantidade e dias totalmente flexiveis

## Experiencia do Utilizador

Ao abrir o modal "Novo Agendamento", o utilizador vera:

1. Um seletor de **Modalidade** no topo (antes dos campos atuais)
2. Se escolher "Avulso": formulario atual sem alteracoes
3. Se escolher "Recorrente", "Pacote Fixo" ou "Pacote Personalizado":
   - Campo de **Frequencia** (semanal, quinzenal, mensal)
   - Seletor de **Dias da semana** (segunda a sabado, multi-selecao)
   - Opcao entre **Dias fixos** (sempre os mesmos dias) ou **Dias flexiveis** (variar semana a semana)
   - Para pacotes: campo de **Quantidade de sessoes** (4, 8, 12 ou personalizado)
   - **Pre-visualizacao** das datas geradas antes de confirmar
4. Ao submeter, o sistema cria todas as sessoes de uma vez na agenda

## Mudancas na Base de Dados

Nova tabela `scheduling_packages` para rastrear pacotes/recorrencias:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| clinic_id | uuid | FK para clinics |
| paciente_id | uuid | FK para pacientes |
| profissional_id | uuid | FK para profiles |
| servico_id | uuid | FK para servicos |
| modality | text | avulso, recorrente, pacote_fixo, pacote_personalizado |
| frequency | text | semanal, quinzenal, mensal (nullable) |
| fixed_days | jsonb | Array de dias da semana ex: [1,3,5] (nullable) |
| flexible | boolean | Se os dias podem variar |
| total_sessions | integer | Quantidade total de sessoes no pacote |
| sessions_created | integer | Sessoes ja criadas |
| status | text | ativo, pausado, concluido, cancelado |
| start_date | date | Data de inicio |
| end_date | date | Data prevista de fim (nullable) |
| notes | text | Observacoes (nullable) |
| created_at | timestamptz | |

As sessoes criadas por um pacote terao um campo `package_id` na tabela `sessoes` para rastreabilidade.

## Ficheiros a Alterar/Criar

| Ficheiro | Acao | Descricao |
|----------|------|-----------|
| Migracao SQL | Criar | Tabela `scheduling_packages` + coluna `package_id` em `sessoes` |
| `src/components/agenda/NewSessionModal.tsx` | Editar | Adicionar seletor de modalidade e campos condicionais |
| `src/components/agenda/PackageSchedulePreview.tsx` | Criar | Componente de pre-visualizacao das datas geradas |
| `src/services/PackageSchedulingService.ts` | Criar | Logica de geracao de datas baseada em frequencia/dias |
| `src/pages/Agenda.tsx` | Editar | Handler para criar multiplas sessoes de pacote |
| `src/contexts/DataContext.tsx` | Editar | Adicionar funcao para criar sessoes em lote |

## Detalhes Tecnicos

### Geracao de datas (PackageSchedulingService)

```text
Entrada: data_inicio, frequencia, dias_semana[], total_sessoes
Saida: Date[] com todas as datas calculadas

Algoritmo:
1. A partir da data_inicio, iterar semana a semana (ou conforme frequencia)
2. Para cada semana, incluir os dias selecionados
3. Parar quando atingir total_sessoes
4. Verificar conflitos com sessoes existentes e horarios reservados
```

### Fluxo de submissao para pacotes

```text
1. Utilizador preenche modalidade + frequencia + dias + paciente + profissional + servico + hora
2. Sistema gera preview das datas
3. Utilizador confirma
4. Sistema cria 1 registro em scheduling_packages
5. Sistema cria N registros em sessoes (todos com package_id)
6. Todas as sessoes ficam visiveis na agenda
```

### RLS

- `scheduling_packages` tera RLS baseada em `clinic_id` (mesmo padrao das outras tabelas)
- A coluna `package_id` em `sessoes` e nullable (sessoes avulsas continuam sem pacote)

