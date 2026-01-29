

# Correção: Agendamentos Não Persistem na Base de Dados

## Problema Identificado

Os agendamentos (sessões) estão a desaparecer após logout porque **nunca são guardados na base de dados**. O código atual apenas atualiza o estado local do React:

```typescript
// Linha 524-526 do DataContext.tsx
const addSession = (session: Session) => {
  setSessions((prev) => [session, ...prev]); // ❌ Apenas estado local!
};
```

Quando o utilizador faz logout, o estado é limpo e, como os dados nunca foram para o Supabase, perdem-se.

## Solução

Modificar o `DataContext` para que as operações de sessão façam INSERT/UPDATE na base de dados Supabase, além de atualizar o estado local.

---

## Alterações Necessárias

### Ficheiro: `src/contexts/DataContext.tsx`

#### 1. Modificar `addSession` para inserir na base de dados

```typescript
const addSession = async (session: Session): Promise<void> => {
  // Obter clinic_id do utilizador
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("User not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile?.clinic_id) throw new Error("User has no clinic");

  // Inserir na base de dados
  const { data, error } = await supabase.from("sessoes").insert({
    clinic_id: profile.clinic_id,
    paciente_id: session.paciente_id,
    profissional_id: session.profissional_id,
    servico_id: session.servico_id,
    start_time: session.start_time.toISOString(),
    end_time: session.end_time.toISOString(),
    status: session.status,
    notes: session.notes,
    price: session.price,
    payment_status: session.payment_status,
  }).select(`
    *,
    paciente:pacientes(id, full_name),
    profissional:profiles!sessoes_profissional_id_fkey(id, full_name),
    servico:servicos(id, name, color, duration_minutes, consumes_credit)
  `).single();

  if (error) throw error;

  // Atualizar estado local com o ID real da base de dados
  const newSession: Session = {
    ...session,
    id: data.id,
    clinic_id: data.clinic_id,
    paciente: data.paciente,
    profissional: data.profissional,
    servico: data.servico,
  };

  setSessions((prev) => [newSession, ...prev]);
};
```

#### 2. Modificar `updateSession` para fazer UPDATE na base de dados

```typescript
const updateSession = async (id: string, data: Partial<Session>): Promise<void> => {
  // Preparar dados para update
  const updateData: Record<string, any> = {};
  
  if (data.start_time) updateData.start_time = data.start_time instanceof Date 
    ? data.start_time.toISOString() : data.start_time;
  if (data.end_time) updateData.end_time = data.end_time instanceof Date 
    ? data.end_time.toISOString() : data.end_time;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.payment_status !== undefined) updateData.payment_status = data.payment_status;
  if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
  if (data.price !== undefined) updateData.price = data.price;

  // Atualizar na base de dados
  const { error } = await supabase
    .from("sessoes")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;

  // Atualizar estado local
  setSessions((prev) =>
    prev.map((s) => (s.id === id ? { ...s, ...data } : s))
  );
};
```

#### 3. Atualizar interface para funções async

Alterar a tipagem em `DataContextType`:

```typescript
addSession: (session: Session) => Promise<void>;
updateSession: (id: string, data: Partial<Session>) => Promise<void>;
```

### Ficheiro: `src/pages/Agenda.tsx`

Adicionar `await` às chamadas de `addSession` e `updateSession`:

```typescript
// Linha 164
await addSession(newSession);

// Linha 171-174
if (!creditResult.success) {
  await updateSession(newSession.id, { payment_status: "pendente" });
} else {
  await updateSession(newSession.id, { payment_status: "pago" });
}
```

---

## Fluxo Corrigido

```text
Utilizador cria agendamento
        │
        ▼
SessionService.create() gera objeto sessão
        │
        ▼
addSession() é chamado
        │
        ├──► INSERT na tabela sessoes (Supabase) ✓
        │           │
        │           ▼
        │    Retorna ID real da base de dados
        │
        ▼
Estado local atualizado com dados persistidos
        │
        ▼
Utilizador faz logout e login
        │
        ▼
fetchSessions() carrega dados da base de dados ✓
        │
        ▼
Agendamentos aparecem corretamente! ✓
```

---

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/contexts/DataContext.tsx` | `addSession` e `updateSession` agora fazem INSERT/UPDATE no Supabase |
| `src/pages/Agenda.tsx` | Adicionar `await` às chamadas assíncronas |

---

## Verificações de Segurança

- A tabela `sessoes` já tem RLS configurado por `clinic_id`
- O INSERT usa o `clinic_id` do perfil do utilizador autenticado
- Os dados são validados pelo `SessionService.create()` antes do INSERT

---

## Resultado Esperado

Após esta correção:
1. Os agendamentos serão guardados na base de dados
2. Os dados persistirão entre sessões de login
3. O fluxo de drag-and-drop para remarcar também será persistido
4. O sistema funcionará corretamente em ambiente de produção

