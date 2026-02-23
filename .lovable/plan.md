

# Corrigir Erros Inesperados e Fortalecer Resiliencia da Aplicacao

## Problemas Identificados

### 1. Crashs por `null.split()` em `.full_name` (CRITICO)
Em **8 ficheiros**, o codigo acede `.full_name.split(' ')` directamente em objectos que podem ser `null` ou `undefined` (ex: `session.paciente?.full_name.split(...)`, `session.profissional?.full_name.split(...)`). O optional chaining `?.` para no `paciente`, mas `.full_name` pode nao existir, e `.split()` e chamado num valor potencialmente `undefined`, causando crash.

**Ficheiros afectados:**
- `src/components/agenda/AgendaDesktopGrid.tsx`
- `src/components/agenda/AgendaMobileTimeline.tsx`
- `src/components/agenda/DraggableSession.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Profissionais.tsx`
- `src/pages/Prontuarios.tsx`
- `src/pages/Pacientes.tsx`
- `src/components/patients/SendOnboardingLinkModal.tsx`

**Correcao:** Adicionar optional chaining completo e fallback: `session.paciente?.full_name?.split(' ')?.[0] ?? ''`

### 2. `getUser()` residual em Profissionais.tsx
O ficheiro `src/pages/Profissionais.tsx` (linha 63) ainda usa `supabase.auth.getUser()` — nao foi migrado na optimizacao anterior.

**Correcao:** Substituir por `getAuthContext()` de `@/lib/auth-helpers`.

### 3. Funcoes assincronas sem try/catch (crashs silenciosos)
- `src/pages/Engajamento.tsx` — `fetchAllData()` e `fetchClinicId()` sem try/catch, podem crashar o componente
- `src/pages/Financeiro.tsx` — `loadFinancialData()` nao mostra toast ao utilizador em caso de erro

### 4. Handler global para unhandled rejections ausente
Promessas rejeitadas sem handler causam crashes silenciosos (tela branca). O `main.tsx` tem ErrorBoundary mas nao captura erros assincronos.

**Correcao:** Adicionar listener `unhandledrejection` no `App.tsx`.

### 5. DataContext initLoad sem try/catch
O `useEffect` em `DataContext.tsx` (linha 517) chama `initLoad()` sem capturar erros. Se `getSession()` falhar, o app trava no estado de loading infinito.

**Correcao:** Envolver em try/catch e definir loading como false mesmo em caso de erro.

## Ficheiros a Alterar

### 1. `src/App.tsx`
- Adicionar listener global `unhandledrejection` com toast de erro

### 2. `src/contexts/DataContext.tsx`
- Adicionar try/catch ao `initLoad` com fallback de loading states

### 3. `src/pages/Profissionais.tsx`
- Substituir `getUser()` por `getAuthContext()`

### 4. `src/pages/Engajamento.tsx`
- Envolver `fetchAllData` em try/catch com toast

### 5. `src/pages/Financeiro.tsx`
- Adicionar toast.error quando dados financeiros falham

### 6-13. Correcoes de optional chaining (8 ficheiros)
Todos os acessos a `.full_name.split()` serao protegidos com `?.` completo:

- `src/components/agenda/AgendaDesktopGrid.tsx`
- `src/components/agenda/AgendaMobileTimeline.tsx`
- `src/components/agenda/DraggableSession.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Profissionais.tsx`
- `src/pages/Prontuarios.tsx`
- `src/pages/Pacientes.tsx`
- `src/components/patients/SendOnboardingLinkModal.tsx`

## Detalhes Tecnicos

### Padrao de correcao para `.full_name.split()`:

```text
ANTES (crash se full_name for undefined):
  {session.paciente?.full_name.split(' ')[0]}

DEPOIS (seguro):
  {session.paciente?.full_name?.split(' ')?.[0] ?? ''}
```

### Padrao para avatar initials:

```text
ANTES:
  {patient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}

DEPOIS:
  {(patient.full_name ?? '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || '?'}
```

### Handler global (App.tsx):

```text
import { useEffect } from "react";
import { toast } from "sonner";

// Dentro do App component, antes do return:
useEffect(() => {
  const handler = (event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection:", event.reason);
    event.preventDefault();
  };
  window.addEventListener("unhandledrejection", handler);
  return () => window.removeEventListener("unhandledrejection", handler);
}, []);
```

### DataContext initLoad protegido:

```text
useEffect(() => {
  const initLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      cachedUserId.current = session?.user?.id ?? null;
      await Promise.all([...fetches...]);
      hasInitiallyLoaded.current = true;
    } catch (err) {
      console.error("Error during initial data load:", err);
      // Garantir que loading termina mesmo com erro
      setPatientsLoading(false);
      setSessionsLoading(false);
      setProfessionalsLoading(false);
      setServicesLoading(false);
      setEvolutionsLoading(false);
    }
  };
  initLoad();
}, []);
```

## Resultado Esperado

- Eliminacao dos crashes por `null.split()` (causa mais provavel do "Erro Inesperado")
- Todas as operacoes assincronas protegidas com try/catch
- Loading states nunca ficam presos em caso de erro
- Handler global captura rejeicoes nao tratadas
- Ultima chamada `getUser()` residual eliminada

