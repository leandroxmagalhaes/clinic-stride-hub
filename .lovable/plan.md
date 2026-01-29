
## Diagnóstico (crítico e direto)

Pelo que aparece no teu print (“Agendar (Pendente)” + toast “Erro ao agendar sessão”), o comportamento atual tem **dois problemas graves**:

1) **A sessão está a ser criada na base de dados (POST 201 Created), mas o app dá erro depois**
- No `Agenda.tsx`, após `await addSession(newSession)`, o código ainda usa `newSession.id` (que é um ID “fake” gerado no frontend: `sess-${Date.now()}`).
- O `addSession()` grava no backend e cria um **ID real (UUID)**, mas **não devolve esse ID ao `Agenda.tsx`**.
- Em seguida, o código faz:
  - `useCredit(data.pacienteId, newSession.id)`
  - `updateSession(newSession.id, ...)`
- Como `newSession.id` **não existe na tabela**, o `updateSession()` tenta atualizar um ID inexistente e falha → daí o “Erro ao agendar sessão”.
- Resultado: o utilizador tenta novamente e pode acabar com **agendamentos duplicados** (porque o POST já tinha criado uma sessão antes do erro).

2) **O fluxo de créditos na criação do agendamento está conceptualmente errado**
- O modal diz: “Créditos insuficientes → sessão será agendada com pagamento pendente”.
- Mas o `Agenda.tsx` sempre tenta `useCredit()` na criação — mesmo quando o saldo é 0.
- Além disso, o `useCredit()` do `DataContext` hoje é **só local (não grava no backend)** e usa o ID “fake”, o que cria inconsistências e sensação de “crédito sumindo”.
- A regra correta (e mais segura) é:
  - **Criar agendamento não deve consumir crédito.**
  - **Consumo de crédito deve acontecer na finalização (“Realizado”)**, e isso deve ser persistido no backend, com idempotência.

---

## Objetivo do conserto

1. **Agendamento funcionar sempre** (mesmo com 0 créditos → criar com `payment_status = "pendente"`).
2. **Parar de gastar/alterar “créditos” no ato de agendar**.
3. **Garantir que o desconto/estorno de créditos seja persistente e idempotente** no backend (sem duplicar desconto em re-tentativas).
4. **Mensagens de erro mais específicas** (para não ficar “Erro ao agendar sessão” sem explicar).

---

## Mudanças propostas (arquitetura)

### A) Corrigir o fluxo do agendamento (Agenda/Dashboard)
- **Remover** do ato de agendar:
  - `useCredit(...)`
  - `updateSession(newSession.id, { payment_status: ... })` logo após criar
- Em vez disso:
  1. Antes de chamar `addSession`, determinar o `payment_status`:
     - Se o serviço **consome crédito** e o saldo do paciente **é 0** ⇒ `payment_status = "pendente"`
     - Caso contrário ⇒ `payment_status = "pago"` (ou manter “pendente” se preferirem cobrar depois; mas o essencial é não falhar)
  2. Criar a sessão já com o `payment_status` correto no **INSERT**.
  3. Exibir toast de sucesso imediatamente após `addSession` retornar.

Isso resolve o teu erro atual porque **não haverá mais tentativa de `updateSession` com ID falso**.

### B) Ajustar o contrato do `addSession`
Opção recomendada (mais robusta):
- Alterar `addSession(session)` para **retornar o `Session` criado (com UUID real)**:
  - `addSession: (session: Session) => Promise<Session>`
- Assim, se no futuro for necessário atualizar algo após inserir, será feito com o **ID real**.

(Alternativa aceitável: manter `Promise<void>` e parar de fazer qualquer operação posterior usando `newSession.id`. Mas retornar o objeto real ajuda muito a evitar regressões.)

### C) Consertar créditos para serem 100% persistentes e consistentes
Hoje o `DataContext` mistura:
- saldo vindo de `saldo_creditos` (backend)
- `useCredit/refundCredit` apenas em estado local

Vamos corrigir para **usar o ledger real `transacoes_credito`**:

1. **`useCredit(patientId, sessionId)` vira async e grava no backend**
   - Inserir em `transacoes_credito`:
     - `tipo: 'uso'`
     - `quantidade: -1`
     - `session_id: sessionId`
     - `clinic_id` do utilizador atual
   - Depois: `await fetchCreditBalances()` para atualizar saldo real.

2. **`refundCredit(patientId, sessionId)` vira async e grava no backend**
   - Inserir em `transacoes_credito`:
     - `tipo: 'estorno'` (ou o tipo que o schema já usa para estorno; se já padronizaram como `'refund'`/`'ajuste'`, seguimos o padrão existente no projeto)
     - `quantidade: +1`
     - `session_id: sessionId`
   - Depois: refresh de saldos

3. **`wasCreditUsedForSession(sessionId)` deve refletir backend**
   - Implementar `fetchCreditUsageMap()` no `DataContext`:
     - Buscar `session_id` de `transacoes_credito` onde `tipo = 'uso'` e `session_id is not null`
     - Popular `creditUsageMap[session_id] = true`
   - Rodar isso:
     - no mount
     - no SIGNED_IN
     - após `useCredit/refundCredit`

### D) Garantir idempotência no backend (sem gastar crédito 2x)
Existe função `check_credit_usage_idempotency_v2()`, mas o sistema indica que **não há triggers ativos**.
Vamos criar uma migration para adicionar trigger em `transacoes_credito`:

- Trigger BEFORE INSERT em `transacoes_credito` chamando `check_credit_usage_idempotency_v2()`
- Isso impede:
  - dois “uso” para a mesma `session_id`

Sem isso, um clique repetido em “Finalizar” pode gerar dupla cobrança.

### E) Atualizar o SessionManagementModal para async (finalizar/cancelar/falta)
Porque `useCredit/refundCredit` vão virar `async`, atualizaremos:
- `SessionManagementModal`:
  - `handleComplete` passa a `async` e faz `await onUseCredit(...)`
  - `handleCancel` e `handleNoShow` idem para estornos (quando aplicável)
- Ajustar tipos das props:
  - `onUseCredit: (patientId, sessionId) => Promise<{success; error?}>`
  - `onRefundCredit: (patientId, sessionId) => Promise<{success; error?}>`

---

## Arquivos que serão alterados

1) `src/pages/Agenda.tsx`
- Remover `useCredit()` e `updateSession(newSession.id, ...)` no fluxo de criação
- Definir `payment_status` antes de inserir e deixar `addSession()` inserir com esse status
- Melhorar tratamento de erro exibindo `error.message` do backend quando disponível

2) `src/pages/Dashboard.tsx`
- Mesmo ajuste: parar de tentar consumir crédito ao agendar
- Adequar ao novo retorno de `addSession` (se adotarmos `Promise<Session>`)

3) `src/contexts/DataContext.tsx`
- `addSession` passa a retornar `Session` (recomendado)
- Implementar `useCredit` e `refundCredit` persistentes via `transacoes_credito`
- Implementar `fetchCreditUsageMap` (e chamar nos lugares corretos)
- Atualizar tipos no `DataContextType`

4) `src/components/agenda/SessionManagementModal.tsx`
- Ajustar para lidar com `onUseCredit`/`onRefundCredit` async
- Evitar “finalizar” consumindo crédito localmente sem persistir

5) `supabase/migrations/...sql` (nova migration)
- Criar trigger de idempotência em `transacoes_credito` usando `check_credit_usage_idempotency_v2()`

---

## Como vamos validar que resolveu (passos de teste)

1. Com um paciente com **0 créditos**:
   - Tentar agendar → deve **criar** sessão com `payment_status = "pendente"` e **não dar erro**.
2. Conferir que **não surgem duplicados** ao clicar uma vez.
3. Abrir uma sessão agendada e clicar **Finalizar**:
   - Se houver crédito: deve debitar 1 no backend (saldo diminui após refresh)
   - Se não houver crédito: deve bloquear (como já faz) e não debitar nada
4. Clicar “Finalizar” duas vezes (ou recarregar e tentar novamente):
   - Não pode debitar duas vezes (trigger garante)
5. Logout/login:
   - Sessões continuam a aparecer (persistência)
   - Saldos continuam corretos (persistência)

---

## Observação importante sobre o “crédito sumindo”
O erro atual faz o app parecer “inconsistente” porque:
- a sessão pode estar a ser criada,
- mas a UI mostra erro e o utilizador tenta de novo,
- criando duplicados e confundindo o fluxo.

Ao remover a tentativa de `updateSession` com ID fake e mover o débito de crédito só para a finalização (e persistindo corretamente), esse cenário para de acontecer.

---

## Pergunta mínima (para não assumir regra errada)
Hoje, quando o paciente tem crédito, você quer:
1) marcar a sessão como “pago” já no agendamento, ou
2) manter como “pendente” até finalizar?

Eu consigo implementar qualquer uma, mas (2) costuma ser mais fiel: crédito só “vira receita” quando executado.  
Se você não responder, vou seguir a regra mais segura: **agendar não consome crédito** e **pago/pendente depende do saldo e do serviço**, mas o débito só acontece na finalização.
