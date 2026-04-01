

## Multi-Perfil (Múltiplos Filhos) + Separação de Roles

This feature adds N:N account-patient linking, profile selection (Netflix-style), dual-role support, and login flow separation. It touches database schema, 3 existing pages, and creates 1 new component.

---

### Step 1: Database Migration

Single migration with:

1. **Create `portal_conta_pacientes`** table (id, conta_id, paciente_id, relacao, is_primary, created_at) with UNIQUE(conta_id, paciente_id) and open RLS.

2. **Migrate existing data**: INSERT INTO `portal_conta_pacientes` from `portal_contas` WHERE `paciente_id IS NOT NULL`.

3. **Add `portal_role`** column to `profiles