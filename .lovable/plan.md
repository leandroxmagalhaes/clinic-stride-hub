
# Plano de Implementação - Importação de Pacientes em Lote

Funcionalidade para importar múltiplos pacientes através de ficheiro Excel (.xlsx) ou CSV, com **Nome** e **NIF** como campos obrigatórios.

---

## Regras de Validação

| Campo | Obrigatório | Validação |
|-------|-------------|-----------|
| nome | Sim | Mínimo 3 caracteres |
| nif | Sim | Presente e não vazio |
| telefone | Não | Se preenchido, mínimo 9 dígitos |
| email | Não | Se preenchido, formato válido |
| nascimento | Não | Se preenchido, formato DD/MM/AAAA |
| genero | Não | M, F ou O |
| morada | Não | Texto livre |
| contato_emergencia | Não | Texto livre |
| telefone_emergencia | Não | Texto livre |
| seguradora | Não | Texto livre |
| observacoes | Não | Texto livre |

Campos não preenchidos são importados como `null`.

---

## Fluxo do Utilizador

1. Página Pacientes → botão "Importar Planilha"
2. Modal abre com zona de upload
3. Arrastar ficheiro ou clicar para selecionar
4. Sistema valida e mostra pré-visualização
5. Linhas válidas em verde, inválidas em vermelho com motivo
6. Confirmar importação
7. Relatório final com sucessos e erros

---

## Ficheiros a Criar

### 1. Serviço de Importação
**`src/services/PatientImportService.ts`**

Responsabilidades:
- Parsear ficheiros .xlsx e .csv com SheetJS
- Validar cada linha (nome + NIF obrigatórios)
- Mapear colunas da planilha para campos do banco
- Gerar template de exemplo para download
- Executar inserção em lote no Supabase

### 2. Modal de Importação
**`src/components/patients/ImportPatientsModal.tsx`**

Componentes:
- Zona de drag & drop para upload
- Botão para descarregar template
- Tabela de pré-visualização com status por linha
- Contadores de válidos/inválidos
- Botão de confirmação
- Toast com resultado final

---

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Pacientes.tsx` | Adicionar botão "Importar" e integrar modal |
| `package.json` | Adicionar dependência `xlsx` |

---

## Dependência a Instalar

**xlsx (SheetJS)** - Biblioteca para leitura de Excel/CSV no navegador
- Suporta .xlsx, .xls, .csv
- Processamento 100% client-side
- Sem necessidade de backend adicional

---

## Template de Planilha

Ficheiro .xlsx pré-formatado com:
- Cabeçalhos: nome, nif, telefone, email, nascimento, genero, morada, contato_emergencia, telefone_emergencia, seguradora, observacoes
- Linha de exemplo preenchida
- Nome e NIF destacados como obrigatórios

---

## Interface do Modal

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Importar Pacientes                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │     📁 Arraste o ficheiro aqui ou clique para            │  │
│  │        selecionar (.xlsx ou .csv)                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📥 Descarregar modelo de planilha                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Pré-visualização:                                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ # │ Nome          │ NIF        │ Telefone    │ Status      ││
│  │ 1 │ João Silva    │ 123456789  │ +351912...  │ ✅ Válido   ││
│  │ 2 │ Maria Santos  │ 987654321  │             │ ✅ Válido   ││
│  │ 3 │ Pedro         │            │ 123         │ ❌ NIF vazio││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ✅ 2 válidos   ❌ 1 com erros                                 │
│                                                                 │
│  [Cancelar]                              [Importar 2 pacientes] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Secção Técnica

### Estrutura do Serviço

```typescript
interface ImportRow {
  nome: string;
  nif: string;
  telefone?: string;
  email?: string;
  nascimento?: string;
  genero?: string;
  morada?: string;
  contato_emergencia?: string;
  telefone_emergencia?: string;
  seguradora?: string;
  observacoes?: string;
}

interface ValidationResult {
  row: number;
  valid: boolean;
  errors: string[];
  data?: CreatePatientData;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}
```

### Validação Principal

```typescript
static validateRow(row: ImportRow, rowNumber: number): ValidationResult {
  const errors: string[] = [];
  
  // Campos obrigatórios
  if (!row.nome || row.nome.trim().length < 3) {
    errors.push("Nome deve ter pelo menos 3 caracteres");
  }
  if (!row.nif || row.nif.trim() === '') {
    errors.push("NIF é obrigatório");
  }
  
  // Campos opcionais com validação condicional
  if (row.telefone && row.telefone.replace(/\D/g, '').length < 9) {
    errors.push("Telefone inválido");
  }
  if (row.email && !isValidEmail(row.email)) {
    errors.push("Email inválido");
  }
  
  return {
    row: rowNumber,
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? mapToPatientData(row) : undefined
  };
}
```

### Inserção em Lote

```typescript
const { data, error } = await supabase
  .from('pacientes')
  .insert(validPatients.map(p => ({
    clinic_id: clinicId,
    full_name: p.nome,
    cpf: p.nif,  // NIF vai para o campo cpf
    phone: p.telefone || null,
    email: p.email || null,
    birth_date: p.nascimento ? parseDate(p.nascimento) : null,
    gender: p.genero || null,
    address: p.morada || null,
    emergency_contact: p.contato_emergencia || null,
    emergency_phone: p.telefone_emergencia || null,
    health_insurance: p.seguradora || null,
    notes: p.observacoes || null,
    privacy_consent_at: new Date().toISOString(),
    is_active: true
  })))
  .select();
```

---

## Ordem de Implementação

1. Instalar dependência `xlsx`
2. Criar `PatientImportService.ts`
3. Criar `ImportPatientsModal.tsx`
4. Integrar em `Pacientes.tsx`
5. Testar com ficheiro de exemplo
