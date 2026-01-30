
# Corrigir Delay no Menu Lateral

## Problema Identificado

Ao clicar em itens do menu, há um delay de vários segundos porque:

1. **NavItemComponent recriado a cada render** - O componente está definido dentro de `AppSidebar`, causando recriação constante
2. **Warnings de refs não tratados** - React mostra warnings sobre refs em componentes funcionais sem `forwardRef`
3. **Carregamento de permissões síncrono** - O hook `useUserRole` faz query ao banco a cada mudança de auth
4. **Re-renderização desnecessária** - Quando o usuário navega, todo o sidebar é re-renderizado com checks de permissão

---

## Solução Proposta

### 1. Extrair NavItemComponent para fora do AppSidebar

Mover o componente para fora da função principal e usar `React.memo` para evitar re-renders:

```typescript
// Antes: definido DENTRO de AppSidebar
const NavItemComponent = ({ item }: { item: NavItem }) => { ... }

// Depois: definido FORA e memoizado
const NavItemComponent = React.memo(({ item, isActive, canAccess }: NavItemProps) => {
  if (!canAccess) return null;
  // ... resto do código
});
```

### 2. Adicionar forwardRef ao AppFooter

```typescript
// Antes
export function AppFooter() { ... }

// Depois
export const AppFooter = React.forwardRef<HTMLElement>((props, ref) => {
  return <footer ref={ref} ...>...</footer>
});
```

### 3. Otimizar useUserRole com cache local

Adicionar cache para evitar queries repetidas ao banco:

```typescript
// Usar useMemo e useCallback para evitar recálculos
const cachedRoles = useMemo(() => roles, [roles.join(',')]);
```

### 4. Simplificar verificação de permissões no sidebar

Em vez de chamar `canAccessModule` em cada render, pré-calcular os itens visíveis:

```typescript
// Usar useMemo para calcular uma vez
const visibleItems = useMemo(() => ({
  main: mainNavItems.filter(item => !item.module || canAccessModule(item.module)),
  management: managementNavItems.filter(item => !item.module || canAccessModule(item.module)),
}), [canAccessModule]);
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Extrair NavItemComponent, usar memo, otimizar |
| `src/components/layout/AppFooter.tsx` | Adicionar forwardRef |
| `src/hooks/useUserRole.ts` | Adicionar cache para roles |

---

## Detalhes Técnicos

### AppSidebar.tsx - Mudanças Principais

```typescript
import React, { memo, useMemo } from "react";

// FORA do componente principal
interface NavItemProps {
  item: NavItem;
  isActive: boolean;
}

const NavItem = memo(function NavItem({ item, isActive }: NavItemProps) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={!item.disabled}
        isActive={isActive}
        disabled={item.disabled}
        className={cn(
          "transition-all duration-200",
          item.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {item.disabled ? (
          <div className="flex items-center gap-3 w-full">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="...">
                {item.badge}
              </Badge>
            )}
          </div>
        ) : (
          <Link to={item.url} className="flex items-center gap-3 w-full">
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

export function AppSidebar() {
  const location = useLocation();
  // ...

  // Memoizar itens visíveis
  const visibleItems = useMemo(() => ({
    main: mainNavItems.filter(item => !item.module || canAccessModule(item.module)),
    management: managementNavItems.filter(item => !item.module || canAccessModule(item.module)),
  }), [canAccessModule]);

  return (
    <Sidebar>
      {/* ... */}
      <SidebarMenu>
        {visibleItems.main.map((item) => (
          <NavItem 
            key={item.title} 
            item={item} 
            isActive={location.pathname === item.url}
          />
        ))}
      </SidebarMenu>
    </Sidebar>
  );
}
```

### AppFooter.tsx - Adicionar forwardRef

```typescript
import React, { forwardRef } from "react";

export const AppFooter = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  function AppFooter(props, ref) {
    return (
      <footer ref={ref} className="border-t bg-muted/30 py-4 px-6 mt-auto" {...props}>
        {/* conteúdo existente */}
      </footer>
    );
  }
);
```

### useUserRole.ts - Cache de Roles

```typescript
import { useState, useEffect, useRef, useCallback } from "react";

export function useUserRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cachedUserId = useRef<string | null>(null);

  const fetchRoles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Só busca se o usuário mudou
    if (user?.id === cachedUserId.current && roles.length > 0) {
      setIsLoading(false);
      return;
    }
    
    cachedUserId.current = user?.id || null;
    setIsLoading(true);
    const userRoles = await UserRoleService.getUserRoles();
    setRoles(userRoles);
    setIsLoading(false);
  }, [roles.length]);

  // ...
}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Delay de 2-3s ao clicar no menu | Navegação instantânea |
| Warnings de refs no console | Console limpo |
| Re-render completo a cada navegação | Apenas item ativo muda |
| Query ao banco a cada click | Cache de permissões |

---

## Resumo Técnico

| Aspecto | Avaliação |
|---------|-----------|
| Complexidade | Média |
| Arquivos modificados | 3 |
| Risco | Baixo - otimizações de performance |
| Impacto | Alto - melhoria significativa na UX |
