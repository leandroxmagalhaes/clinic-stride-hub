
# Editar Dados do Paciente e Navegar para Prontuário

## Problemas Identificados

1. **Botão "Ver Prontuário"** na modal de detalhes não faz nada (linha 285 de `PatientDetailModal.tsx`)
2. **Não existe funcionalidade de editar** os dados cadastrais do paciente
3. **Página Prontuários** não recebe o parâmetro `?paciente=` da URL para pré-selecionar o paciente

---

## Solução Proposta

### 1. Criar Modal de Edição do Paciente

Um novo componente `EditPatientModal.tsx` que:
- Recebe os dados atuais do paciente
- Permite editar todos os campos (nome, CPF, telefone, email, etc.)
- Salva as alterações no banco de dados via Supabase
- Atualiza o estado local via `updatePatient` do DataContext

### 2. Adicionar Botão "Editar" na Modal de Detalhes

- Novo botão "Editar" com ícone de lápis na aba "Dados"
- Abre a modal de edição quando clicado

### 3. Corrigir Botão "Ver Prontuário"

- Adicionar navegação para `/prontuarios?paciente={patientId}`
- Fechar a modal de detalhes antes de navegar

### 4. Atualizar Página Prontuários

- Ler o parâmetro `paciente` da URL
- Auto-selecionar o paciente correspondente quando a página carrega

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/patients/EditPatientModal.tsx` | Modal com formulário de edição do paciente |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/patients/PatientDetailModal.tsx` | Adicionar botão "Editar", funcionalidade do "Ver Prontuário", e callback `onUpdatePatient` |
| `src/pages/Pacientes.tsx` | Passar `onUpdatePatient` e `onNavigateToProntuario` para o modal |
| `src/pages/Prontuarios.tsx` | Ler `?paciente=` da URL e pré-selecionar paciente |

---

## Detalhes Técnicos

### EditPatientModal.tsx

```typescript
interface EditPatientModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
  onSave: (patientId: string, data: Partial<Patient>) => Promise<void>;
}
```

Campos editáveis:
- Nome Completo*
- NIF / CPF
- Data de Nascimento
- Gênero
- Telefone*
- Email
- Morada
- Contato de Emergência
- Telefone de Emergência
- Seguradora / Entidade
- Observações

### PatientDetailModal.tsx

Novas props:
```typescript
onUpdatePatient?: (patientId: string, data: Partial<Patient>) => Promise<void>;
onNavigateToProntuario?: (patientId: string) => void;
```

Modificações:
1. Adicionar estado `isEditModalOpen`
2. Botão "Editar" na aba "Dados" que abre `EditPatientModal`
3. Botão "Ver Prontuário" chama `onNavigateToProntuario`

### Pacientes.tsx

Adicionar:
```typescript
const navigate = useNavigate();

const handleUpdatePatient = async (patientId: string, data: Partial<Patient>) => {
  const { error } = await supabase
    .from("pacientes")
    .update(data)
    .eq("id", patientId);
  
  if (error) throw error;
  
  updatePatient(patientId, data);
  // Atualizar selectedPatient para refletir mudanças
};

const handleNavigateToProntuario = (patientId: string) => {
  setSelectedPatient(null);
  navigate(`/prontuarios?paciente=${patientId}`);
};
```

### Prontuarios.tsx

Adicionar:
```typescript
import { useSearchParams } from "react-router-dom";

// Dentro do componente:
const [searchParams] = useSearchParams();

useEffect(() => {
  const pacienteId = searchParams.get("paciente");
  if (pacienteId && patients.length > 0 && !prontuariosLoading) {
    handleSelectPatient(pacienteId);
  }
}, [searchParams, patients, prontuariosLoading]);
```

---

## Fluxo do Utilizador

```text
1. Utilizador abre modal de detalhes do paciente
2. Na aba "Dados", clica em "Editar"
3. Modal de edição abre com dados pré-preenchidos
4. Utilizador altera dados e clica "Guardar"
5. Dados são salvos no Supabase
6. Modal de edição fecha, detalhes atualizados

OU

1. Utilizador abre modal de detalhes do paciente
2. Clica em "Ver Prontuário"
3. Modal fecha, navega para /prontuarios?paciente=xxx
4. Página Prontuários abre com paciente pré-selecionado
```

---

## Resumo de Complexidade

| Aspecto | Avaliação |
|---------|-----------|
| Complexidade | Média |
| Arquivos novos | 1 |
| Arquivos modificados | 3 |
| Risco | Baixo - usa padrões existentes |
