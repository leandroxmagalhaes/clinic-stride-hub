
# Corrigir Travamentos em Todas as Telas

## Problemas Identificados

### 1. Instancias duplicadas do React (causa principal da lentidao)
O `vite.config.ts` nao tem `dedupe` configurado. Bibliotecas como `@dnd-kit`, `@radix-ui`, `recharts`, etc. podem empacotar suas proprias copias do React, causando conflitos internos que deixam a aplicacao extremamente lenta e instavel.

### 2. Skeleton sem forwardRef (erros no console)
O componente `Skeleton` nao aceita refs, gerando erros repetidos no console toda vez que um skeleton e renderizado. Isso polui o console e pode afetar performance por excesso de warnings.

### 3. Dashboard e Agenda bloqueiam tudo no `isLoading` global
Ambas as paginas usam `if (isLoading) return <Skeleton>` que depende de TODOS os dados (pacientes + sessoes + profissionais + servicos) carregarem simultaneamente. Se qualquer um demorar, a tela inteira fica travada nos skeletons.

## Correcoes (sem tocar no DataContext.tsx)

### Arquivo 1: `vite.config.ts`
Adicionar `dedupe: ["react", "react-dom", "react/jsx-runtime"]` na configuracao de `resolve`. Isto forca o Vite a usar uma unica instancia do React em todo o bundle, eliminando conflitos entre bibliotecas.

### Arquivo 2: `src/components/ui/skeleton.tsx`
Converter para `React.forwardRef` para eliminar os erros repetidos no console.

### Arquivo 3: `src/pages/Dashboard.tsx`
Remover o bloco `if (isLoading) return <DashboardSkeleton />`. A pagina renderiza imediatamente com dados vazios (mostra 0 nos stats, lista vazia nas sessoes). Os dados aparecem assim que carregam, sem travar a tela.

### Arquivo 4: `src/pages/Agenda.tsx`
Mesmo padrao: remover o bloco `if (isLoading) return <AgendaSkeleton />`. A agenda aparece imediatamente (vazia), preenchendo conforme os dados carregam.

## Detalhes Tecnicos

### vite.config.ts
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
  dedupe: ["react", "react-dom", "react/jsx-runtime"],
},
```

### skeleton.tsx
```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  )
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
```

### Dashboard.tsx e Agenda.tsx
Remover os blocos `if (isLoading) { return ... <Skeleton> }` que bloqueiam a renderizacao completa da pagina. Os componentes ja lidam graciosamente com arrays vazios (mostram "Nenhum agendamento proximo", valores 0, etc.).

## Ficheiro que NAO sera tocado
- `src/contexts/DataContext.tsx`

## Resultado Esperado
- Aplicacao significativamente mais rapida (sem React duplicado)
- Zero erros de ref no console
- Paginas aparecem instantaneamente, dados preenchem progressivamente
- Funciona melhor tanto no desktop quanto no mobile
