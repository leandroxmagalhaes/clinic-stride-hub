
# Corrigir Crashes e Lentidao Progressiva

## Problema 1: App crasha com "Erro Inesperado"

As paginas sao carregadas com `lazy()` sem tratamento de falha. Quando o deploy muda ou a rede oscila, os ficheiros JavaScript antigos ficam invalidos. O `lazy()` falha com `TypeError: Importing a module script failed`, o ErrorBoundary do Sentry captura e mostra "Erro Inesperado". O utilizador precisa recarregar manualmente.

**Correcao:** Criar uma funcao `lazyWithRetry` que tenta recarregar o modulo ate 3 vezes antes de falhar. Se todas as tentativas falharem, faz reload automatico da pagina (uma unica vez, usando sessionStorage para evitar loop infinito).

## Problema 2: Lentidao progressiva (causa raiz)

O `useAuth()` e um hook independente — cada componente que o utiliza cria sua propria subscricao `onAuthStateChange` e chamada `getSession()`. Foram encontradas 8+ chamadas independentes:

- ProtectedRoute
- AppSidebar  
- Agenda
- Pacientes
- Engajamento
- PatientPortal
- TeamSettingsPanel
- Login/Signup

Cada subscricao gera eventos de rede, processamento e re-renders separados. Com o tempo, isso degrada a performance ate o ponto de travamento.

**Correcao:** Converter `useAuth` de hook standalone para um AuthContext/AuthProvider, garantindo UMA UNICA subscricao de autenticacao para toda a aplicacao. Todos os componentes consomem o mesmo estado sem criar listeners duplicados.

## Problema 3: Warnings no console (menor)

`DialogHeader` e `DialogFooter` em `dialog.tsx` sao funcoes simples que nao aceitam refs, gerando warnings repetidos no console. Nao causa crash mas polui os logs.

**Correcao:** Converter ambos para `React.forwardRef`.

## Ficheiros a Criar

### 1. `src/contexts/AuthContext.tsx`
- Criar AuthProvider que encapsula TODA a logica de autenticacao
- Uma unica subscricao `onAuthStateChange`
- Uma unica chamada `getSession()`
- Exportar `useAuth()` como hook de contexto
- Manter exatamente a mesma API (user, session, loading, signIn, signUp, signOut)

## Ficheiros a Editar

### 1. `src/App.tsx`
- Substituir `lazy()` por `lazyWithRetry()` em todas as 12 paginas
- Envolver a app com `<AuthProvider>`
- A funcao `lazyWithRetry` fica definida no topo do ficheiro

### 2. `src/hooks/useAuth.tsx`
- Remover toda a logica interna (useState, useEffect, subscricoes)
- Transformar em re-export simples do AuthContext: `export { useAuth } from '@/contexts/AuthContext'`
- Todos os imports existentes (`from '@/hooks/useAuth'`) continuam a funcionar sem alteracao

### 3. `src/components/ui/dialog.tsx`
- Converter `DialogHeader` e `DialogFooter` para `React.forwardRef`

## Ficheiro que NAO sera tocado
- `src/contexts/DataContext.tsx`

## Resultado Esperado

- Zero crashes por falha de carregamento de modulos (retry automatico)
- Uma unica subscricao de autenticacao em vez de 8+ (reducao drastica de carga)
- Performance estavel ao longo do tempo, sem degradacao progressiva
- Console limpo, sem warnings de refs
