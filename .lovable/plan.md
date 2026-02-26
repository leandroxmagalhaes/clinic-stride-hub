

# Plano: Agente Copiloto Central

## Resumo

Chat inteligente flutuante acessivel de qualquer pagina via icone no canto inferior direito ou atalho Ctrl+K / Cmd+K. Usa streaming SSE com function calling para agir sobre dados reais do sistema. Nunca executa acoes destrutivas sem confirmacao.

---

## 1. Base de Dados

### Nova tabela `import_queue`
Armazena linhas de importacao de agendamentos historicos para revisao.

```text
id: uuid (PK, default gen_random_uuid())
clinic_id: uuid (NOT NULL)
raw_data: jsonb (NOT NULL) -- dados extraidos do arquivo
suggested_patient_id: uuid (nullable)
suggested_service_id: uuid (nullable)
match_confidence: numeric (nullable) -- 0.0 a 1.0
import_date: timestamptz (nullable)
status: text (default 'pending') -- pending/confirmed/rejected
created_at: timestamptz (default now())
created_by: uuid (nullable)
```

RLS: filtrado por `clinic_id = get_user_clinic_id(auth.uid())` para SELECT, INSERT, UPDATE, DELETE.

---

## 2. Backend: Edge Function `ai-copilot-agent`

### Arquitetura
- Recebe: `messages[]` (historico da conversa), `context` (pagina atual, clinic_id, user_id, datetime), `file_upload` (base64 opcional)
- Usa **streaming SSE** com `google/gemini-3-flash-preview`
- Implementa **function calling** (tools) para acoes reais no sistema
- Retorna stream de tokens + tool calls

### Tools definidas (function calling)

| Tool | Descricao | Tipo |
|------|-----------|------|
| `search_patients` | Busca aproximada por nome na tabela `pacientes` | Leitura |
| `check_availability` | Consulta disponibilidade em `sessoes` + `horarios_reservados` para um profissional, dia e horario minimo | Leitura |
| `propose_session` | Prepara dados de sessao para confirmacao (NAO cria) | Leitura |
| `create_session` | Cria sessao apos confirmacao explicita do usuario | Escrita |
| `cancel_session` | Cancela sessao existente (muda status para 'cancelado') | Escrita |
| `get_pending_evolutions` | Lista sessoes sem evolucao registada | Leitura |
| `get_pending_payments` | Lista sessoes com pagamento pendente | Leitura |
| `get_expiring_packs` | Lista pacotes vencendo nos proximos N dias | Leitura |
| `get_daily_summary` | Consolida sessoes de hoje, pendencias e alertas | Leitura |
| `get_inactive_patients` | Pacientes sem sessao ha mais de N dias | Leitura |
| `parse_import_file` | Extrai eventos de arquivo (Excel/PDF) e cruza com pacientes | Escrita (import_queue) |
| `confirm_import` | Confirma linhas selecionadas da import_queue, cria sessoes | Escrita |

Cada tool consulta dados usando `SUPABASE_SERVICE_ROLE_KEY` mas sempre filtrado por `clinic_id` do usuario autenticado. Todas as acoes de escrita sao logadas em `ai_usage_logs` com feature `copilot`.

### Fluxo de confirmacao
Para acoes de escrita, o agente NUNCA executa diretamente. Primeiro usa a tool de "proposta" que retorna os dados formatados. O usuario confirma no chat. So entao a tool de execucao e chamada.

### Tratamento de erros
- 429: Rate limit com mensagem amigavel
- 402: Creditos esgotados
- Erros de tool: mensagem descritiva sem expor detalhes internos

---

## 3. Frontend

### Componente `CopilotChat`
Painel lateral (Sheet) que abre pelo lado direito:
- Header com titulo "Copiloto" e botao fechar
- Area de mensagens com scroll, suporte a markdown (`react-markdown` nao necessario -- formatacao simples com whitespace e negrito)
- Campo de input + botao enviar + botao upload de arquivo
- Indicador de "digitando" durante streaming
- Cards de confirmacao inline para acoes propostas (botoes "Confirmar" / "Cancelar")
- Tabela de revisao de importacao quando aplicavel

### Componente `CopilotFAB`
Botao flutuante fixo (bottom-right, z-50):
- Icone de chat (MessageCircle ou Bot)
- Badge com indicador quando ha sugestoes pendentes
- Ao clicar, abre o `CopilotChat`
- Renderizado dentro do `PersistentLayout` para estar disponivel em todas as paginas

### Hook `useCopilot`
Gerencia:
- `messages[]`: historico da conversa (sessao atual, nao persistido)
- `isOpen`: estado do painel
- `isStreaming`: indicador de resposta em andamento
- `pendingAction`: acao aguardando confirmacao do usuario
- `importQueue`: linhas de importacao para revisao
- `currentPage`: rota atual (via `useLocation`)
- `sendMessage(text, file?)`: envia mensagem e processa stream SSE
- `confirmAction(actionId)`: confirma acao pendente
- `rejectAction(actionId)`: rejeita acao pendente
- `togglePanel()`: abre/fecha
- Atalho de teclado `Ctrl+K` / `Cmd+K` via `useEffect`

### Contexto inteligente
O hook detecta a rota atual e extrai contexto:
- `/pacientes` + paciente selecionado -> inclui `patient_id` e `patient_name`
- `/agenda` -> inclui data selecionada
- `/prontuarios` + prontuario aberto -> inclui `prontuario_id` e `patient_id`
- `/financeiro` -> indica contexto financeiro

Este contexto e enviado como campo `context` na mensagem para a Edge Function.

---

## 4. Capacidade de Importacao de Arquivos

### Upload no chat
- O componente aceita upload de `.xlsx`, `.xls`, `.csv` e `.pdf`
- Arquivo convertido para base64 no cliente
- Enviado junto com a mensagem para a Edge Function

### Processamento no backend (tool `parse_import_file`)
- Para Excel/CSV: parseia linhas extraindo data, hora, titulo/nome, descricao
- Para PDF: extrai texto e usa IA para identificar eventos
- Fuzzy matching contra tabela `pacientes`:
  - Similaridade > 80%: sugestao automatica
  - 50-80%: sugestao com aviso "verificar"
  - < 50%: "paciente nao encontrado"
- Salva cada linha na `import_queue` com status `pending`

### Revisao no frontend
- Apos processamento, o chat exibe tabela de revisao
- Cada linha: Data/Hora | Nome no arquivo | Paciente sugerido (editavel) | Servico | Checkbox
- Botao "Confirmar selecionados": chama tool `confirm_import`
- Linhas confirmadas criam sessoes com `notes` incluindo `historico_importado: true`

---

## 5. Integracao no Layout

### `PersistentLayout.tsx`
Adicionar `CopilotFAB` como ultimo filho dentro do `SidebarInset`, apos o footer. O painel `CopilotChat` e renderizado via Sheet (portal) entao nao afeta o layout.

### `config.toml`
Registar `ai-copilot-agent` com `verify_jwt = false` (validacao no codigo).

---

## 6. Sequencia de Implementacao

1. **Migracao**: criar tabela `import_queue` com RLS
2. **Edge Function**: criar `ai-copilot-agent` com streaming SSE + function calling (todas as tools)
3. **Hook `useCopilot`**: logica de streaming, historico, confirmacao, atalho de teclado
4. **Componentes**: `CopilotFAB` + `CopilotChat` com UI de mensagens, confirmacao e importacao
5. **Integracao**: adicionar FAB no `PersistentLayout`, registar em `config.toml`
6. **AIService**: adicionar metodo `streamCopilot()` para chamada SSE

---

## Detalhes Tecnicos

- **Modelo**: `google/gemini-3-flash-preview` com streaming
- **Streaming**: SSE token-by-token via `fetch` + `ReadableStream` (sem `supabase.functions.invoke`)
- **Function calling**: tools definidas no payload da API, o modelo decide quando chamar
- **Execucao de tools**: a Edge Function executa as tools server-side e retorna resultados ao modelo
- **Seguranca**: autenticacao JWT + filtragem por `clinic_id` em todas as queries
- **Logging**: todas as interacoes logadas em `ai_usage_logs` com feature `copilot`
- **Sem persistencia de chat**: historico vive apenas na sessao do browser (state React)
- **Upload**: limite de 5MB por arquivo, formatos xlsx/csv/pdf

