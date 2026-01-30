

# Implementar Permissões Personalizáveis por Utilizador

## Problema Atual

O sistema atual possui uma **matriz de permissões fixa** (hardcoded) baseada apenas na função (role):
- Admin → Acesso total
- Secretaria → Acesso sem financeiro
- Fisioterapeuta → Acesso restrito

O Admin Master **não pode** personalizar permissões individuais. A imagem mostra que a matriz é apenas de consulta (read-only).

---

## Solução Proposta

Criar um sistema de **permissões granulares por utilizador** que:
1. Mantém a função base como template inicial
2. Permite ao Admin Master **sobrescrever** permissões individuais
3. Salva as customizações no banco de dados

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE PERMISSÕES                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Utilizador tem função base (role)                       │
│           ↓                                                 │
│  2. Sistema busca permissões customizadas (user_permissions)│
│           ↓                                                 │
│  3. Se existir customização → usa ela                       │
│     Se não existir → usa template da função                 │
│           ↓                                                 │
│  4. Hook usePermissions aplica as regras                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Nova Tabela no Banco de Dados

### Tabela: `user_permissions`

```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  
  -- Permissões por módulo (JSONB para flexibilidade)
  permissions JSONB NOT NULL DEFAULT '{}',
  
  -- Exemplo de estrutura do JSONB:
  -- {
  --   "dashboard": { "view": true, "edit": true, "delete": false, "financial": false },
  --   "agenda": { "view": true, "edit": true, "delete": true, "financial": false },
  --   ...
  -- }
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, clinic_id)
);

-- Índices
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_clinic ON user_permissions(clinic_id);

-- RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/editar permissões
CREATE POLICY "Admins can manage user permissions" ON user_permissions
  USING (has_role(auth.uid(), 'admin') AND clinic_id = get_user_clinic_id(auth.uid()));

-- Usuário pode ver suas próprias permissões
CREATE POLICY "Users can view own permissions" ON user_permissions
  FOR SELECT USING (user_id = auth.uid());
```

---

## Fase 2: Atualizar EditPermissionsModal

### Mudanças no Modal

| Elemento Atual | Nova Versão |
|----------------|-------------|
| Tabela read-only com ícones | Tabela com checkboxes clicáveis |
| Permissões baseadas apenas na função | Permissões editáveis individualmente |
| Apenas seleção de função | Função + Customização granular |

### Nova Interface do Modal

```text
┌─────────────────────────────────────────────────────────────┐
│  Editar Permissões - João Silva                     [X]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FUNÇÃO BASE                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ○ Admin Master                                      │    │
│  │ ● Fisioterapeuta  ← Selecionado                     │    │
│  │ ○ Secretaria                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ──────────────────────────────────────────────────────     │
│                                                             │
│  PERMISSÕES PERSONALIZADAS                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Módulo      │ Ver │ Editar │ Apagar │ Financeiro   │    │
│  ├─────────────┼─────┼────────┼────────┼──────────────┤    │
│  │ Dashboard   │ [✓] │  [✓]   │  [ ]   │    [ ]       │    │
│  │ Agenda      │ [✓] │  [✓]   │  [✓]   │    [ ]       │    │
│  │ Pacientes   │ [✓] │  [✓]   │  [ ]   │    [ ]       │    │
│  │ Prontuários │ [✓] │  [✓]   │  [ ]   │    [ ]       │    │
│  │ Financeiro  │ [ ] │  [ ]   │  [ ]   │    [ ]       │    │
│  │ ...         │     │        │        │              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [ ] Restaurar para padrão da função                        │
│                                                             │
│  ──────────────────────────────────────────────────────     │
│                                                             │
│  STATUS                                                     │
│  [===] Ativo / Inativo                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                          [Cancelar]  [Guardar]              │
└─────────────────────────────────────────────────────────────┘
```

---

## Fase 3: Atualizar usePermissions Hook

### Lógica Nova

```typescript
// Pseudocódigo do hook atualizado
function usePermissions() {
  const { roles } = useUserRole();
  const [customPermissions, setCustomPermissions] = useState(null);
  
  useEffect(() => {
    // Buscar permissões customizadas do banco
    fetchUserPermissions();
  }, []);
  
  const getModulePermissions = (module) => {
    // 1. Verificar se tem customização
    if (customPermissions?.[module]) {
      return customPermissions[module];
    }
    
    // 2. Fallback para template da função
    return getDefaultPermissionsForRole(roles[0], module);
  };
}
```

---

## Fase 4: Criar UserPermissionService

### Novo Serviço: `src/services/UserPermissionService.ts`

```typescript
interface ModulePermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
  financial: boolean;
}

interface UserPermissions {
  [module: string]: ModulePermission;
}

class UserPermissionService {
  // Buscar permissões de um utilizador
  static async getUserPermissions(userId: string): Promise<UserPermissions | null>;
  
  // Salvar/atualizar permissões customizadas
  static async saveUserPermissions(
    userId: string, 
    permissions: UserPermissions
  ): Promise<boolean>;
  
  // Resetar para padrão da função
  static async resetToRoleDefaults(userId: string): Promise<boolean>;
  
  // Buscar permissões do utilizador atual
  static async getCurrentUserPermissions(): Promise<UserPermissions | null>;
}
```

---

## Fase 5: Atualizar Matriz de Permissões

### Nova Versão do PermissionsSettingsPanel

A matriz na aba "Admin Master", "Fisioterapeuta", "Secretaria" continua como **referência** (template), mas agora com nota explicativa:

```text
"Esta é a matriz padrão para a função. 
Permissões individuais podem ser customizadas na lista de utilizadores abaixo."
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `migrations/*.sql` | Criar | Tabela user_permissions |
| `src/services/UserPermissionService.ts` | Criar | CRUD de permissões |
| `src/components/settings/EditPermissionsModal.tsx` | Modificar | Checkboxes editáveis |
| `src/hooks/usePermissions.ts` | Modificar | Buscar permissões do banco |
| `src/services/TeamService.ts` | Modificar | Incluir save de permissões |

---

## Resumo Técnico

| Aspecto | Detalhes |
|---------|----------|
| Nova tabela | `user_permissions` com JSONB |
| Segurança | RLS: Admin pode editar, usuário pode ver própria |
| Fallback | Se não tiver customização, usa template da função |
| UI | Checkboxes clicáveis no modal de edição |
| Complexidade | Média |
| Tempo estimado | ~1.5 horas |

---

## Comportamento Esperado

1. Admin clica em "Editar" no utilizador
2. Modal abre com função atual selecionada
3. Tabela de permissões mostra checkboxes
4. Checkboxes refletem permissões atuais (customizadas ou padrão)
5. Admin pode marcar/desmarcar qualquer permissão
6. Ao salvar, permissões customizadas são gravadas no banco
7. Utilizador passa a ter permissões personalizadas
8. Opção de "Restaurar padrão" limpa customizações

