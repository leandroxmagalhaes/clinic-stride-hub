

# Optimizar Chamadas Redundantes de `getUser()` em Todo o Projecto

## Problema

Existem **125 chamadas** a `supabase.auth.getUser()` espalhadas por **15 ficheiros**. Cada chamada e um pedido HTTP ao servidor para validar o token, mesmo quando o `user` ja esta disponivel no `AuthContext`. Isto adiciona latencia a cada operacao do utilizador.

### Padrao repetido (presente em quase todos os services):
```text
const { data: { user } } = await supabase.auth.getUser();  // HTTP call
if (!user) return/throw;
const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('user_id', user.id);
```

Este padrao de "obter user + obter clinic_id" repete-se dezenas de vezes.

## Estrategia

Criar uma funcao utilitaria que usa `supabase.auth.getSession()` (leitura local, sem HTTP) em vez de `getUser()` (HTTP). Depois, substituir todas as chamadas nos services e componentes.

### Diferenca tecnica:
- `getUser()` -- faz HTTP request ao servidor (lento, ~100-300ms cada)
- `getSession()` -- le da memoria/localStorage (instantaneo, 0ms)

## Ficheiros a Alterar (15 ficheiros)

### 1. NOVO: `src/lib/auth-helpers.ts` -- Funcao utilitaria centralizada

Criar funcao `getAuthContext()` que retorna `{ userId, clinicId }` usando `getSession()` em vez de `getUser()`. Todos os services passam a usar esta funcao.

```text
getSession() -> session.user.id -> query profiles -> clinic_id
```

### 2. `src/contexts/DataContext.tsx` (5 chamadas a remover)

Metodos afectados:
- `addService` (linha 320)
- `addSession` (linha 604)
- `addCredits` (linha 720)
- `useCredit` (linha 770)
- `refundCredit` (linha 818)

Substituir `supabase.auth.getUser()` por `getAuthContext()` em cada metodo.

### 3. `src/services/AuditService.ts` (1 chamada)
- Metodo `log` (linha 48)

### 4. `src/services/LeadService.ts` (1 chamada)
- Metodo `getClinicId` (linha 43)

### 5. `src/services/ClinicService.ts` (3 chamadas)
- `getClinic` (linha 12)
- `updateClinic` (linha 42)
- `updateLogo` (linha 81)

### 6. `src/services/SettingsService.ts` (3 chamadas)
- `getSettings` (linha 14)
- `saveSettings` (linha 45)
- `getClinicInfo` (linha 109)

### 7. `src/services/AutomationEngine.ts` (1 chamada)
- `getCurrentClinicId` (linha 117)

### 8. `src/services/TeamService.ts` (1 chamada)
- `inviteMember` (linha 216)

### 9. `src/services/PatientDiaryService.ts` (3 chamadas)
- `createEntry` (linha 49)
- `getRecentEntries` (linha 108)
- `hasTodayEntry` (linha 133)

### 10. `src/services/UserRoleService.ts` (1 chamada)
- `getUserRoles` (linha 18)

### 11. `src/services/UserPermissionService.ts` (1 chamada)
- `getCurrentUserPermissions` (linha 114)

### 12. `src/hooks/useClinicInfo.ts` (1 chamada)
- `queryFn` (linha 20)

### 13. `src/pages/Prontuarios.tsx` (1 chamada)
- Handler de criacao de prontuario (linha 157)

### 14. `src/pages/Agenda.tsx` (1 chamada)
- Handler de criacao de pacote (linha 219)

### 15. `src/components/engajamento/NewFeedbackModal.tsx` (1 chamada)
- `fetchClinicId` (linha 52)

## Detalhes Tecnicos

### Funcao utilitaria (`src/lib/auth-helpers.ts`):

```text
export async function getAuthContext(): Promise<{ userId: string; clinicId: string }>
  1. Chama supabase.auth.getSession() (leitura local)
  2. Extrai session.user.id
  3. Consulta profiles para obter clinic_id
  4. Retorna { userId, clinicId }
  5. Lanca erro se nao autenticado ou sem clinica

export async function getAuthUserId(): Promise<string>
  1. Chama supabase.auth.getSession()
  2. Retorna session.user.id
  3. Para services que so precisam do userId (PatientDiaryService, UserRoleService)
```

### Exemplo de transformacao (LeadService):

```text
ANTES:
  static async getClinicId(): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();     // HTTP
    if (!userData.user) throw new Error("...");
    const { data: profile } = await supabase.from("profiles")...
    return profile.clinic_id;
  }

DEPOIS:
  static async getClinicId(): Promise<string> {
    const { clinicId } = await getAuthContext();                   // Local
    return clinicId;
  }
```

## O que NAO sera alterado

- `src/contexts/AuthContext.tsx` -- Fonte de verdade, permanece intacto
- `src/contexts/DataContext.tsx` -- Apenas os metodos individuais (addService, addSession, etc.), NAO a logica de inicializacao/onAuthStateChange que ja foi corrigida
- Ficheiros gerados automaticamente (.env, client.ts, types.ts)

## Resultado Esperado

- Eliminacao de ~25 chamadas HTTP redundantes por sessao de utilizador
- Cada operacao (criar sessao, adicionar credito, etc.) fica ~100-300ms mais rapida
- Codigo mais limpo e centralizado (padrao DRY)
- Zero alteracoes de comportamento visivel -- apenas mais rapido

