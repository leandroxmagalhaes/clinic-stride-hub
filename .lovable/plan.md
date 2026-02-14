

# Corrigir Dashboard Travado nos Skeletons

## Problema

O sistema fica travado nos skeletons de carregamento e nunca mostra os dados. A causa raiz esta no `DataContext.tsx`:

1. A funcao `initLoad` usa `supabase.auth.getUser()` que faz uma chamada de rede ao servidor de autenticacao. Se essa chamada demorar, todo o carregamento trava.
2. O guard `isFetchingAll` pode criar um deadlock: quando `initLoad` e `INITIAL_SESSION` correm ao mesmo tempo, a segunda chamada a `fetchAllData` retorna imediatamente SEM executar os fetches, mas os estados de loading (`patientsLoading`, `sessionsLoading`, etc.) continuam `true` para sempre.

## Solucao

### Arquivo: `src/contexts/DataContext.tsx`

Duas correcoes:

**A) Trocar `getUser()` por `getSession()` no initLoad**

`getSession()` e local/cachado e nao faz chamada de rede, ao contrario de `getUser()` que contacta o servidor. Isto elimina o risco de travamento por rede lenta.

```typescript
const initLoad = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    setPatientsLoading(false);
    setSessionsLoading(false);
    setProfessionalsLoading(false);
    setServicesLoading(false);
    setEvolutionsLoading(false);
    return;
  }
  cachedUserId.current = session.user.id;
  await fetchAllData(false);
  hasInitiallyLoaded.current = true;
};
```

**B) Remover o guard `isFetchingAll` e garantir que loading sempre resolve**

O guard `isFetchingAll` e a causa do deadlock. Ao remover, duas chamadas concorrentes a `fetchAllData` podem correr em paralelo, mas isso nao causa problema: os fetch individuais (fetchPatients, fetchSessions, etc.) sao idempotentes e a segunda execucao simplesmente sobrescreve com os mesmos dados. O importante e que os estados de loading SEMPRE sejam resolvidos.

```typescript
// Remover isFetchingAll ref
// Remover guard de isFetchingAll dentro de fetchAllData

const fetchAllData = async (silent = false) => {
  await Promise.all([
    fetchPatients(silent),
    fetchServices(silent),
    fetchSessions(silent),
    fetchProfessionals(silent),
    fetchEvolutions(silent),
    fetchCreditBalances(),
    fetchCreditUsageMap(),
  ]);
};
```

**C) Tambem usar `getSession()` no listener de auth**

Substituir `getUser()` por `getSession()` no handler de `onAuthStateChange` para consistencia e rapidez. O callback do `onAuthStateChange` ja recebe a session como segundo parametro, portanto basta usar essa session diretamente:

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    // ... limpar estado
  } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    const user = session?.user;
    if (!user) return;
    if (user.id === cachedUserId.current && hasInitiallyLoaded.current) {
      fetchAllData(true);
      return;
    }
    cachedUserId.current = user.id;
    await fetchAllData(false);
    hasInitiallyLoaded.current = true;
  }
});
```

## Resultado Esperado

- O Dashboard carrega imediatamente sem travar nos skeletons
- Sem chamadas de rede bloqueantes durante a inicializacao
- Sem risco de deadlock entre initLoad e o listener de autenticacao
- Funciona corretamente em qualquer navegador e perfil

## Arquivo a modificar

1. `src/contexts/DataContext.tsx` - As tres correcoes descritas acima

