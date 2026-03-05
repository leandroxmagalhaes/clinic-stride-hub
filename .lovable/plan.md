

# Corrigir erros de build + Executar migration de Packs

## Parte 1: Corrigir erros de build em DataContext.tsx

Dois erros de TypeScript causados pela ultima edicao do Financeiro.tsx que adicionou referencia a `avulso`:

**Erro 1** (linha 417): `Record<string, unknown>` nao e aceite pelo `.insert()` do Supabase.
- **Fix**: Cast `insertPayload as any` na chamada `.insert()`.

**Erro 2** (linha 443): `data.avulso` nao existe no tipo da tabela `sessoes`.
- **Fix**: Ja esta dentro de `as any` no bloco seguinte, mas precisa de acesso seguro: `(data as any).avulso ?? false`.

## Parte 2: Migration de Packs corrigida

O SQL do Claude tem varios problemas face ao schema real. Correcoes necessarias:

| Original (errado) | Corrigido |
|---|---|
| `REFERENCES clinicas(id)` | `REFERENCES clinics(id)` |
| `REFERENCES pacientes(id)` | `REFERENCES pacientes(id)` (ok) |
| RLS: `profiles.id = auth.uid()` | `profiles.user_id = auth.uid()` |
| `CHECK (payment_status IN (...))` | Validation trigger (best practice) |

A migration corrigida vai:
1. Criar tabela `packs` com FK para `clinics` e `pacientes`
2. Indices para `paciente_id`, `clinic_id`, `is_active`
3. Adicionar coluna `pack_id` na tabela `sessoes` (referencia opcional)
4. RLS usando `get_user_clinic_id(auth.uid())` (funcao ja existente no projecto)
5. Trigger auto-incremento `numero_pack` por paciente
6. Trigger `updated_at`
7. View `packs_com_contagem` com contagem de sessoes em tempo real

**Nota**: Nao usar CHECK constraints para `payment_status` -- usar validation trigger conforme boas praticas.

## Ordem de execucao

1. Corrigir os 2 erros de build em `DataContext.tsx`
2. Executar a migration SQL corrigida via ferramenta de migracao do Lovable

