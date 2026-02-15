
# Plano de Estabilizacao do Sistema

## Causa Raiz Identificada

Existem DUAS implementacoes separadas de `useAuth`:

1. **`src/contexts/AuthContext.tsx`** - AuthProvider centralizado com Context (usado pelo `useUserRole`)
2. **`src/hooks/useAuth.tsx`** - Hook independente que cria a SUA PROPRIA subscricao `onAuthStateChange` (usado pelo `ProtectedRoute`, `AppSidebar`, e outros)

Cada componente que importa de `src/hooks/useAuth.tsx` cria uma subscricao de autenticacao INDEPENDENTE com estado proprio. Isto significa que:
- `ProtectedRoute` tem o seu estado de auth
- `AppSidebar` tem outro estado de auth separado
- `AuthContext` tem ainda outro
- `DataContext` tem mais outro

Resultado: 4+ subscricoes de autenticacao a competir entre si, resolvendo em momentos diferentes, causando oscilacoes, menu a aparecer/desaparecer, e lentidao.

## Correcoes (3 ficheiros)

### 1. `src/hooks/useAuth.tsx` - Eliminar hook duplicado

Substituir o hook inteiro por um simples re-export do AuthContext. Em vez de criar a sua propria subscricao, passa a usar o estado centralizado:

```text
Antes: Hook independente com onAuthStateChange + getSession proprios (85 linhas)
Depois: Re-export de useAuth do AuthContext (1 linha)
```

Isto elimina instantaneamente todas as subscricoes duplicadas criadas por cada componente que usa este hook.

### 2. `src/hooks/usePermissions.ts` - Eliminar chamada getUser()

O `UserPermissionService.getCurrentUserPermissions()` faz `supabase.auth.getUser()` (chamada de rede) em cada carregamento. Substituir por uso directo do `user.id` ja disponivel via `useUserRole` > `useAuth` > `AuthContext`:

```text
Antes: await UserPermissionService.getCurrentUserPermissions()
       (que internamente faz supabase.auth.getUser())

Depois: await UserPermissionService.getUserPermissions(user.id)
        (usa o ID ja resolvido, sem chamada de rede extra)
```

Requer acesso ao `user` do `useAuth()` dentro do hook.

### 3. `src/components/layout/AppSidebar.tsx` - Garantir estabilidade

Confirmar que a logica de `visibleItems` continua a mostrar todos os itens durante o carregamento (ja implementada na alteracao anterior, mas verificar que funciona com o auth unificado).

Adicionalmente, memoizar `getRolesLabels` para evitar re-renders desnecessarios da sidebar.

## O que NAO sera tocado

- `src/contexts/AuthContext.tsx` - E a fonte de verdade, permanece como esta
- `src/contexts/DataContext.tsx` - Congelado conforme instrucao do utilizador
- `src/components/ui/sidebar.tsx` - Sem alteracoes necessarias
- `src/components/ui/sheet.tsx` - Os warnings de ref sao cosmeticos e nao afetam funcionalidade

## Resultado Esperado

- De 4+ subscricoes de autenticacao para apenas 2 (AuthContext + DataContext)
- Menu visivel imediatamente, sem oscilacoes
- Menos chamadas de rede na inicializacao (eliminada getUser() redundante)
- Estado de auth consistente em toda a aplicacao
