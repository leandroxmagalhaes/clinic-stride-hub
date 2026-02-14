

# Agendamento em Lote - Importacao de Sessoes via Planilha

## Resumo

Adicionar um botao "Lote" na pagina Agenda que abre um modal para importar agendamentos a partir de ficheiros Excel/CSV. O sistema faz matching inteligente dos nomes com pacientes cadastrados e permite revisao antes de gravar.

## Componentes a Criar

### 1. `src/services/BatchSchedulingService.ts` - Logica de negocio

- Parsing do ficheiro Excel/CSV usando a biblioteca `xlsx` (ja instalada)
- Colunas esperadas: paciente, profissional, servico, data, hora, minuto, observacoes
- Algoritmo de fuzzy matching para nomes:
  - Match exato (case-insensitive)
  - Match parcial (nome contem o texto ou vice-versa)
  - Match por primeiro nome + iniciais
  - Scoring baseado em similaridade (Levenshtein simplificado ou token matching)
- Geracao do template de planilha para download
- Validacao de dados (datas, horas, campos obrigatorios)

### 2. `src/components/agenda/BatchSchedulingModal.tsx` - Modal principal

Modal com 3 etapas:

**Etapa 1 - Upload:**
- Zona de drag-and-drop ou botao para selecionar ficheiro (.xlsx, .csv)
- Botao para descarregar modelo de planilha
- Indicador de progresso durante parsing

**Etapa 2 - Revisao:**
- Tabela com todas as linhas importadas
- Indicadores visuais por linha:
  - Verde: match exato encontrado para paciente/profissional/servico
  - Amarelo: sugestao encontrada (match parcial)
  - Vermelho: sem match
- Dropdown pesquisavel (combobox) para corrigir paciente/profissional/servico manualmente
- Checkbox individual para aprovar/rejeitar cada linha
- Checkbox "selecionar todos" no cabecalho
- Indicacao de sessoes retroativas (data passada -> status "realizado")
- Detecao de conflitos de horario

**Etapa 3 - Confirmacao:**
- Resumo: X sessoes aprovadas, Y rejeitadas, Z retroativas
- Botao "Agendar Aprovadas"

### 3. Alteracao em `src/pages/Agenda.tsx` (minima)

- Adicionar import do `BatchSchedulingModal`
- Adicionar estado `isBatchModalOpen`
- Adicionar botao "Lote" ao lado dos botoes existentes (area de actions)
- Renderizar o `BatchSchedulingModal`
- Handler para gravar as sessoes aprovadas (inserir no banco via supabase diretamente, depois chamar `refreshSessions`)

## Formato da Planilha Modelo

| paciente | profissional | servico | data | hora | minuto | observacoes |
|----------|-------------|---------|------|------|--------|-------------|
| Joao Silva | Dr. Maria Santos | Fisioterapia | 15/02/2026 | 10 | 0 | Primeira sessao |

## Algoritmo de Matching

```text
Para cada nome na planilha:
  1. Normalizar (lowercase, remover acentos)
  2. Tentar match exato -> confianca "exato"
  3. Tentar "contem" (nome do paciente contem o texto) -> confianca "sugestao"
  4. Dividir em tokens e verificar quantos tokens coincidem -> confianca "sugestao"
  5. Nenhum match -> confianca "sem_match"
```

## Fluxo de Gravacao

- Para cada linha aprovada, criar um registo na tabela `sessoes` via supabase
- Sessoes com data passada recebem status "realizado"
- Sessoes com data futura recebem status "agendado"
- Apos insercao, chamar `refreshSessions()` do DataContext para atualizar a UI
- Exibir toast com resumo (X agendadas, Y falharam)

## Detalhes Tecnicos

### Ficheiros a criar:
1. `src/services/BatchSchedulingService.ts` - parsing, matching, template, validacao
2. `src/components/agenda/BatchSchedulingModal.tsx` - modal completo com 3 etapas

### Ficheiro a editar (minimo):
1. `src/pages/Agenda.tsx` - adicionar botao "Lote" e renderizar modal

### Ficheiro que NAO sera tocado:
- `src/contexts/DataContext.tsx`

### Dependencias utilizadas (ja instaladas):
- `xlsx` - parsing de ficheiros Excel/CSV
- `lucide-react` - icones
- Componentes UI existentes (Dialog, Button, Table, Checkbox, Command/Combobox, Badge)

