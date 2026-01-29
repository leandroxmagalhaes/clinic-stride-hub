

# Plano: Corrigir Acesso da Fisioterapeuta e Melhorar Gestão de Permissões

## Problema Identificado

A Camila fez login mas:
- **Não tem `clinic_id`** associado ao seu perfil
- **Tem apenas o role `patient`** (atribuído automaticamente na criação da conta)
- **O convite continua "pending"** - nunca foi processado

Isto aconteceu porque ela já tinha uma conta quando tentou aceitar o convite. O sistema mostrou "email já registado" mas não processou o convite automaticamente ao fazer login.

## Solução em Duas Partes

### Parte 1: Correção Imediata (Processar Convite no Login)

Quando um utilizador faz login, verificar se há convites pendentes para o seu email e processá-los automaticamente.

**Ficheiro:** `src/pages/Login.tsx`

Após login bem-sucedido:
```typescript
// Verificar se há convites pendentes para este email
const { data: pendingInvite } = await supabase
  .from('team_invites')
  .select('*')
  .eq('email', email.toLowerCase())
  .eq('status', 'pending')
  .gt('expires_at', new Date().toISOString())
  .maybeSingle();

if (pendingInvite) {
  // Processar o convite
  const { data: result } = await supabase.rpc('process_team_invite', {
    invite_token: pendingInvite.token
  });
  
  if (result?.success) {
    toast.success('Convite aceito!', {
      description: `Você agora faz parte da clínica como ${pendingInvite.role}`
    });
  }
}
```

### Parte 2: Opção Manual no Painel de Equipe

Adicionar opção para o Admin Master ver utilizadores com convites pendentes que já têm conta, e atribuir-lhes acesso manualmente.

**Componente:** `src/components/settings/TeamSettingsPanel.tsx`

Adicionar nova secção na aba "Pendentes" para mostrar:
- Convites onde o email já tem conta registada
- Botão "Processar Manualmente" que:
  1. Associa o utilizador à clínica
  2. Atribui o role do convite
  3. Marca o convite como aceito

---

## Alterações Necessárias

| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Login.tsx` | Verificar e processar convites pendentes após login |
| `src/components/settings/TeamSettingsPanel.tsx` | Detectar convites com utilizador existente e permitir processamento manual |
| `src/services/TeamService.ts` | Novo método `processInviteForExistingUser` |

---

## Fluxo Corrigido

```text
Utilizador faz login
       │
       ▼
Sistema verifica convites pendentes para este email
       │
       ├──► Encontrou convite válido?
       │         │
       │         ▼ Sim
       │    Processa: atribui clinic_id + role
       │         │
       │         ▼
       │    Mostra toast: "Você foi adicionado à clínica X"
       │
       ▼ Não
Continua normalmente
```

---

## Detalhes Técnicos

### 1. Login.tsx - Processar Convite Após Login

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  const { error: signInError } = await signIn(email, password);

  if (signInError) {
    setIsLoading(false);
    setError(signInError.message);
    return;
  }

  // Verificar convites pendentes para este email
  try {
    const { data: pendingInvite } = await supabase
      .from('team_invites')
      .select('token, role')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      const { data: result } = await supabase.rpc('process_team_invite', {
        invite_token: pendingInvite.token
      });

      if (result?.success) {
        toast.success('Convite aceito automaticamente!', {
          description: 'Você agora tem acesso à clínica'
        });
      }
    }
  } catch (err) {
    console.error('Error processing pending invite:', err);
    // Não bloquear o login se o processamento do convite falhar
  }

  setIsLoading(false);
  toast.success('Login realizado com sucesso!');
  navigate(from, { replace: true });
};
```

### 2. TeamSettingsPanel - Detectar Convites com Utilizador Existente

Na lista de convites pendentes, verificar se o email já tem conta:

```typescript
// Para cada convite, verificar se utilizador existe
const { data: existingUser } = await supabase
  .from('profiles')
  .select('id, user_id, clinic_id')
  .eq('email', invite.email)
  .maybeSingle();

// Se existir mas não tiver clinic_id, mostrar botão "Adicionar à Clínica"
```

### 3. TeamService - Método para Processar Convite Manualmente

```typescript
static async processInviteManually(inviteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('process_team_invite_by_id', {
    p_invite_id: inviteId
  });

  if (error) {
    console.error('Error processing invite:', error);
    return false;
  }

  return data?.success ?? false;
}
```

---

## Interface Atualizada para Convites Pendentes

```text
┌─────────────────────────────────────────────────────────────┐
│ Convites Pendentes                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📧 Camila Maria Oliveira                                │ │
│ │    te.camila@gmail.com                                  │ │
│ │    🏷️ Fisioterapeuta                                    │ │
│ │                                                         │ │
│ │ ⚠️ Este utilizador já tem conta registada               │ │
│ │                                                         │ │
│ │    [ Adicionar à Clínica ]  [ Cancelar Convite ]        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Resumo das Entregas

| Item | Descrição |
|------|-----------|
| Processamento automático | Convites são processados automaticamente no login |
| Detecção de utilizador existente | Painel mostra quando convite tem utilizador já registado |
| Ação manual | Admin pode adicionar utilizador existente à clínica |
| Atribuição de role | Role do convite é aplicado ao utilizador |

---

## Benefícios

- Resolve imediatamente o problema da Camila
- Previne situações similares no futuro
- Admin tem controle total sobre quem entra na clínica
- Mantém a segurança do sistema de convites

