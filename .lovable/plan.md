
# Plano de Implementação - Extrato do Paciente

Funcionalidade para gerar e descarregar um extrato completo de cada paciente, incluindo todo o histórico de agendamentos, consultas e pagamentos.

---

## O que será incluído no Extrato

| Categoria | Dados |
|-----------|-------|
| **Agendamentos** | Sessões agendadas (data, hora, profissional, serviço) |
| **Confirmações** | Sessões confirmadas |
| **Remarcações** | Sessões que mudaram de horário |
| **Cancelamentos** | Sessões canceladas (com motivo, se disponível) |
| **Faltas** | Sessões marcadas como falta |
| **Finalizadas** | Consultas realizadas com sucesso |
| **Pagamentos** | Compras de créditos (valor, método, status) |
| **Uso de Créditos** | Débitos e reembolsos |

---

## Fluxo do Utilizador

1. Abrir o modal de detalhes de um paciente
2. Clicar no botão "Descarregar Extrato"
3. Sistema gera ficheiro CSV com todo o histórico
4. Download automático do ficheiro

---

## Ficheiros a Criar

### 1. Serviço de Geração de Extrato
**`src/services/PatientStatementService.ts`**

Responsabilidades:
- Buscar todas as sessões do paciente (qualquer status)
- Buscar todas as transações de crédito do paciente
- Combinar e ordenar por data
- Gerar CSV formatado para download

### 2. Componente de Botão de Extrato
**`src/components/patients/PatientStatementButton.tsx`**

Componente leve que:
- Mostra botão "Descarregar Extrato"
- Gerencia estado de loading
- Dispara geração e download

---

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/components/patients/PatientDetailModal.tsx` | Adicionar botão de extrato no footer |

---

## Formato do Extrato (CSV)

```csv
Data,Hora,Tipo,Descrição,Profissional,Serviço,Créditos,Valor
15/01/2025,10:00,Agendamento,Sessão agendada,Dr. Silva,Fisioterapia,,
15/01/2025,10:00,Confirmação,Sessão confirmada,Dr. Silva,Fisioterapia,,
15/01/2025,11:00,Consulta Finalizada,Sessão realizada,Dr. Silva,Fisioterapia,-1,
12/01/2025,14:30,Compra de Créditos,Pack de 10 sessões,,,+10,€1.200,00
10/01/2025,09:00,Cancelamento,Cancelado pelo paciente,Dr. Silva,Pilates,,
08/01/2025,15:00,Falta,Paciente não compareceu,Dra. Santos,RPG,-1,
```

---

## Dados das Sessões

Para cada sessão, buscar:
- `id`, `start_time`, `end_time`
- `status`: agendado, confirmado, em_atendimento, finalizado, realizado, cancelado, faltou, falta
- `profissional_id` → Nome do profissional
- `servico_id` → Nome do serviço
- `notes` (motivo de cancelamento, se houver)
- `payment_method`, `payment_status`, `price`

---

## Dados das Transações de Crédito

Para cada transação, buscar:
- `created_at`
- `transaction_type`: purchase, usage, refund, adjustment
- `amount` (positivo = entrada, negativo = saída)
- `monetary_value` (valor em €)
- `payment_method`, `payment_status`
- `description`

---

## Interface do Botão

Localização: Footer do `PatientDetailModal`, junto aos botões existentes.

```text
┌─────────────────────────────────────────────────────────────────┐
│  [📧 Enviar Link do Portal]    [📥 Extrato]   [Fechar] [Ver Prontuário] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Secção Técnica

### Estrutura do Serviço

```typescript
// src/services/PatientStatementService.ts

interface StatementLine {
  date: Date;
  time: string;
  type: string;
  description: string;
  professional: string | null;
  service: string | null;
  credits: number | null;
  monetaryValue: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
}

export class PatientStatementService {
  static async generateStatement(patientId: string): Promise<StatementLine[]>;
  static formatAsCSV(lines: StatementLine[]): string;
  static downloadCSV(csv: string, patientName: string): void;
}
```

### Busca de Sessões

```typescript
const { data: sessions } = await supabase
  .from('sessoes')
  .select(`
    id, start_time, end_time, status, notes, price,
    payment_method, payment_status,
    profissional:profiles!profissional_id(full_name),
    servico:servicos!servico_id(name)
  `)
  .eq('paciente_id', patientId)
  .order('start_time', { ascending: false });
```

### Busca de Transações

```typescript
const { data: transactions } = await supabase
  .from('credit_transactions')
  .select('*')
  .eq('patient_id', patientId)
  .order('created_at', { ascending: false });
```

### Mapeamento de Status para Tipo

```typescript
const STATUS_LABELS: Record<string, string> = {
  'agendado': 'Agendamento',
  'confirmado': 'Confirmação',
  'em_atendimento': 'Em Atendimento',
  'finalizado': 'Consulta Finalizada',
  'realizado': 'Consulta Realizada',
  'cancelado': 'Cancelamento',
  'faltou': 'Falta',
  'falta': 'Falta',
};

const TRANSACTION_LABELS: Record<string, string> = {
  'purchase': 'Compra de Créditos',
  'usage': 'Uso de Crédito',
  'refund': 'Reembolso',
  'adjustment': 'Ajuste de Créditos',
};
```

### Geração do CSV

```typescript
static formatAsCSV(lines: StatementLine[]): string {
  const headers = [
    'Data', 'Hora', 'Tipo', 'Descrição', 
    'Profissional', 'Serviço', 'Créditos', 'Valor (€)'
  ];
  
  const rows = lines.map(line => [
    format(line.date, 'dd/MM/yyyy'),
    line.time,
    line.type,
    line.description,
    line.professional || '',
    line.service || '',
    line.credits ? String(line.credits) : '',
    line.monetaryValue ? line.monetaryValue.toFixed(2).replace('.', ',') : '',
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}
```

### Download do Ficheiro

```typescript
static downloadCSV(csv: string, patientName: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
  const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
  
  link.href = url;
  link.download = `extrato_${safeName}_${timestamp}.csv`;
  link.click();
  
  URL.revokeObjectURL(url);
}
```

---

## Resumo de Novos Ficheiros

| Ficheiro | Propósito |
|----------|-----------|
| `src/services/PatientStatementService.ts` | Lógica de busca, formatação e download |
| `src/components/patients/PatientStatementButton.tsx` | Botão com loading state |

---

## Ordem de Implementação

1. Criar `PatientStatementService.ts` com lógica de busca e formatação
2. Criar `PatientStatementButton.tsx` com UI do botão
3. Integrar botão no `PatientDetailModal.tsx`
4. Testar com paciente que tenha histórico variado
