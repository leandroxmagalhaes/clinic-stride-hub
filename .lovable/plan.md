## Objetivo

Hoje a página **Mensagens** só lista utentes que já têm portal ativado (e a única conversa visível é a do utente que enviou a primeira mensagem). Vou permitir-te iniciar conversa com **qualquer utente da clínica**, mesmo sem portal ativado, e tratar o caso "ainda não tem portal" de forma clara.

## Mudanças

### 1. Botão "Nova conversa" em `src/pages/Mensagens.tsx`
- Acima da lista de conversas, novo botão **+ Nova conversa**.
- Abre um modal com pesquisa em todos os utentes da clínica (tabela `pacientes`, mesma RPC que já se usa noutros sítios — ou query direta filtrada por `clinic_id` e `is_active`).
- Para cada utente, mostro um badge de estado:
  - **"Portal ativo"** (verde) — tem registo em `portal_contas` com `auth_user_id`.
  - **"Sem portal"** (cinza) — não tem conta portal; receberá a mensagem mas só verá após ativar.
- Ao selecionar, o utente é injetado na lista de conversas (mesmo sem mensagens) e abre o painel de chat à direita.

### 2. Painel de chat para utentes sem portal
- Se o utente selecionado **não tem portal ativado**, mostro um aviso amarelo no topo do chat:
  > "Este utente ainda não ativou o portal. As mensagens ficarão guardadas e ele poderá lê-las assim que ativar o acesso."
- Botão de atalho **"Enviar magic link de ativação"** (já existe a edge function `generate-portal-magic-link`).
- O envio da mensagem continua a funcionar (a tabela `portal_mensagens` aceita; o trigger já cria notificação portal).
- O email de notificação (`notify-portal-message`) só é enviado se o utente tiver email — caso contrário regista um aviso silencioso.

### 3. Lista de conversas: incluir conversas iniciadas pelo profissional
- Quando envias mensagem a um utente sem portal, ele aparece na lista de **Conversas** (com a tua última mensagem) na próxima abertura.
- A RPC `list_portal_conversations` será atualizada para incluir utentes que têm mensagens em `portal_mensagens` **OU** conta em `portal_contas` (atualmente exige conta).

### 4. Broadcast — opção de incluir utentes sem portal
- Na aba **Broadcast**, adicionar um filtro/checkbox: **"Incluir utentes sem portal ativado"** (desligado por defeito).
- Quando ligado, a lista de destinatários passa a mostrar todos os utentes ativos da clínica.

## Detalhes técnicos

- **Migração SQL** (apenas para a RPC `list_portal_conversations` — sem alteração de schema):
  ```sql
  -- Substituir o WHERE da RPC para:
  WHERE p.clinic_id = p_clinic_id
    AND (
      EXISTS (SELECT 1 FROM portal_contas pc WHERE pc.paciente_id = p.id)
      OR EXISTS (SELECT 1 FROM portal_mensagens m WHERE m.paciente_id = p.id)
    )
  ```
- **Frontend (`Mensagens.tsx`)**:
  - Novo state `showNewChatModal` + componente inline com `Command`/`Input` para pesquisa.
  - Carregar lista de pacientes via `supabase.from('pacientes').select('id, full_name, email').eq('clinic_id', clinicId).eq('is_active', true)`.
  - Cruzar com `portal_contas` para o badge.
  - Ao selecionar, fazer `setSelected({...})` localmente sem precisar de mensagem prévia.
- **RLS já permite** profissionais inserirem em `portal_mensagens` para qualquer paciente da clínica (policy `is_professional(auth.uid())`).

## Sem alterações em
- Vista do utente (`PortalMensagens.tsx`).
- Edge functions `generate-portal-magic-link` / `notify-portal-message`.
- Schema de tabelas.

Aprovas para implementar?
