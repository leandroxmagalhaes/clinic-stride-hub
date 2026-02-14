

# Corrigir Perda de Formularios ao Mudar de Aba (Solucao Completa)

## Problema

A correcao anterior no `useAuth` nao foi suficiente. Existem outros pontos no sistema que reagem a eventos de autenticacao e provocam a remontagem dos componentes da pagina, apagando formularios abertos.

A cadeia do problema:
1. Ao voltar a aba, o sistema de autenticacao pode emitir um evento
2. `useUserRole` reage ao evento, reseta o cache e re-busca permissoes com `isLoading = true`
3. `usePermissions` ve `rolesLoading = true` e reporta `isLoading = true`
4. `PermissionGuard` mostra o ecrã "Verificando permissoes..." e **desmonta a pagina inteira**
5. Quando as permissoes carregam, a pagina monta do zero -- formularios, modais e dados perdidos

## Solucao

Corrigir em 3 pontos para garantir que a pagina nunca e desmontada desnecessariamente:

### 1. `useUserRole` - Evitar re-fetch desnecessario (`src/hooks/useUserRole.ts`)

No listener de `onAuthStateChange`, antes de resetar o cache e re-buscar roles no evento `SIGNED_IN`, verificar se o utilizador realmente mudou. Se o ID e o mesmo, ignorar o evento.

```typescript
supabase.auth.onAuthStateChange(async (event) => {
  if (event === 'SIGNED_OUT') {
    cachedUserId.current = null;
    setRoles([]);
    setIsLoading(false);
    return;
  }
  if (event === 'SIGNED_IN') {
    const { data: { user } } = await supabase.auth.getUser();
    // So re-buscar se o utilizador realmente mudou
    if (user?.id === cachedUserId.current && roles.length > 0) {
      return;
    }
    cachedUserId.current = null;
    fetchRoles();
  }
});
```

### 2. `PermissionGuard` - Nao desmontar apos primeira carga (`src/components/auth/PermissionGuard.tsx`)

Usar um `useRef` para rastrear se as permissoes ja foram carregadas uma vez. Se ja foram, manter os filhos montados mesmo durante recarregamentos (mostrar um indicador sutil se necessario, sem desmontar a pagina).

```typescript
const hasLoadedOnce = useRef(false);

if (!isLoading) {
  hasLoadedOnce.current = true;
}

// Primeira carga: mostrar spinner
if (isLoading && !hasLoadedOnce.current) {
  return <LoadingSpinner />;
}
// Ja carregou: manter filhos montados
```

### 3. `usePermissions` - Nao resetar loading apos primeira carga (`src/hooks/usePermissions.ts`)

Usar um ref para evitar que `isLoadingPermissions` volte a `true` apos a primeira carga bem-sucedida.

```typescript
const hasLoadedPermissions = useRef(false);

// No effect de carregar permissoes:
if (!rolesLoading) {
  if (hasLoadedPermissions.current) {
    // Re-carregar silenciosamente sem mudar isLoading
    loadPermissions().then(() => {});
  } else {
    loadPermissions().then(() => {
      hasLoadedPermissions.current = true;
    });
  }
}
```

## Arquivos a modificar

- `src/hooks/useUserRole.ts` - Verificar ID do utilizador antes de re-buscar roles
- `src/hooks/usePermissions.ts` - Nao resetar loading apos primeira carga
- `src/components/auth/PermissionGuard.tsx` - Manter filhos montados apos primeira verificacao

## Resultado

- Mudar de aba e voltar **nao fecha** modais nem perde dados de formularios
- As permissoes sao verificadas silenciosamente em segundo plano
- A primeira carga continua a mostrar o spinner normalmente
- Login/logout continuam a funcionar corretamente

