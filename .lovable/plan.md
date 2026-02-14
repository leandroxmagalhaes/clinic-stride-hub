

# Agendamento em Lote via Upload de Planilha

## Resumo

Criar uma funcionalidade completa de agendamento em lote na pagina de Agenda, onde o utilizador faz upload de uma planilha (como a exportada do Google Calendar), o sistema analisa os nomes e cruza com os pacientes cadastrados, sugere correspondencias, e apresenta uma tabela de revisao para aprovacao antes de gravar os agendamentos.

## Fluxo do Utilizador

1. Clicar em "Agendamento em Lote" na pagina Agenda
2. Fazer upload da planilha (.xlsx/.csv)
3. Selecionar o profissional e servico padrao (aplicados a todos os agendamentos)
4. O sistema analisa cada linha, cruza o nome com os pacientes cadastrados e apresenta:
   - **Match exato**: paciente encontrado automaticamente (verde)
   - **Match parcial**: sugestoes de pacientes similares para o utilizador escolher (amarelo)
   - **Sem match**: nome nao encontrado, utilizador pode selecionar manualmente ou ignorar (vermelho)
5. Tabela de revisao editavel onde se pode:
   - Aprovar/rejeitar cada linha individualmente
   - Alterar o paciente sugerido
   - Editar data, hora, observacoes
   - Ver status de cada linha (aprovado, conflito, sem paciente)
6. Clicar "Agendar Aprovados" para criar todas as sessoes de uma vez

## Arquivos a Criar

### 1. `src/services/BatchSchedulingService.ts`
Servico responsavel pela logica de:
- Parsing da planilha (colunas: Data, Dia da Semana, Evento/Pessoa, Horario Inicio, Horario Fim, Observacoes)
- Algoritmo de matching de nomes (fuzzy match) que:
  - Compara nome da planilha com `full_name` dos pacientes cadastrados
  - Calcula score de similaridade (Levenshtein simplificado / substring matching)
  - Considera nomes parciais (ex: "Bryan" match com "Bryan Costa Silva")
  - Trata nomes abreviados (ex: "Caetana" match com "Caetana Rodrigues")
  - Identifica ambiguidades quando ha multiplos pacientes com nomes parecidos
- Detecao de conflitos de horario com sessoes existentes
- Parsing de datas no formato DD/MM/YYYY
- Parsing de horarios no formato HH:MM

### 2. `src/components/agenda/BatchScheduleModal.tsx`
Modal principal com 4 etapas:
- **Etapa 1 - Upload**: Area de drag-and-drop + selecao de profissional e servico padrao + botao para descarregar modelo
- **Etapa 2 - Analise**: O sistema processa a planilha e mostra progresso
- **Etapa 3 - Revisao**: Tabela editavel com todas as linhas, status de match, selector de paciente, checkbox de aprovacao
- **Etapa 4 - Resultado**: Resumo com quantos agendamentos foram criados com sucesso

### 3. `src/components/agenda/BatchScheduleReviewTable.tsx`
Componente da tabela de revisao com:
- Coluna checkbox (selecionar/deselecionar)
- Coluna Data (editavel)
- Coluna Horario Inicio/Fim
- Coluna Nome Original (da planilha)
- Coluna Paciente Sugerido (dropdown com sugestoes, pesquisavel)
- Coluna Score de Match (indicador visual)
- Coluna Status (aprovado, conflito, sem paciente)
- Coluna Observacoes
- Botoes "Selecionar Todos" / "Deselecionar Todos"

## Arquivos a Modificar

### 4. `src/pages/Agenda.tsx`
- Adicionar botao "Lote" (ou icone de upload) ao lado dos botoes existentes "Reservar" e "Nova Sessao"
- Adicionar estado para controlar o modal de agendamento em lote
- Adicionar handler para criar as sessoes aprovadas em batch (reutilizando a logica existente de insercao via Supabase)

## Detalhes Tecnicos

### Algoritmo de Matching de Nomes

```text
Para cada nome da planilha:
  1. Normalizar (minusculas, remover acentos, trim)
  2. Buscar match exato no full_name dos pacientes
  3. Se nao encontrou, buscar por contem (substring)
     - "Bryan" encontra "Bryan Costa Silva"
  4. Se nao encontrou, buscar por palavras individuais
     - "Caetana" encontra "Caetana Rodrigues"
  5. Calcular score de similaridade para cada candidato
  6. Se score > 80%: match automatico
  7. Se score 50-80%: sugestao (amarelo)
  8. Se score < 50%: sem match (vermelho)
  9. Se multiplos candidatos com score > 70%: ambiguidade (amarelo)
```

### Formato Esperado da Planilha

Baseado na imagem fornecida pelo utilizador:
| Data | Dia da Semana | Evento/Pessoa | Horario Inicio | Horario Fim | Observacoes |
|------|---------------|---------------|----------------|-------------|-------------|
| 06/02/2026 | Sexta | Maria Francisca Veloso | 13:00 | 14:00 | |

O sistema tambem ira aceitar variacoes de nomes de colunas (case-insensitive).

### Criacao de Sessoes em Batch

- Reutilizar a mesma logica de insercao que ja existe no `handleCreateSession` da Agenda
- Sessoes com data anterior a hoje serao criadas com status "realizado" (retroativas)
- Sessoes com observacao "No-Show" serao criadas com status "falta"
- Verificacao de conflitos de horario antes da insercao
- Insercao via `supabase.from('sessoes').insert([...])` em batch

### Biblioteca de Parsing
- Reutilizar a dependencia `xlsx` ja instalada no projeto

## Resultado Esperado

- O utilizador pode importar dezenas ou centenas de agendamentos de uma vez
- Nomes incompletos ou abreviados sao inteligentemente associados aos pacientes cadastrados
- Casos duvidosos sao apresentados para revisao manual
- Agendamentos retroativos sao suportados
- Conflitos de horario sao detectados antes da gravacao
- Interface consistente com o design existente do sistema (mesmos componentes UI)

