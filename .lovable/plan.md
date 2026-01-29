

# Plano: Aba de Permissões nas Configurações

## Objetivo

Criar uma nova aba "Permissões" dentro de Configurações que permite ao Admin Master:
1. Ver todos os utilizadores da clínica numa lista
2. Alterar o role de cada utilizador (Admin/Fisioterapeuta/Secretaria)
3. Ativar/desativar utilizadores
4. Consultar a matriz de permissões por role

---

## O que será criado

### 1. Nova Aba na Página de Configurações

Adicionar uma aba "Permissões" com ícone de escudo entre "Auditoria" e "Segurança" (que está desativada).

### 2. Novo Componente: PermissionsSettingsPanel

Uma interface visual com:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Permissões                                                     │
│  Gerencie os acessos dos membros da sua clínica                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Matriz de Permissões por Função                          │  │
│  │ [Admin Master] [Fisioterapeuta] [Secretaria]  (tabs)     │  │
│  │                                                           │  │
│  │  Módulo        │ Ver │ Editar │ Apagar │ Financeiro      │  │
│  │  Dashboard     │  ✓  │   ✓    │   ✓    │     ✓           │  │
│  │  Agenda        │  ✓  │   ✓    │   ✓    │     ✓           │  │
│  │  Pacientes     │  ✓  │   ✓    │   ✓    │     ✓           │  │
│  │  ...           │     │        │        │                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Utilizadores                                    [Buscar]  │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  👤 Leandro Magalhães    │ Admin Master      │ ✓ Ativo    │  │
│  │     leandroxmagalhaes@gmail.com               [Editar]    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  👤 Camila Maria Oliveira│ Fisioterapeuta    │ ✓ Ativo    │  │
│  │     te.camila@gmail.com                       [Editar]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alterações Necessárias

| Ficheiro | Ação | Descrição |
|----------|------|-----------|
| `src/pages/Configuracoes.tsx` | Modificar | Adicionar nova aba "Permissões" com ícone Lock |
| `src/components/settings/PermissionsSettingsPanel.tsx` | Criar | Novo painel com lista de utilizadores e matriz de permissões |
| `src/hooks/usePermissions.ts` | Modificar | Adicionar módulo 'permissoes' à lista |

---

## Detalhes Técnicos

### Ficheiro 1: Configuracoes.tsx

Adicionar o import e a nova aba:

```typescript
import { PermissionsSettingsPanel } from '@/components/settings/PermissionsSettingsPanel';
import { Lock } from 'lucide-react';

// Na TabsList, adicionar entre "auditoria" e "seguranca":
{isAdminMaster && (
  <TabsTrigger value="permissoes" className="gap-2">
    <Lock className="h-4 w-4 hidden sm:inline" />
    Permissões
  </TabsTrigger>
)}

// Adicionar TabsContent:
{isAdminMaster && (
  <TabsContent value="permissoes">
    <PermissionsSettingsPanel />
  </TabsContent>
)}
```

### Ficheiro 2: PermissionsSettingsPanel.tsx (novo)

Estrutura do componente:

```typescript
export function PermissionsSettingsPanel() {
  // 1. Buscar membros da equipe via TeamService.getTeamMembers()
  // 2. Mostrar matriz de permissões (reutilizar lógica do EditPermissionsModal)
  // 3. Lista de utilizadores com opção de editar role

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissões</CardTitle>
        <CardDescription>
          Gerencie os acessos dos membros da sua clínica
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Secção 1: Matriz de Permissões */}
        <PermissionMatrixViewer />
        
        {/* Secção 2: Lista de Utilizadores */}
        <UserPermissionsList 
          members={members}
          onEditMember={handleEditMember}
        />
      </CardContent>
    </Card>
  );
}
```

O componente irá:
- Reutilizar a matriz de permissões já definida em `EditPermissionsModal.tsx`
- Permitir alternar entre roles para ver as permissões de cada função
- Listar todos os membros com opção de editar via modal existente

---

## Fluxo de Utilização

```text
Admin acede a Configurações
        │
        ▼
Clica na aba "Permissões"
        │
        ▼
Vê a matriz de permissões por role
(pode alternar entre Admin/Fisio/Secretaria)
        │
        ▼
Vê lista de todos os utilizadores
        │
        ├──► Clica em "Editar" num utilizador
        │           │
        │           ▼
        │    Abre modal EditPermissionsModal
        │    (já existente)
        │           │
        │           ▼
        │    Altera role e/ou status
        │           │
        │           ▼
        │    Guarda alterações
        │
        ▼
Lista atualiza automaticamente
```

---

## Componentes Reutilizados

- `EditPermissionsModal` - já existe, abre para editar permissões individuais
- `TeamService` - já tem métodos para listar membros e atualizar roles
- Matriz de permissões `PERMISSION_MATRIX` - já definida no modal

---

## Resultado Final

O Admin Master terá acesso centralizado a:
- Visão geral das permissões de cada função
- Lista completa de utilizadores com seus roles atuais
- Ação rápida para editar permissões de qualquer utilizador

