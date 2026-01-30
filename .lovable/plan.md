
# Implementar Funcionalidade do Botão Editar - Profissionais

## Problema Identificado

O botão "Editar" na página de Profissionais (linha 296) não possui nenhuma ação definida:

```tsx
<Button>Editar</Button>  // Sem onClick
```

Além disso, a função `updateProfessional` no DataContext apenas atualiza o estado local, mas não persiste as alterações no banco de dados.

---

## Solução

Reutilizar o modal existente de criação para também funcionar como modal de edição, seguindo o padrão já usado em outras partes do sistema.

---

## Implementação

### Modificar: `src/pages/Profissionais.tsx`

**1. Adicionar estado para controlar modo de edição:**

```typescript
const [isEditing, setIsEditing] = useState(false);
```

**2. Criar função para abrir modal em modo edição:**

```typescript
const handleEditClick = () => {
  if (!selectedProfessional) return;
  
  // Preenche o formulário com dados do profissional
  setFormData({
    full_name: selectedProfessional.full_name,
    email: selectedProfessional.email || "",
    phone: selectedProfessional.phone || "",
    role: selectedProfessional.role,
    specialty: selectedProfessional.specialty || "",
    crefito: selectedProfessional.crefito || "",
  });
  
  setIsEditing(true);
  setIsModalOpen(true);
  setSelectedProfessional(null); // Fecha modal de detalhes
};
```

**3. Criar função para atualizar profissional no banco:**

```typescript
const handleUpdateProfessional = async () => {
  if (!selectedProfessional) return;
  
  try {
    const { error } = await supabase
      .from("profissionais")
      .update({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || null,
        specialty: formData.specialty?.trim() || null,
        council_number: formData.crefito?.trim() || null,
      })
      .eq("id", selectedProfessional.id);

    if (error) throw error;

    // Atualizar estado local
    updateProfessional(selectedProfessional.id, {
      full_name: formData.full_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone?.trim() || null,
      specialty: formData.specialty?.trim() || null,
      crefito: formData.crefito?.trim() || null,
      role: formData.role,
    });

    toast.success("Profissional atualizado com sucesso!");
    setIsModalOpen(false);
    setIsEditing(false);
    resetForm();
  } catch (error) {
    toast.error("Erro ao atualizar profissional");
  }
};
```

**4. Atualizar o botão Editar com onClick:**

```tsx
<Button onClick={handleEditClick}>Editar</Button>
```

**5. Modificar o modal para suportar modo edição:**

- Título dinâmico: "Novo Profissional" / "Editar Profissional"
- Botão submit dinâmico: "Cadastrar" / "Salvar"
- Chamar função correta baseado no modo

**6. Atualizar resetForm e onClose:**

```typescript
const resetForm = () => {
  setFormData({
    full_name: "",
    email: "",
    phone: "",
    role: "fisioterapeuta",
    specialty: "",
    crefito: "",
  });
  setIsEditing(false);
};
```

---

## Fluxo do Usuário

```text
┌─────────────────────────────────────────────────────────┐
│  1. Usuário clica em card do profissional               │
│                     ↓                                   │
│  2. Abre modal de detalhes                              │
│                     ↓                                   │
│  3. Clica em "Editar"                                   │
│                     ↓                                   │
│  4. Modal de detalhes fecha                             │
│     Modal de edição abre com dados preenchidos          │
│                     ↓                                   │
│  5. Usuário altera campos desejados                     │
│                     ↓                                   │
│  6. Clica em "Salvar"                                   │
│                     ↓                                   │
│  7. Dados atualizados no Supabase                       │
│     Estado local atualizado                             │
│     Toast de sucesso                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Profissionais.tsx` | Adicionar estado, funções e onClick ao botão |

---

## Resumo Técnico

| Aspecto | Valor |
|---------|-------|
| Complexidade | Baixa |
| Arquivos modificados | 1 |
| Tempo estimado | 10 minutos |
| Risco | Baixo |
