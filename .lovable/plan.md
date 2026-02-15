
# Corrigir Menu Vazio na Sidebar

## Problema Identificado

A sidebar filtra os itens de navegacao usando `canAccessModule()`, que depende das permissoes do utilizador. Enquanto as permissoes estao a carregar (roles do utilizador ainda nao foram buscadas da base de dados), `canAccessModule()` retorna `false` para TODOS os modulos. Resultado: o menu fica completamente vazio.

A centralizacao do AuthContext alterou o timing de carregamento, fazendo com que o `useUserRole` (que tem a sua propria subscricao de autenticacao separada) demore mais a resolver as roles. O utilizador ve a sidebar com header ("Physione") e footer ("Usuario") mas sem nenhum item de menu no meio.

Adicionalmente, o `useUserRole` ainda cria a sua propria subscricao `onAuthStateChange`, duplicando a do AuthContext. Isto causa chamadas de rede desnecessarias e pode gerar race conditions.

## Correcoes

### 1. `src/components/layout/AppSidebar.tsx` - Mostrar menu durante carregamento

Alterar a logica de `visibleItems` para mostrar TODOS os itens enquanto as permissoes estao a carregar, em vez de esconder tudo. Adicionar o estado `isLoading` do `usePermissions`:

```text
Antes:
  main: mainNavItems.filter(item => !item.module || canAccessModule(item.module))

Depois:
  main: isLoading ? mainNavItems : mainNavItems.filter(item => !item.module || canAccessModule(item.module))
```

Isto garante que o menu esta sempre visivel. Quando as permissoes terminam de carregar, os itens sao filtrados conforme o papel do utilizador.

### 2. `src/hooks/useUserRole.ts` - Eliminar subscricao duplicada

Remover a subscricao `onAuthStateChange` do `useUserRole` (que duplica a do AuthContext). Em vez disso, usar o `user` do `useAuth()` como dependencia para buscar as roles. Isto:
- Elimina a segunda subscricao de autenticacao
- Usa o estado de auth ja resolvido pelo AuthContext
- Remove a chamada redundante a `supabase.auth.getUser()`
- Garante que as roles sao carregadas assim que o AuthContext confirma o utilizador

### 3. `src/hooks/useAuth.tsx` - Manter re-export (ja esta correto)

Este ficheiro ja re-exporta do AuthContext. Nenhuma alteracao necessaria.

## Resultado Esperado

- Menu de navegacao visivel IMEDIATAMENTE ao abrir a app
- Itens filtrados por permissao apenas apos o carregamento completo
- Uma unica subscricao de autenticacao em toda a app (eliminando race conditions)
- Performance mais estavel e previsivel
