
# Corrigir Deadlock no onAuthStateChange do DataContext

## Problema

No ficheiro `src/contexts/DataContext.tsx` (linha 545), o callback do `onAuthStateChange` esta definido como `async` e usa `await supabase.auth.getUser()` internamente. Segundo a documentacao do Supabase, isto causa deadlock porque o callback executa dentro do lock interno de autenticacao, e `getUser()` tenta adquirir o mesmo lock.

Este e o principal causador dos travamentos e lentidao do sistema.

O `AuthContext.tsx` esta correto -- nao usa async/await no callback.

## Correcao

Alterar o callback em `src/contexts/DataContext.tsx` (linhas 545-582) para:

1. Remover `async` da assinatura do callback
2. Remover `await supabase.auth.getUser()` de dentro do callback
3. Usar o `session` que o proprio `onAuthStateChange` ja fornece como segundo parametro (contem `session.user`)
4. Mover operacoes assincronas para `setTimeout` para executarem fora do lock

### Codigo atual (problematico):
```text
supabase.auth.onAuthStateChange(async (event) => {
  if (event === 'SIGNED_OUT') { ... }
  else if (event === 'SIGNED_IN') {
    const { data: { user } } = await supabase.auth.getUser();  // DEADLOCK
    if (user?.id === cachedUserId.current && hasInitiallyLoaded.current) { ... }
    ...
  }
});
```

### Codigo corrigido:
```text
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    cachedUserId.current = null;
    hasInitiallyLoaded.current = false;
    // Limpar estado sincronamente
    setPatients([]);
    setServices([]);
    setSessions([]);
    setProfessionals([]);
    setEvolutions([]);
    setCreditBalances({});
    setCreditUsageMap({});
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    const userId = session?.user?.id ?? null;
    // Defer fetches para fora do lock
    setTimeout(() => {
      if (userId === cachedUserId.current && hasInitiallyLoaded.current) {
        // Silent refresh (sem spinners)
        fetchPatients(true);
        fetchServices(true);
        fetchSessions(true);
        fetchProfessionals(true);
        fetchEvolutions(true);
        fetchCreditBalances();
        fetchCreditUsageMap();
      } else {
        cachedUserId.current = userId;
        hasInitiallyLoaded.current = true;
        fetchPatients();
        fetchServices();
        fetchSessions();
        fetchProfessionals();
        fetchEvolutions();
        fetchCreditBalances();
        fetchCreditUsageMap();
      }
    }, 0);
  }
});
```

### Alteracoes no initLoad (linhas 525-541)

Tambem remover o `await supabase.auth.getUser()` redundante no `initLoad`. O `user` ja esta disponivel via `supabase.auth.getSession()`:

```text
Antes:
  const { data: { user } } = await supabase.auth.getUser();

Depois:
  const { data: { session } } = await supabase.auth.getSession();
  cachedUserId.current = session?.user?.id ?? null;
```

## Ficheiro unico a alterar

- `src/contexts/DataContext.tsx` (linhas 524-585)

## Resultado esperado

- Eliminacao do deadlock que causa travamentos
- Carregamento mais rapido (menos uma chamada de rede)
- Sistema estavel sem oscilacoes
