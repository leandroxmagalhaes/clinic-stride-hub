
# Plano: Correção Completa do Agendamento e Sistema de Créditos

## Resumo do Problema

O erro ao agendar sessões ocorre porque:
1. O `addSession()` cria a sessão no banco e retorna o **UUID real**
2. Mas o código depois usa o **ID falso** (`sess-${Date.now()}`) para chamar `updateSession()` e `useCredit()`
3. Resultado: UPDATE falha (ID não existe) → toast "Erro ao agendar sessão"
4. Sessão foi criada mas UI mostra erro → utilizador tenta novamente → duplicados

Além disso, o sistema de créditos está inconsistente:
- `useCredit()` e `refundCredit()` só atualizam estado local (não persistem no banco)
- Logout → créditos "voltam" porque não foram gravados

---

## Solução Proposta

### Regra de Negócio Confirmada
- **Agendar** → Não consome crédito (apenas cria sessão)
- **Finalizar** → Consome crédito (com persistência e idempotência)
- **Cancelar** → Estorna crédito se já foi consumido

---

## Alterações por Arquivo

### 1. `src/pages/Agenda.tsx`

**Remover do fluxo de criação:**
- `useCredit(data.pacienteId, newSession.id)` (linha 174)
- `updateSession(newSession.id, { payment_status: ... })` (linhas 177-181)

**Determinar `payment_status` ANTES do INSERT:**
```typescript
// Determinar status de pagamento baseado no saldo
const balance = getCreditBalance(data.pacienteId);
const serviceConsumesCredit = selectedService?.consumes_credit ?? true;
const paymentStatus = (serviceConsumesCredit && balance <= 0) ? "pendente" : "reservado";

// Criar sessão com status correto
const newSession = SessionService.create({
  ...
  payment_status: paymentStatus, // Já definido antes do INSERT
});

await addSession(newSession);
setIsModalOpen(false);
resetForm();

// Toast de sucesso
toast.success(paymentStatus === "pendente" 
  ? "Sessão agendada com pagamento pendente" 
  : "Sessão agendada!");
```

---

### 2. `src/pages/Dashboard.tsx`

**Mesmo ajuste:**
- Remover `useCredit()` na criação
- Determinar `payment_status` antes do INSERT
- Usar `await addSession()` (já é async)

---

### 3. `src/contexts/DataContext.tsx`

**A) Adicionar função `fetchCreditUsageMap()`** para buscar sessões que já tiveram crédito consumido:
```typescript
const fetchCreditUsageMap = async () => {
  const { data, error } = await supabase
    .from("transacoes_credito")
    .select("session_id")
    .eq("tipo", "uso")
    .not("session_id", "is", null);

  if (!error && data) {
    const map: Record<string, boolean> = {};
    data.forEach((row) => {
      if (row.session_id) map[row.session_id] = true;
    });
    setCreditUsageMap(map);
  }
};
```

Chamar no mount e no SIGNED_IN.

**B) Alterar `useCredit()` para ser async e persistir:**
```typescript
const useCredit = async (
  patientId: string, 
  sessionId: string
): Promise<{ success: boolean; error?: string; alreadyDeducted?: boolean }> => {
  // Verificar idempotência no backend primeiro
  const { data: existing } = await supabase
    .from("transacoes_credito")
    .select("id")
    .eq("session_id", sessionId)
    .eq("tipo", "uso")
    .maybeSingle();

  if (existing) {
    return { success: true, alreadyDeducted: true };
  }

  // Verificar saldo
  const balance = creditBalances[patientId] ?? 0;
  if (balance <= 0) {
    return { success: false, error: "Saldo de créditos insuficiente" };
  }

  // Obter clinic_id
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("user_id", userData?.user?.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return { success: false, error: "Clínica não encontrada" };
  }

  // Inserir transação de uso
  const { error } = await supabase.from("transacoes_credito").insert({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    tipo: "uso",
    quantidade: -1,
    session_id: sessionId,
    motivo: "Uso de crédito para sessão",
  });

  if (error) {
    // Idempotency check via constraint
    if (error.message.includes("idempotência") || error.code === "23505") {
      return { success: true, alreadyDeducted: true };
    }
    return { success: false, error: "Erro ao descontar crédito" };
  }

  // Atualizar estado local e map
  setCreditUsageMap((prev) => ({ ...prev, [sessionId]: true }));
  await fetchCreditBalances();

  return { success: true };
};
```

**C) Alterar `refundCredit()` para ser async e persistir:**
```typescript
const refundCredit = async (
  patientId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> => {
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("user_id", userData?.user?.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return { success: false, error: "Clínica não encontrada" };
  }

  const { error } = await supabase.from("transacoes_credito").insert({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    tipo: "estorno",
    quantidade: 1,
    session_id: sessionId,
    motivo: "Estorno de crédito por cancelamento",
  });

  if (error) {
    return { success: false, error: "Erro ao estornar crédito" };
  }

  // Remover do mapa e atualizar saldos
  setCreditUsageMap((prev) => {
    const updated = { ...prev };
    delete updated[sessionId];
    return updated;
  });
  await fetchCreditBalances();

  return { success: true };
};
```

**D) Atualizar interface `DataContextType`:**
```typescript
useCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string; alreadyDeducted?: boolean }>;
refundCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
```

---

### 4. `src/components/agenda/SessionManagementModal.tsx`

**Atualizar props para async:**
```typescript
onUseCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
onRefundCredit: (patientId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
```

**Handlers async:**
```typescript
const handleComplete = async () => {
  if (!canFinalize) {
    toast.error("Utente sem créditos disponíveis");
    return;
  }

  setIsLoading(true);
  try {
    if (!creditWasUsed) {
      const result = await onUseCredit(session.paciente_id, session.id);
      if (!result.success) {
        toast.error(result.error || "Erro ao descontar crédito");
        return;
      }
    }
    
    await onUpdateSession(session.id, { status: "realizado", payment_status: "pago" });
    toast.success("Sessão finalizada!");
    setShowEvolutionPrompt(true);
  } finally {
    setIsLoading(false);
  }
};

const handleCancel = async () => {
  if (!cancelReason) {
    toast.error("Selecione um motivo");
    return;
  }

  setIsLoading(true);
  try {
    if (creditWasUsed) {
      const result = await onRefundCredit(session.paciente_id, session.id);
      if (result.success) {
        toast.info("Crédito estornado");
      }
    }

    await onUpdateSession(session.id, {
      status: "cancelado",
      notes: `${session.notes || ""}\n[CANCELADO] ${cancelReason}`.trim(),
    });
    toast.success("Sessão cancelada");
    setShowCancelDialog(false);
    onClose();
  } finally {
    setIsLoading(false);
  }
};
```

---

### 5. Migration: Trigger de Idempotência

Adicionar trigger para impedir duplo débito na mesma sessão:

```sql
-- Criar trigger de idempotência em transacoes_credito
CREATE TRIGGER trigger_check_credit_usage_idempotency
  BEFORE INSERT ON public.transacoes_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.check_credit_usage_idempotency_v2();
```

A função `check_credit_usage_idempotency_v2()` já existe no banco e impede dois registos de `tipo='uso'` para o mesmo `session_id`.

---

## Fluxo Corrigido

```text
AGENDAR SESSÃO
    │
    ├─ Verificar saldo → determinar payment_status
    │   (pendente ou reservado)
    │
    ├─ INSERT em sessoes com status correto
    │
    └─ Toast: "Sessão agendada!" ✓


FINALIZAR SESSÃO
    │
    ├─ Verificar se crédito já foi usado (idempotência)
    │
    ├─ INSERT em transacoes_credito (tipo=uso, quantidade=-1)
    │   └─ Trigger impede duplicado
    │
    ├─ UPDATE sessao.status = "realizado"
    │
    └─ Toast: "Sessão finalizada!" ✓


CANCELAR SESSÃO
    │
    ├─ Se crédito usado: INSERT transacoes_credito (tipo=estorno, +1)
    │
    ├─ UPDATE sessao.status = "cancelado"
    │
    └─ Toast: "Sessão cancelada!" ✓
```

---

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Agenda.tsx` | Remover useCredit/updateSession no agendamento; definir payment_status antes do INSERT |
| `src/pages/Dashboard.tsx` | Mesmo ajuste |
| `src/contexts/DataContext.tsx` | useCredit/refundCredit async + persistentes; fetchCreditUsageMap |
| `src/components/agenda/SessionManagementModal.tsx` | Handlers async para Finalizar/Cancelar |
| Migration SQL | Trigger de idempotência em transacoes_credito |

---

## Validação Após Implementação

1. **Agendar com 0 créditos** → Deve criar sessão (payment_status=pendente), sem erro
2. **Agendar com créditos** → Deve criar sessão (payment_status=reservado), sem erro
3. **Finalizar sessão** → Deve descontar 1 crédito no banco
4. **Finalizar 2x** → Segundo clique não desconta novamente (idempotência)
5. **Cancelar sessão finalizada** → Deve estornar crédito
6. **Logout/login** → Sessões e saldos persistem corretamente
