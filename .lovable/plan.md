
# Validação de Acesso por Magic Link + Chat Iniciado pelo Profissional

Sim, é totalmente possível. Vamos refazer o fluxo de ativação do portal e remover a limitação de o utente ter de iniciar a conversa.

## Decisões já confirmadas
- Magic link válido **24h**, **uso único**
- **Email obrigatório** para gerar o magic link
- Profissional pode iniciar conversa **1-para-1 e em broadcast**
- Notificação por email **apenas na 1ª mensagem da conversa por dia** (anti-spam)

---

## Parte 1 — Magic Link de Ativação (substitui o convite código + link genérico)

### Fluxo novo
1. Na ficha do utente → aba **Portal**, o profissional clica **"Ativar portal"**.
2. Sistema valida que o utente tem email registado (obrigatório).
3. É gerado um magic link único (`portal_convites.link_token`) com:
   - `expira_em` = agora + 24h
   - `utilizado = false`
   - `max_tentativas = 1` (uso único — após criar password, fica inválido)
4. É enviado **email automático** com botão "Ativar a minha conta" → `/portal/ativar/<token>`.
5. O profissional vê na ficha: estado do link (válido / expirado / usado), botão **"Reenviar"** (gera novo) e **"Copiar link"** / **"WhatsApp"**.

### Página `/portal/ativar/<token>` (substitui a verificação por código de 6 dígitos)
- Mostra o nome do utente e a clínica.
- Pede ao cliente para **definir uma password nova** (mínimo 8 chars, com confirmação).
- Ao submeter:
  - Cria conta `auth.users` com email + password
  - Liga em `portal_contas` + `portal_conta_pacientes`
  - Marca `portal_convites.utilizado = true`
  - Faz login automático e redireciona para o questionário / portal
- Se o link estiver expirado/usado → mensagem clara "Contacte a clínica para novo link".

### Compatibilidade
- A rota antiga `/portal/verificacao/<token>` (código 6 dígitos) continua a funcionar para convites antigos já enviados, mas deixa de ser oferecida no UI.
- `PortalDiagnosticsPanel` continua a mostrar histórico de convites (códigos antigos + novos magic links).

---

## Parte 2 — Chat iniciado pelo profissional

Hoje o `portal_diario` só é alimentado pelo utente, e o profissional só responde via `portal_respostas`. Vamos permitir que o **profissional crie a primeira entrada de conversa**.

### Backend
- Nova tabela `portal_mensagens` (chat dedicado, separado do diário clínico):
  - `id`, `paciente_id`, `autor_tipo` ('professional' | 'patient'), `autor_id`, `autor_nome`, `texto`, `lida_em`, `created_at`
  - RLS: utente vê as suas; profissionais da clínica gerem todas
- Trigger ao inserir mensagem do profissional → cria `portal_notificacoes` para o utente.
- Edge function `notify-portal-message`:
  - Verifica se já foi enviado email para esta conversa **hoje** (consulta `automation_logs` com `flow_type='portal_chat_email'` e `paciente_id` no dia atual).
  - Se não, envia email "Tem uma nova mensagem da clínica" com link para `/portal/mensagens`.
  - Regista em `automation_logs`.

### UI Profissional
Nova página **"Mensagens"** no menu lateral com:
- **Aba "Conversas"**: lista todos os utentes com conta de portal ativa, ordenados por última mensagem; barra de pesquisa; abrir conversa = vista de chat 1-para-1.
- **Aba "Broadcast"**: 
  - Compõe mensagem
  - Filtros: especialidade, faixa etária, tags de saúde, "todos com portal ativo"
  - Pré-visualiza nº de destinatários e confirma envio
  - Cria N mensagens individuais (um envio por utente — para que cada conversa fique isolada)

### UI Utente (Portal)
- Novo separador **"Mensagens"** no portal — mostra a conversa com a clínica.
- Badge com contador de mensagens não lidas no menu do portal.
- Notificação realtime (já temos `portal_notificacoes` com canal Supabase).

---

## Parte 3 — Email de notificação (regra "1ª por dia")

- Edge function partilha a infra de email atual (Lovable Emails).
- Lógica:
  ```
  se NÃO existe automation_logs(paciente_id, flow_type='portal_chat_email', date=hoje):
      enviar email
      registar log
  senão:
      apenas criar portal_notificacoes (in-app)
  ```
- O email tem link directo `/portal/mensagens` e mostra a clínica + nome do profissional (sem revelar o conteúdo, por privacidade).

---

## Detalhes técnicos

### Migrações DB
1. `portal_mensagens` (nova tabela + RLS + índices em `paciente_id`, `created_at`).
2. Trigger `on_portal_mensagem_insert` → insere `portal_notificacoes` se autor for professional.
3. ALTER `portal_convites`: adicionar coluna `tipo` ('codigo_otp' | 'magic_link') default 'codigo_otp' para distinguir os 2 fluxos sem partir convites antigos.
4. Realtime habilitado em `portal_mensagens`.

### Edge Functions
- **`generate-portal-magic-link`** (nova): valida email, cria `portal_convites` tipo magic_link, dispara email com template "Active a sua conta no Portal".
- **`notify-portal-message`** (nova): chamada após insert de mensagem do profissional; aplica regra "1ª por dia".
- Refazer template auth-email para incluir o template "Activação do Portal" (transactional, não auth — vai por `send-transactional-email`).

### Frontend
- Nova rota `/portal/ativar/:token` → componente `PortalAtivacao.tsx` (form de password).
- `PatientPortalTab.tsx`: trocar botão "Gerar convite" por "Ativar portal (magic link)"; manter "Reenviar" e "Copiar".
- Nova página `/mensagens` (profissional) → `MensagensPage.tsx` com sub-abas Conversas / Broadcast.
- Novo separador no portal do utente → `PortalMensagens.tsx`.
- Hook `usePortalMessages(pacienteId)` com subscription realtime.

### Ficheiros a criar/editar (estimativa)
- **Novos**: `PortalAtivacao.tsx`, `MensagensPage.tsx` (+ subcomponentes `ConversaView`, `BroadcastComposer`, `ConversasList`), `PortalMensagens.tsx`, edge functions `generate-portal-magic-link` e `notify-portal-message`, migração SQL.
- **Editados**: `PatientPortalTab.tsx`, `App.tsx` (rotas), `Layout.tsx` (item de menu "Mensagens"), `PatientPortal.tsx` (separador Mensagens).

### Não tocar
- Convites OTP existentes continuam a funcionar (compatibilidade).
- `portal_diario` e `portal_respostas` continuam para o diário clínico (dor, humor, fotos) — separado do chat.
- RLS existente do portal mantém-se intacto.

---

## O que o cliente experimenta
1. Recebe email "Active o seu acesso ao Portal" → clica botão.
2. Define password (única vez) → entra no portal.
3. Preenche questionário.
4. Recebe email "Tem uma nova mensagem" quando o profissional escreve (no máx. 1x/dia por conversa).
5. Pode responder no separador Mensagens.

## O que o profissional experimenta
1. Ficha do utente → aba Portal → **"Ativar portal"** (1 clique se email estiver presente).
2. Vê estado: link enviado / conta criada / questionário preenchido.
3. Menu lateral → **Mensagens** → escolhe utente ou faz broadcast.
4. Diagnostic panel continua disponível para troubleshooting.

Aprovas para implementar?
