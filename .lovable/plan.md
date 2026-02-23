

# Corrigir Build Falhado e Erro "Erro Inesperado" na App Publicada

## Diagnostico

A app publicada esta a correr uma versao antiga (build antigo) porque o build actual **falha** devido ao pacote `d3-array`. Isto significa que todas as correcoes de null safety feitas anteriormente **nunca foram publicadas**.

### Causa Raiz do Build Falhado

O pacote `d3-array@3.2.4` (dependencia transitiva do `recharts`) tem um campo `exports` malformado no seu `package.json`:

```text
"exports": {
  "umd": "./dist/d3-array.min.js",
  "default": "./src/index.js"
}
```

O Vite/Rollup espera uma entrada `"."` (ponto) no campo exports para resolver o entry point do pacote. Como nao existe, o build falha com: `Failed to resolve entry for package "d3-array"`.

A configuracao `optimizeDeps.include` e `commonjsOptions` que adicionamos anteriormente so ajuda no modo de desenvolvimento, **nao resolve o problema do build de producao**.

## Solucao

Adicionar um `resolve.alias` no `vite.config.ts` que aponta `d3-array` directamente para o seu ficheiro de entrada (`src/index.js`), contornando completamente a resolucao defeituosa do campo `exports`.

## Ficheiro a Alterar

### `vite.config.ts`

Adicionar alias para `d3-array` no bloco `resolve.alias` existente, e manter as configuracoes `optimizeDeps` e `commonjsOptions` como estao:

```text
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "d3-array": path.resolve(__dirname, "node_modules/d3-array/src/index.js"),
  },
  dedupe: ["react", "react-dom", "react/jsx-runtime"],
},
```

## Resultado Esperado

1. O build de producao passa a funcionar correctamente
2. A app e publicada com todas as correcoes de null safety feitas anteriormente
3. O erro "Erro Inesperado" ao navegar entre abas desaparece

