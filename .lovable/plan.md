
# Otimizar Navegação - Eliminar "Piscadas" e Flash Branco

## Diagnóstico do Problema

A análise do código revelou as causas do "flash branco" durante a navegação:

| Causa | Arquivo | Impacto |
|-------|---------|---------|
| **AppLayout re-renderiza completamente** | Cada página recria `SidebarProvider` | Sidebar pisca |
| **Sem React Query cache** | `new QueryClient()` sem configuração | Refetch a cada navegação |
| **DataContext carrega tudo** | `DataContext.tsx` fetch paralelo | Tela branca inicial |
| **Páginas sem skeleton** | `Dashboard.tsx`, `Agenda.tsx`, etc. | Conteúdo aparece de repente |
| **Transições inexistentes** | Nenhum fade entre rotas | Mudança brusca |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────┐
│                    App.tsx                       │
│  ┌─────────────────────────────────────────────┐│
│  │         PersistentLayout                    ││
│  │  ┌───────────┬───────────────────────────┐ ││
│  │  │  Sidebar  │      PageTransition        │ ││
│  │  │ (Estável) │  ┌─────────────────────┐  │ ││
│  │  │           │  │ <Suspense>          │  │ ││
│  │  │           │  │   <Routes>          │  │ ││
│  │  │           │  │     (Lazy Pages)    │  │ ││
│  │  │           │  │   </Routes>         │  │ ││
│  │  │           │  │ </Suspense>         │  │ ││
│  │  │           │  └─────────────────────┘  │ ││
│  │  └───────────┴───────────────────────────┘ ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

---

## Implementação

### 1. Layout Persistente (Sidebar + Header estáveis)

**Novo arquivo: `src/components/layout/PersistentLayout.tsx`**

O layout principal será movido para um componente persistente que envolve todas as rotas protegidas:

```typescript
// Layout que persiste entre navegações
export function PersistentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen">
        <PersistentHeader />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Modificar: `src/components/layout/AppLayout.tsx`**

Simplificar para apenas wrapper de conteúdo (sem recriar sidebar):

```typescript
export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  // Atualiza título via contexto (não recria layout)
  usePageTitle(title, subtitle, actions);
  return <div className="space-y-6 animate-fade-in">{children}</div>;
}
```

---

### 2. Componente de Transição de Página

**Novo arquivo: `src/components/layout/PageTransition.tsx`**

Transições CSS suaves entre rotas:

```typescript
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setIsTransitioning(false);
    }, 150);
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <div className={cn(
      "transition-all duration-200 ease-out",
      isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
    )}>
      {displayChildren}
    </div>
  );
}
```

---

### 3. Skeletons Reutilizáveis para Páginas

**Novo arquivo: `src/components/skeletons/PageSkeletons.tsx`**

```typescript
// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CardSkeleton className="lg:col-span-2 h-80" />
        <CardSkeleton className="h-80" />
      </div>
    </div>
  );
}

// Agenda skeleton
export function AgendaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <Skeleton className="h-[500px] w-full rounded-lg" />
    </div>
  );
}

// Table skeleton genérico
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="space-y-0 divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 4. Otimização React Query (Cache Inteligente)

**Modificar: `src/App.tsx`**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutos antes de refetch
      gcTime: 30 * 60 * 1000,        // 30 minutos no cache
      retry: 1,
      refetchOnWindowFocus: false,   // Evita refetch ao voltar à aba
    },
  },
});
```

---

### 5. Suspense Boundaries com Fallback Elegante

**Modificar: `src/App.tsx`**

Adicionar Suspense nas rotas protegidas:

```typescript
import { Suspense, lazy } from 'react';
import { PageLoadingFallback } from '@/components/layout/PageLoadingFallback';

// Lazy load das páginas
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Agenda = lazy(() => import('./pages/Agenda'));
// ... outras páginas

// Nas rotas:
<Route path="/" element={
  <ProtectedRoute>
    <Suspense fallback={<PageLoadingFallback />}>
      <Dashboard />
    </Suspense>
  </ProtectedRoute>
} />
```

**Novo arquivo: `src/components/layout/PageLoadingFallback.tsx`**

```typescript
export function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-primary/30" />
          <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
```

---

### 6. Loading States em Páginas Existentes

**Modificar cada página** para usar skeletons durante carregamento:

Exemplo para `Dashboard.tsx`:

```typescript
export default function Dashboard() {
  const { sessions, patients, professionals, services, ... } = useData();
  const isLoading = !sessions.length && !patients.length;

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  // ... resto do código
}
```

---

### 7. CSS para Transições Globais

**Modificar: `src/index.css`**

Adicionar transições suaves:

```css
/* Page transition utilities */
@layer utilities {
  .page-enter {
    opacity: 0;
    transform: translateY(8px);
  }
  
  .page-enter-active {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 200ms ease-out, transform 200ms ease-out;
  }
  
  .page-exit {
    opacity: 1;
    transform: translateY(0);
  }
  
  .page-exit-active {
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 150ms ease-in, transform 150ms ease-in;
  }
}

/* Prevent layout shift during transitions */
main {
  will-change: opacity, transform;
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/layout/PersistentLayout.tsx` | Criar | Layout wrapper persistente |
| `src/components/layout/PageTransition.tsx` | Criar | Transições entre rotas |
| `src/components/layout/PageLoadingFallback.tsx` | Criar | Fallback para Suspense |
| `src/components/skeletons/PageSkeletons.tsx` | Criar | Skeletons para cada página |
| `src/contexts/PageTitleContext.tsx` | Criar | Contexto para título dinâmico |
| `src/App.tsx` | Modificar | Lazy loading + Suspense + QueryClient otimizado |
| `src/components/layout/AppLayout.tsx` | Modificar | Simplificar para usar contexto |
| `src/index.css` | Modificar | Adicionar animações de transição |
| `src/pages/Dashboard.tsx` | Modificar | Adicionar skeleton loading |
| `src/pages/Agenda.tsx` | Modificar | Adicionar skeleton loading |
| `src/pages/Pacientes.tsx` | Modificar | Adicionar skeleton loading |
| `src/pages/Prontuarios.tsx` | Já tem | Manter loading existente |
| `src/pages/Financeiro.tsx` | Modificar | Adicionar skeleton loading |
| `src/pages/Comercial.tsx` | Modificar | Adicionar skeleton loading |

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Flash branco ao navegar | Transição suave de 200ms |
| Sidebar recarrega | Sidebar sempre visível |
| Sem feedback de loading | Skeletons animados |
| Refetch a cada navegação | Cache de 5 minutos |
| Páginas carregam de repente | Fade-in progressivo |

---

## Resumo Técnico

| Aspecto | Avaliação |
|---------|-----------|
| Complexidade | Média-Alta |
| Arquivos criados | 5 |
| Arquivos modificados | ~10 |
| Risco | Baixo (mudanças incrementais) |
| Impacto UX | Muito Alto |
| Tempo estimado | 20-30 minutos |
