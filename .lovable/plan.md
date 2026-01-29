
# Plano: Sistema de Acesso Exclusivo por Convite + Editor de Permissões

## Problema Atual

1. **Cadastro aberto**: Qualquer pessoa pode acessar `/signup` e criar uma conta, mesmo sem convite
2. **Edição de permissões limitada**: O menu dropdown do TeamMemberCard permite alterar funções, mas não há um modal dedicado com visão clara das permissões

---

## Solução Proposta

### Parte 1: Bloquear Cadastro Sem Convite

Modificar a página de Signup para:
- **Exigir token de convite** na URL (`/signup?invite=TOKEN`)
- **Mostrar mensagem de acesso negado** se acessar sem token
- **Remover link "Cadastre-se"** da página de Login
- **Manter o link para Login** na página de Signup (para quem já tem conta)

### Parte 2: Modal de Edição de Permissões

Criar um modal dedicado para editar permissões de cada utilizador, acessível pelo Admin Master:
- **Lista visual de todas as permissões** por módulo
- **Seleção clara da função** (Admin, Fisioterapeuta, Secretaria)
- **Preview das permissões** baseado na função selecionada

---

## Fluxo de Acesso

```text
Página de Login
      │
      ├── Tem conta? → Login normal
      │
      └── Não tem conta? → Precisa de convite do Admin
                                │
                                ▼
                   Admin envia convite por email
                                │
                                ▼
                   Convidado recebe link /signup?invite=TOKEN
                                │
                                ▼
                   Cria conta e é associado à clínica
```

---

## Alterações Necessárias

### 1. Modificar Signup.tsx

| Antes | Depois |
|-------|--------|
| Permite acesso sem token | Bloqueia acesso sem token |
| Mostra formulário sempre | Mostra mensagem "Acesso por convite apenas" |

### 2. Modificar Login.tsx

| Antes | Depois |
|-------|--------|
| Link "Cadastre-se" visível | Link removido ou oculto |
| - | Texto: "Para criar conta, solicite um convite" |

### 3. Criar EditPermissionsModal.tsx

Novo componente com:
- Seletor de função (Radio Group)
- Tabela de permissões por módulo (readonly, informativo)
- Opção de ativar/desativar utilizador
- Botões Cancelar/Guardar

### 4. Atualizar TeamMemberCard.tsx

- Substituir dropdown por botão "Editar Permissões"
- Abrir modal ao clicar

---

## Ficheiros a Criar

| Ficheiro | Propósito |
|----------|-----------|
| `src/components/settings/EditPermissionsModal.tsx` | Modal para editar funções e ver permissões |

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Signup.tsx` | Bloquear acesso sem token de convite |
| `src/pages/Login.tsx` | Remover link de cadastro, adicionar texto informativo |
| `src/components/settings/TeamMemberCard.tsx` | Usar botão para abrir modal de permissões |
| `src/components/settings/TeamSettingsPanel.tsx` | Integrar o novo modal |

---

## Experiência do Utilizador

### Acesso Sem Convite

Ao acessar `/signup` diretamente:

```text
┌────────────────────────────────────────┐
│                                        │
│          🔒 Acesso Restrito            │
│                                        │
│   O cadastro neste sistema é feito     │
│   exclusivamente através de convite.   │
│                                        │
│   Solicite um convite ao administrador │
│   da sua clínica.                      │
│                                        │
│        [ Ir para Login ]               │
│                                        │
└────────────────────────────────────────┘
```

### Página de Login (Atualizada)

```text
┌────────────────────────────────────────┐
│           PhysioNE                     │
│                                        │
│   Email: [___________________]         │
│   Senha: [___________________]         │
│                                        │
│        [ Entrar ]                      │
│                                        │
│   ────────────────────────────────     │
│   Para criar uma conta, solicite       │
│   um convite ao administrador.         │
│                                        │
└────────────────────────────────────────┘
```

### Modal de Edição de Permissões

```text
┌──────────────────────────────────────────────────────────┐
│  Editar Permissões - João Silva                      [X] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  FUNÇÃO                                                  │
│  ○ Admin Master - Acesso total ao sistema               │
│  ● Fisioterapeuta - Vê apenas seus pacientes e sessões  │
│  ○ Secretaria - Acesso admin sem financeiro completo    │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  PERMISSÕES (baseado na função selecionada)             │
│                                                          │
│  │ Módulo       │ Ver │ Editar │ Apagar │ Financeiro │  │
│  │──────────────│─────│────────│────────│────────────│  │
│  │ Dashboard    │ ✓   │ ✓      │ ✗      │ ✗          │  │
│  │ Agenda       │ ✓   │ ✓      │ ✗      │ ✗          │  │
│  │ Pacientes    │ ✓*  │ ✓*     │ ✗      │ ✗          │  │
│  │ Prontuários  │ ✓*  │ ✓*     │ ✗      │ ✗          │  │
│  │ Profissionais│ ✗   │ ✗      │ ✗      │ ✗          │  │
│  │ Financeiro   │ ✗   │ ✗      │ ✗      │ ✗          │  │
│  │ Comercial    │ ✗   │ ✗      │ ✗      │ ✗          │  │
│  │ Configurações│ ✗   │ ✗      │ ✗      │ ✗          │  │
│                                                          │
│  * Apenas pacientes/sessões atribuídos                   │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  STATUS DO UTILIZADOR                                    │
│  [═══════●] Ativo                                        │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                          [ Cancelar ]  [ Guardar ]       │
└──────────────────────────────────────────────────────────┘
```

---

## Secção Técnica

### Signup.tsx - Bloquear Acesso

```typescript
// Se não há token de convite, mostrar mensagem de acesso restrito
if (!inviteToken) {
  return (
    <Card>
      <CardHeader>
        <Lock className="h-8 w-8 text-primary" />
        <CardTitle>Acesso Restrito</CardTitle>
        <CardDescription>
          O cadastro neste sistema é feito exclusivamente através de convite.
          Solicite um convite ao administrador da sua clínica.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Link to="/login">
          <Button variant="outline">Ir para Login</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
```

### Login.tsx - Remover Cadastro

```typescript
// Antes
<p>
  Não tem uma conta?{' '}
  <Link to="/signup">Cadastre-se</Link>
</p>

// Depois
<p className="text-muted-foreground text-center text-sm">
  Para criar uma conta, solicite um convite ao administrador.
</p>
```

### EditPermissionsModal.tsx - Estrutura

```typescript
interface EditPermissionsModalProps {
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, roles: AppRole[], isActive: boolean) => Promise<void>;
}

// Componente usa:
// - RadioGroup para seleção de função
// - Tabela de permissões (readonly) calculada a partir da função
// - Switch para status ativo/inativo
// - Botões de ação
```

### Tabela de Permissões por Função

```typescript
const PERMISSION_MATRIX = {
  admin: {
    dashboard: { view: true, edit: true, delete: true, financial: true },
    agenda: { view: true, edit: true, delete: true, financial: true },
    // ... todos os módulos com acesso total
  },
  professional: {
    dashboard: { view: true, edit: true, delete: false, financial: false },
    pacientes: { view: 'own', edit: 'own', delete: false, financial: false },
    // ... acesso restrito
  },
  secretary: {
    dashboard: { view: true, edit: true, delete: true, financial: false },
    // ... acesso sem financeiro
  },
};
```

---

## Resumo das Entregas

| Item | Descrição |
|------|-----------|
| Signup bloqueado | Acesso apenas com token de convite válido |
| Login atualizado | Sem link de cadastro, com texto informativo |
| Modal de permissões | Interface clara para editar funções e ver permissões |
| Segurança reforçada | Apenas admin master pode enviar convites e editar permissões |
