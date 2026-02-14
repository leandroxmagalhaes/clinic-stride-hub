

# Corrigir Tela Travada em "Carregando..." ao Mudar de Aba (Solucao Definitiva)

## Problema

Ao mudar de aba do navegador e voltar, a tela fica presa nos skeletons de carregamento e nao volta a mostrar os dados. A imagem mostra a pagina de Pacientes travada em "Carregando..." com skeletons visiveis.

## Causa Raiz (3 pontos de falha)

Existem tres sistemas que reagem ao evento de autenticacao ao voltar a aba, cada um contribuindo para o problema:

### 1. DataContext re-busca TUDO ao voltar a aba

O `DataContext.tsx` (linha 532) tem um listener de `onAuthStateChange` que, ao receber `SIGNED_IN` (disparado no token refresh ao voltar a aba), re-busca TODOS os dados (pacientes, sessoes, profissionais, etc.). Cada fetch define `xxxLoading = true`, o que mostra os skeletons. Se algum fetch falhar ou demorar, a tela trava.

### 2. useUserRole tem dependencia circular

O `fetchRoles` em `useUserRole.ts` depende de `roles.length` no seu `useCallback` (linha 45). Isto cria uma dependencia circular: quando roles carregam, `fetchRoles` muda de referencia, o `useEffect` re-executa e re-subscreve o listener de auth. Alem disso, `roles.length` dentro do `onAuthStateChange` captura um valor obsoleto (stale closure).

### 3. Fetches repetem o loading mesmo quando ja tem dados

Todas as funcoes de fetch no DataContext (fetchPatients, fetchSessions, etc.) definem `xxxLoading = true` no inicio, mesmo quando ja existem dados carregados. Isto apaga os dados visiveis e mostra skeletons.

## Solucao

### Arquivo 1: `src/contexts/DataContext.tsx`

**Problema:** O listener `onAuthStateChange` dispara re-fetch de tudo no `SIGNED_IN`.

**Correcao:**
- Adicionar um `cachedUserId` ref para rastrear o utilizador atual
- No evento `SIGNED_IN`, verificar se o utilizador mudou antes de re-buscar
- Se o utilizador e o mesmo (apenas token refresh), ignorar o evento
- Nas funcoes de fetch, NAO definir loading como `true` se ja existirem dados carregados (usar um parametro `isInitial` ou verificar se o array ja tem dados)

### Arquivo 2: `src/hooks/useUserRole.ts`

**Problema:** `fetchRoles` depende de `roles.length`, criando loop e stale closures.

**Correcao:**
- Usar um ref (`rolesRef`) para rastrear roles em vez de depender do estado diretamente no callback
- Remover `roles.length` das dependencias do `useCallback`
- Usar o ref dentro do `onAuthStateChange` para verificar se ja tem roles carregadas (evita stale closure)

### Arquivo 3: `src/hooks/usePermissions.ts` (ajuste menor)

Verificar que `isLoadingPermissions` nunca volta a `true` apos a primeira carga, independentemente do que aconteca com `rolesLoading`.

## Detalhes Tecnicos

### DataContext - Listener estabilizado

```typescript
// Adicionar ref no topo do DataProvider
const cachedUserId = useRef<string | null>(null);
const hasInitiallyLoaded = useRef(false);

// No useEffect do auth listener:
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_OUT') {
      cachedUserId.current = null;
      hasInitiallyLoaded.current = false;
      // Limpar dados...
      return;
    }
    if (event === 'SIGNED_IN') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === cachedUserId.current && hasInitiallyLoaded.current) {
        return; // Mesmo utilizador, ignorar
      }
      cachedUserId.current = user?.id ?? null;
      // Re-buscar dados...
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

### DataContext - Fetches sem loading quando ja tem dados

Para cada funcao de fetch, nao definir loading como `true` se ja existirem dados:

```typescript
const fetchPatients = async (silent = false) => {
  if (!silent) setPatientsLoading(true);
  // ... fetch logic
};
```

O fetch inicial usa `silent = false`, re-fetches usam `silent = true`.

### useUserRole - Sem dependencia circular

```typescript
const rolesRef = useRef<AppRole[]>([]);

const fetchRoles = useCallback(async () => {
  if (isFetching.current) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === cachedUserId.current && rolesRef.current.length > 0) {
    setIsLoading(false);
    return;
  }
  // ... resto do fetch
}, []); // SEM dependencias que mudam

// Manter rolesRef sincronizado
useEffect(() => {
  rolesRef.current = roles;
}, [roles]);
```

## Resultado Esperado

- Mudar de aba e voltar NAO mostra skeletons nem trava a pagina
- Os dados permanecem visiveis durante re-verificacoes silenciosas
- Formularios e modais abertos continuam intactos
- Login/logout continuam a funcionar normalmente
- A primeira carga continua a mostrar loading normalmente

## Arquivos a modificar

1. `src/contexts/DataContext.tsx` - Estabilizar listener auth + fetches silenciosos
2. `src/hooks/useUserRole.ts` - Corrigir dependencia circular + stale closures
3. `src/hooks/usePermissions.ts` - Garantir que loading nao reseta

