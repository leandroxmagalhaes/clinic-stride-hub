
# Corrigir Tela Travada em Skeletons ao Abrir em Outro Navegador

## Problema

Ao abrir o sistema num perfil diferente do Chrome e fazer login com outra conta, a pagina fica presa nos skeletons de carregamento e nunca mostra os dados. A imagem mostra o Dashboard ("Painel") com todos os cards em skeleton indefinidamente.

## Causa Raiz

O `DataProvider` esta posicionado no topo da aplicacao (fora do `ProtectedRoute`), o que cria uma condicao de corrida:

1. O utilizador abre a app num navegador novo (sem sessao ou com token expirado)
2. `initLoad` executa imediatamente e tenta buscar dados SEM autenticacao
3. As queries falham silenciosamente (RLS bloqueia) e retornam arrays vazios
4. `hasInitiallyLoaded` e marcado como `true`
5. O utilizador faz login, o evento `SIGNED_IN` dispara
6. O handler verifica `user?.id === cachedUserId.current` -- como `cachedUserId` e `null` e o user e real, entra na branch "novo utilizador"
7. Novos fetches sao disparados COM loading, mas os fetches anteriores (do `initLoad`) podem ainda estar a correr, criando uma corrida entre duas execucoes simultaneas da mesma funcao
8. Uma das execucoes pode definir `loading=false` prematuramente enquanto a outra ainda esta a carregar, ou os dados vazios do primeiro fetch podem sobrescrever os dados reais

Alem disso, o listener de autenticacao so trata `SIGNED_IN` e `SIGNED_OUT`, mas ignora o evento `INITIAL_SESSION` que o sistema de autenticacao dispara quando ja existe uma sessao valida ao abrir a pagina.

## Solucao

### Arquivo: `src/contexts/DataContext.tsx`

Tres correcoes pontuais:

**A) initLoad so busca dados se houver utilizador autenticado**

Se `getUser()` retorna null (sem sessao), nao executar nenhum fetch. Apenas marcar loading como false para nao mostrar skeletons eternamente. O carregamento real so acontece quando `SIGNED_IN` dispara apos o login.

```typescript
const initLoad = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Sem utilizador - nao buscar dados, apenas resolver loading
    setPatientsLoading(false);
    setSessionsLoading(false);
    setProfessionalsLoading(false);
    setServicesLoading(false);
    setEvolutionsLoading(false);
    return;
  }
  cachedUserId.current = user.id;
  await Promise.all([...fetches...]);
  hasInitiallyLoaded.current = true;
};
```

**B) Tratar evento `INITIAL_SESSION` alem de `SIGNED_IN`**

Quando o utilizador ja tem sessao valida ao abrir a pagina, o sistema de autenticacao emite `INITIAL_SESSION` em vez de `SIGNED_IN`. Adicionar tratamento para este evento.

```typescript
} else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
  // ... mesmo tratamento
}
```

**C) Protecao contra fetches concorrentes**

Adicionar um ref `isFetchingAll` para impedir que duas rondas de fetch corram simultaneamente. Se uma ronda ja esta em curso, a segunda e ignorada.

```typescript
const isFetchingAll = useRef(false);

const fetchAllData = async (silent = false) => {
  if (isFetchingAll.current) return;
  isFetchingAll.current = true;
  try {
    await Promise.all([
      fetchPatients(silent),
      fetchServices(silent),
      fetchSessions(silent),
      fetchProfessionals(silent),
      fetchEvolutions(silent),
      fetchCreditBalances(),
      fetchCreditUsageMap(),
    ]);
  } finally {
    isFetchingAll.current = false;
  }
};
```

## Resultado Esperado

- Abrir o sistema num perfil de Chrome diferente e fazer login com outra conta funciona corretamente
- Os dados carregam apos o login sem ficar preso nos skeletons
- O comportamento ao mudar de aba continua estavel (correcoes anteriores mantidas)
- Sem corridas de fetches concorrentes

## Arquivos a modificar

1. `src/contexts/DataContext.tsx` - As tres correcoes descritas acima
