

# Correção: Utilizador Já Registado no Signup com Convite

## Problema

Quando um utilizador com email já existente tenta aceitar um convite, o erro "User already registered" aparece de forma técnica, sem orientação clara.

## Solução

Melhorar o tratamento de erro em `handleSubmit` para:
1. **Detectar** o erro "User already registered"
2. **Mostrar mensagem amigável** explicando que o email já existe
3. **Oferecer ação direta** para fazer login

## Alteração Necessária

### Ficheiro: `src/pages/Signup.tsx`

Modificar o bloco de tratamento de erro (linhas 102-108):

**Antes:**
```typescript
if (error) {
  setIsLoading(false);
  toast.error('Erro ao criar conta', {
    description: error.message,
  });
  return;
}
```

**Depois:**
```typescript
if (error) {
  setIsLoading(false);
  
  // Detectar se o utilizador já existe
  if (error.message?.toLowerCase().includes('already registered') || 
      error.message?.toLowerCase().includes('user already registered')) {
    toast.error('Este email já está registado', {
      description: 'Faça login com a sua conta existente e o convite será processado automaticamente.',
      action: {
        label: 'Ir para Login',
        onClick: () => navigate('/login'),
      },
    });
    return;
  }
  
  toast.error('Erro ao criar conta', {
    description: error.message,
  });
  return;
}
```

## Resultado Esperado

Quando o utilizador tentar criar conta com email já existente:
- Verá: "Este email já está registado"
- Descrição: "Faça login com a sua conta existente..."
- Botão: "Ir para Login" que redireciona para `/login`

## Ficheiro a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Signup.tsx` | Melhor tratamento do erro "already registered" com mensagem amigável e ação de redirecionamento |

