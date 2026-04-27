# Corrigir arranque do preview — d3-array em vite.config.ts

## Causa raiz

O dev server falha imediatamente com:

```
Error: ENOENT: no such file or directory, open '/dev-server/node_modules/d3-array/src/index.js'
```

O `vite.config.ts` contém um workaround antigo que:

1. Define um **alias hardcoded** `"d3-array" -> node_modules/d3-array/src/index.js`
2. Força `optimizeDeps.include: ["d3-array"]`
3. Adiciona `commonjsOptions.include: [/d3-array/, ...]`

Porém o pacote `d3-array` **já não está instalado** em `node_modules` (foi removido das dependências transitivas após uma alteração no lockfile). O alias aponta para um ficheiro inexistente, e como `optimizeDeps.include` força o Vite a pré-empacotá-lo no arranque, o servidor crasha antes de servir uma única requisição.

## Correção (cirúrgica, sem alterações funcionais)

Editar **apenas** `vite.config.ts`:

- Remover a linha do alias `"d3-array": ...`
- Remover o bloco `optimizeDeps: { include: ["d3-array"] }`
- Remover o bloco `build.commonjsOptions` (específico ao d3-array)

O resultado é a configuração padrão do Vite. Se algum componente (ex.: `recharts`) precisar de `d3-array`, o gestor de pacotes voltará a instalá-lo como dependência transitiva normalmente, sem necessidade de alias manual.

## Resultado esperado

- Vite arranca sem erro de ENOENT
- Preview volta a carregar
- Sem qualquer alteração ao código da aplicação, schema, ou comportamento funcional

## Detalhes técnicos

Ficheiro alterado: `vite.config.ts` (única alteração).

Diff conceptual:

```text
 export default defineConfig(({ mode }) => ({
   server: { host: "::", port: 8080, hmr: { overlay: false } },
   plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
   resolve: {
     alias: {
       "@": path.resolve(__dirname, "./src"),
-      "d3-array": path.resolve(__dirname, "node_modules/d3-array/src/index.js"),
     },
     dedupe: ["react", "react-dom", "react/jsx-runtime"],
   },
-  optimizeDeps: { include: ["d3-array"] },
-  build: { commonjsOptions: { include: [/d3-array/, /node_modules/] } },
 }));
```
