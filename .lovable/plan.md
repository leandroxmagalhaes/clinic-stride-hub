

# Resolver erro d3-array no Vite Build

## Problema
O Vite nao consegue resolver o entry point do pacote `d3-array` (dependencia transitiva do `recharts`), causando falha no build.

## Solucao
Adicionar configuracao no `vite.config.ts` para forcar o Vite a pre-processar o `d3-array`.

## Alteracao

### `vite.config.ts`
Adicionar dois blocos de configuracao apos o bloco `resolve`:

- **`optimizeDeps.include`**: Adicionar `'d3-array'` para forcar pre-bundling da dependencia
- **`build.commonjsOptions.include`**: Adicionar `/d3-array/` e `/node_modules/` para garantir que o Rollup processa correctamente o modulo durante o build de producao

```text
ANTES:
  resolve: { ... },
}));

DEPOIS:
  resolve: { ... },
  optimizeDeps: {
    include: ["d3-array"],
  },
  build: {
    commonjsOptions: {
      include: [/d3-array/, /node_modules/],
    },
  },
}));
```

## Ficheiro alterado
- `vite.config.ts` (unico ficheiro)

