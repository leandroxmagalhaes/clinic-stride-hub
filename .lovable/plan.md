
# Correção: Erro ao Criar Agendamentos

## Problema Identificado

O sistema está dando erro ao criar agendamentos porque existe uma **incompatibilidade de IDs** entre tabelas:

- A tabela `sessoes` tem uma **FK para `profiles.id`**:
  ```sql
  sessoes_profissional_id_fkey → FOREIGN KEY (profissional_id) REFERENCES profiles(id)
  ```

- Mas o frontend busca profissionais da tabela **`profissionais`** (que tem IDs diferentes):
  | Tabela | ID da Camila |
  |--------|--------------|
  | `profiles` | `3ef68f68-0864-4635-846c-269e10ebe49d` |
  | `profissionais` | `e159f8b3-4b5f-48ef-a421-7c4d8b0dacee` |

Quando você seleciona a Camila como profissional, o sistema envia o ID da tabela errada, causando violação de FK.

---

## Solução

Alterar o `fetchProfessionals()` no `DataContext.tsx` para buscar dados da tabela **`profiles`** (onde a FK aponta), filtrando por utilizadores ativos da clínica com roles de profissional.

---

## Alteração

### Ficheiro: `src/contexts/DataContext.tsx`

**Antes (linhas 172-206):**
```typescript
const fetchProfessionals = async () => {
  const { data, error } = await supabase
    .from("profissionais")  // ❌ Tabela errada!
    .select("*")
    .eq("is_active", true)
    .order("full_name");
  // ...
};
```

**Depois:**
```typescript
const fetchProfessionals = async () => {
  setProfessionalsLoading(true);
  try {
    // Buscar da tabela profiles (onde a FK de sessoes aponta)
    // Filtrar por utilizadores ativos que são profissionais
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        phone,
        role,
        specialty,
        crefito,
        avatar_url,
        is_active,
        clinic_id
      `)
      .eq("is_active", true)
      .in("role", ['fisioterapeuta', 'admin', 'professional'])
      .order("full_name");

    if (error) {
      console.error("Error fetching professionals:", error);
      return;
    }

    // Map to Professional interface
    const transformed: Professional[] = (data || []).map((p: any) => ({
      id: p.id,  // Este é o ID correto para a FK!
      clinic_id: p.clinic_id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      specialty: p.specialty,
      crefito: p.crefito,
      avatar_url: p.avatar_url,
      is_active: p.is_active,
    }));

    setProfessionals(transformed);
  } catch (err) {
    console.error("Exception fetching professionals:", err);
  } finally {
    setProfessionalsLoading(false);
  }
};
```

---

## Fluxo Corrigido

```text
Modal de Novo Agendamento
        │
        ▼
Lista profissionais da tabela 'profiles'
(ID: 3ef68f68-..., ex: Camila)
        │
        ▼
Utilizador seleciona profissional
        │
        ▼
INSERT em 'sessoes' com profissional_id = profiles.id ✓
        │
        ▼
FK validation passa ✓
        │
        ▼
Agendamento criado com sucesso! ✓
```

---

## Resumo

| Item | Descrição |
|------|-----------|
| Causa | Busca de profissionais da tabela errada (`profissionais` vs `profiles`) |
| Solução | Alterar `fetchProfessionals()` para buscar de `profiles` |
| Impacto | Agendamentos passam a funcionar corretamente |
| Risco | Baixo - apenas muda a fonte dos dados |

---

## Verificação Após Implementação

1. Tentar criar um novo agendamento
2. Verificar se a sessão persiste na base de dados
3. Fazer logout e login para confirmar que os dados permanecem
