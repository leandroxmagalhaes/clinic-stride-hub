

# Plano: Upload de Ficheiros no Copiloto para Importacao em Lote

## Resumo

Adicionar suporte a upload de ficheiros (Excel, CSV, PDF) diretamente no chat do Copiloto. O utilizador arrasta ou seleciona um ficheiro, a IA extrai os dados (agendamentos, pacientes novos), cruza com a base existente e apresenta uma tabela de revisao inline no chat. Apos confirmacao, os dados sao guardados na `import_queue` e podem ser migrados para sessoes ou pacientes.

---

## 1. Frontend: Botao de Upload no CopilotChat

### Alteracoes em `CopilotChat.tsx`
- Adicionar botao de upload (icone Paperclip) ao lado do campo de texto
- Input de ficheiro oculto aceitando `.xlsx, .xls, .csv, .pdf`
- Limite de 5MB por ficheiro
- Ao selecionar ficheiro:
  - Exibir nome do ficheiro como "attachment pill" acima do input
  - Permitir remover antes de enviar
  - Ao enviar, converter ficheiro para base64 e incluir no payload

### Alteracoes na interface `CopilotChatProps`
- `onSend` passa a aceitar: `(text: string, file?: { name: string; base64: string; mimeType: string })`

---

## 2. Hook: Envio de Ficheiros no useCopilot

### Alteracoes em `useCopilot.ts`
- `sendMessage` aceita segundo parametro opcional `file`
- Se ficheiro presente, incluir no body do fetch:
  ```text
  { messages, context, file_upload: { name, base64, mime_type } }
  ```
- Mensagem do utilizador no chat mostra indicacao do ficheiro anexado

---

## 3. Backend: Novas Tools na Edge Function

### Nova tool `parse_import_file`
- Recebe base64 do ficheiro + tipo MIME
- Para Excel/CSV: usa logica de parsing similar ao `BatchSchedulingService` (extrair colunas: paciente, profissional, servico, data, hora)
- Para PDF: envia texto extraido ao modelo IA para identificar eventos estruturados
- Fuzzy matching contra tabela `pacientes` por nome:
  - Similaridade > 80%: match automatico
  - 50-80%: sugestao com aviso
  - < 50%: nao encontrado
- Salva cada linha na tabela `import_queue` com status `pending`
- Retorna resumo: "X linhas extraidas, Y pacientes identificados, Z necessitam revisao"

### Nova tool `get_import_queue`
- Lista itens pendentes da `import_queue` para o utilizador revisar no chat

### Nova tool `confirm_import_rows`
- Recebe lista de IDs da `import_queue`
- Cria sessoes na tabela `sessoes` para cada item confirmado
- Marca itens como `confirmed`

### Nova tool `register_new_patients`
- Para ficheiros com dados de novos pacientes (nome, telefone, email)
- Propoe criacao de pacientes e aguarda confirmacao
- Insere na tabela `pacientes` apos aprovacao

### Adicionar ao `toolDefinitions` array e ao `executeTool` switch

---

## 4. System Prompt Atualizado

Adicionar ao `SYSTEM_PROMPT` da Edge Function:
- Capacidade de processar ficheiros uploadados
- Instrucoes para usar `parse_import_file` quando `file_upload` estiver presente
- Regra: sempre apresentar resumo dos dados extraidos antes de qualquer acao
- Regra: para novos pacientes, perguntar se deve cadastrar
- Instrucao para responder com tabela formatada (usando markdown simples) mostrando os dados extraidos

---

## 5. Fluxo do Utilizador

```text
1. Utilizador abre o Copiloto
2. Clica no icone de upload ou arrasta ficheiro
3. Escreve mensagem opcional (ex: "importar agendamentos deste ficheiro")
4. Copiloto processa o ficheiro via tool parse_import_file
5. Responde com resumo:
   "Encontrei 45 agendamentos no ficheiro:
   - 38 pacientes identificados automaticamente
   - 5 precisam de verificacao
   - 2 pacientes nao encontrados
   Quer que eu mostre a lista para revisao?"
6. Utilizador confirma
7. Copiloto mostra dados formatados
8. Utilizador confirma importacao
9. Sessoes criadas via confirm_import_rows
```

---

## 6. Sequencia de Implementacao

1. **Edge Function**: Adicionar tools `parse_import_file`, `get_import_queue`, `confirm_import_rows`, `register_new_patients` ao `ai-copilot-agent`
2. **Hook**: Atualizar `useCopilot.sendMessage` para aceitar ficheiro e enviar base64
3. **UI**: Adicionar botao de upload e indicador de ficheiro anexado no `CopilotChat`
4. **System Prompt**: Atualizar instrucoes para lidar com ficheiros

---

## Detalhes Tecnicos

- **Parsing Excel**: usar importacao dinamica de `xlsx` (SheetJS) no Deno via CDN (`https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs`)
- **Parsing PDF**: extrair texto bruto e enviar ao modelo IA para estruturar
- **Fuzzy matching**: normalizacao de nomes (lowercase, remover acentos) + substring matching + token scoring (similar ao `BatchSchedulingService`)
- **Limite**: 5MB por ficheiro, maximo 500 linhas por importacao
- **Seguranca**: validacao de tipo MIME, sanitizacao de dados extraidos, filtragem por `clinic_id`
- **Logging**: todas as importacoes logadas em `ai_usage_logs` com action `file_import`

