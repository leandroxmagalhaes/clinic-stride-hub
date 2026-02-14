
# Preservar Estado dos Formularios ao Mudar de Aba

## Problema

Quando muda de aba no navegador e volta, os formularios (novo paciente, agendamento) fecham e os dados preenchidos sao perdidos. Isto acontece porque o sistema de autenticacao dispara uma atualizacao de estado ao regressar a aba, o que provoca um re-render em cascata que remonta os componentes das paginas, resetando todo o estado local (modais abertos, campos preenchidos).

## Solucao

Estabilizar o hook de autenticacao para evitar re-renders desnecessarios quando o utilizador nao mudou. Isto resolve o problema na raiz, sem necessidade de rascunhos ou persistencia extra.

## Detalhes Tecnicos

### 1. Estabilizar `useAuth` (`src/hooks/useAuth.tsx`)

O `onAuthStateChange` do sistema de autenticacao dispara eventos (como `TOKEN_REFRESHED`) ao regressar a uma aba, criando novos objetos de estado mesmo quando o utilizador e o mesmo. Isto causa re-renders desnecessarios em toda a arvore de componentes.

**Correcao:** Comparar o ID do utilizador antes de atualizar o estado. So atualizar quando houve uma mudanca real (login, logout, troca de utilizador).

```typescript
supabase.auth.onAuthStateChange((_event, session) => {
  setAuthState(prev => {
    const newUserId = session?.user?.id ?? null;
    const prevUserId = prev.user?.id ?? null;
    // Evitar re-render se o utilizador nao mudou
    if (newUserId === prevUserId && !prev.loading) {
      return prev;
    }
    return {
      user: session?.user ?? null,
      session,
      loading: false,
    };
  });
});
```

### 2. Estabilizar `DataContext` (`src/contexts/DataContext.tsx`)

Garantir que o listener de autenticacao dentro do DataProvider tambem nao dispara re-fetches desnecessarios ao mudar de aba. Adicionar verificacao similar para so re-carregar dados quando o utilizador realmente muda.

### Resultado

- Mudar de aba e voltar **nao fecha** modais nem perde dados de formularios
- O comportamento de login/logout continua a funcionar normalmente
- Nenhuma alteracao visual ou funcional para o utilizador
- Solucao na raiz do problema, sem necessidade de "rascunhos" ou persistencia em localStorage
