
# Plano de Implementação - Exclusão com Auditoria

Funcionalidade para apagar clientes, agendamentos, serviços e profissionais, com registo completo de todas as ações para rastreabilidade.

---

## Resumo

Implementar sistema de exclusão (soft delete) com log de auditoria que regista:
- Quem fez a ação (utilizador)
- Quando foi feita (timestamp)
- O que foi afetado (entidade + ID)
- Detalhes da ação (dados antes da exclusão)

---

## Tabela de Auditoria (Nova)

### `audit_logs`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | ID único do registo |
| `clinic_id` | uuid | Clínica associada |
| `user_id` | uuid | Utilizador que executou a ação |
| `user_email` | text | Email do utilizador (para referência fácil) |
| `action` | text | Tipo: create, update, delete, cancel, etc. |
| `entity_type` | text | Tipo: patient, session, service, professional |
| `entity_id` | uuid | ID da entidade afetada |
| `entity_name` | text | Nome/descrição para referência rápida |
| `details` | jsonb | Dados adicionais (estado anterior, motivo) |
| `created_at` | timestamp | Data/hora da ação |

---

## Funcionalidades por Entidade

### 1. Pacientes (Clientes)

| Ação | Comportamento |
|------|---------------|
| Apagar | Soft delete (`is_active = false`) |
| Auditoria | Regista nome, NIF, email antes de desativar |
| Validação | Alerta se tiver agendamentos futuros |

### 2. Agendamentos (Sessões)

| Ação | Comportamento |
|------|---------------|
| Apagar | Delete efetivo (remove da tabela) |
| Auditoria | Regista paciente, profissional, data, status |
| Validação | Sessões finalizadas não podem ser apagadas |

### 3. Serviços

| Ação | Comportamento |
|------|---------------|
| Apagar | Soft delete (`is_active = false`) - já implementado |
| Auditoria | Regista nome, preço, duração |

### 4. Profissionais

| Ação | Comportamento |
|------|---------------|
| Apagar | Soft delete (`is_active = false`) |
| Auditoria | Regista nome, email, especialidade |
| Validação | Alerta se tiver agendamentos futuros |

---

## Interface do Utilizador

### Botão de Apagar

Cada card/linha terá um botão de exclusão com confirmação:

```text
┌────────────────────────────────────────────────────────────┐
│                    Apagar Paciente?                        │
├────────────────────────────────────────────────────────────┤
│  Esta ação irá desativar o paciente "João Silva".          │
│                                                            │
│  O paciente não aparecerá mais nas listagens, mas          │
│  os dados serão mantidos para histórico.                   │
│                                                            │
│  ⚠️ Este paciente tem 2 agendamentos futuros que serão     │
│     automaticamente cancelados.                            │
│                                                            │
│  [Cancelar]                              [Confirmar Exclusão] │
└────────────────────────────────────────────────────────────┘
```

### Visualização de Logs (Configurações)

Nova tab ou secção em Configurações para ver o histórico de ações:

```text
┌─────────────────────────────────────────────────────────────┐
│  Logs de Auditoria                                          │
├─────────────────────────────────────────────────────────────┤
│  29/01/2025 14:32 │ admin@clinica.pt │ Apagou paciente      │
│                   │                   │ "João Silva"          │
├─────────────────────────────────────────────────────────────┤
│  29/01/2025 14:30 │ admin@clinica.pt │ Cancelou sessão      │
│                   │                   │ Maria Santos - 30/01  │
├─────────────────────────────────────────────────────────────┤
│  29/01/2025 14:25 │ admin@clinica.pt │ Apagou serviço       │
│                   │                   │ "Pilates Individual"  │
└─────────────────────────────────────────────────────────────┘
```

---

## Ficheiros a Criar

### 1. Serviço de Auditoria
**`src/services/AuditService.ts`**

Responsabilidades:
- Registar ações no banco de dados
- Formatar mensagens de log
- Buscar histórico de logs para visualização

### 2. Componente de Confirmação de Exclusão
**`src/components/shared/DeleteConfirmationDialog.tsx`**

Componente reutilizável com:
- Título e descrição personalizáveis
- Alertas de impacto (agendamentos futuros, etc.)
- Botões de cancelar e confirmar
- Estado de loading durante a operação

### 3. Painel de Logs de Auditoria
**`src/components/settings/AuditLogsPanel.tsx`**

Componente para visualizar histórico:
- Lista de ações com filtros
- Paginação
- Busca por utilizador ou entidade

---

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Pacientes.tsx` | Adicionar botão de apagar no card/modal |
| `src/pages/Profissionais.tsx` | Adicionar botão de apagar |
| `src/pages/Servicos.tsx` | Integrar auditoria no delete existente |
| `src/components/agenda/SessionManagementModal.tsx` | Adicionar opção de apagar sessão |
| `src/components/patients/PatientDetailModal.tsx` | Adicionar botão de apagar paciente |
| `src/contexts/DataContext.tsx` | Adicionar funções deletePatient, deleteSession, deleteProfessional |
| `src/pages/Configuracoes.tsx` | Adicionar tab/secção de Logs de Auditoria |

---

## Migração SQL

```sql
-- Tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_audit_logs_clinic_id ON public.audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários podem inserir e ver logs da própria clínica
CREATE POLICY "Users can insert audit logs in own clinic"
  ON public.audit_logs FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can view audit logs from own clinic"
  ON public.audit_logs FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));
```

---

## Secção Técnica

### Estrutura do Serviço de Auditoria

```typescript
// src/services/AuditService.ts

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'cancel' 
  | 'complete' 
  | 'reschedule';

export type EntityType = 
  | 'patient' 
  | 'session' 
  | 'service' 
  | 'professional'
  | 'credit_transaction';

export interface AuditLogEntry {
  id: string;
  clinic_id: string;
  user_id: string;
  user_email: string | null;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

export class AuditService {
  // Registar uma ação
  static async log(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    entityName: string;
    details?: Record<string, any>;
  }): Promise<void>;

  // Buscar logs com filtros
  static async getLogs(params: {
    limit?: number;
    offset?: number;
    entityType?: EntityType;
    action?: AuditAction;
  }): Promise<AuditLogEntry[]>;
}
```

### Função de Delete Paciente

```typescript
// Em DataContext.tsx

const deletePatient = async (patientId: string, reason?: string): Promise<void> => {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) throw new Error("Paciente não encontrado");

  // Soft delete
  const { error } = await supabase
    .from("pacientes")
    .update({ is_active: false })
    .eq("id", patientId);

  if (error) throw error;

  // Registar auditoria
  await AuditService.log({
    action: 'delete',
    entityType: 'patient',
    entityId: patientId,
    entityName: patient.full_name,
    details: {
      reason,
      previousData: {
        email: patient.email,
        phone: patient.phone,
        cpf: patient.cpf,
      }
    }
  });

  // Atualizar estado local
  await fetchPatients();
};
```

### Função de Delete Sessão

```typescript
const deleteSession = async (sessionId: string, reason?: string): Promise<void> => {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Sessão não encontrada");

  // Verificar se pode ser apagada
  if (session.status === 'realizado') {
    throw new Error("Sessões finalizadas não podem ser apagadas");
  }

  // Delete efetivo (ou cancelar se preferir manter histórico)
  const { error } = await supabase
    .from("sessoes")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;

  // Registar auditoria
  await AuditService.log({
    action: 'delete',
    entityType: 'session',
    entityId: sessionId,
    entityName: `${session.paciente?.full_name} - ${format(session.start_time, 'dd/MM HH:mm')}`,
    details: {
      reason,
      patient: session.paciente?.full_name,
      professional: session.profissional?.full_name,
      service: session.servico?.name,
      date: session.start_time,
      status: session.status,
    }
  });

  // Atualizar estado local
  await fetchSessions();
};
```

### Componente DeleteConfirmationDialog

```typescript
interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  entityName: string;
  warnings?: string[]; // Alertas de impacto
}

// Uso:
<DeleteConfirmationDialog
  isOpen={showDeleteDialog}
  onClose={() => setShowDeleteDialog(false)}
  onConfirm={handleDeletePatient}
  title="Apagar Paciente"
  description="O paciente será desativado e não aparecerá mais nas listagens."
  entityName={patient.full_name}
  warnings={[
    "Este paciente tem 2 agendamentos futuros",
    "O histórico de sessões será mantido"
  ]}
/>
```

---

## Mapeamento de Ações para Log

| Entidade | Ação UI | action | Descrição no Log |
|----------|---------|--------|------------------|
| Paciente | Apagar | delete | "Apagou paciente: João Silva" |
| Sessão | Apagar | delete | "Apagou sessão: Maria - 30/01 10:00" |
| Sessão | Cancelar | cancel | "Cancelou sessão: Maria - 30/01" |
| Sessão | Remarcar | reschedule | "Remarcou sessão: Maria de 30/01 para 02/02" |
| Sessão | Finalizar | complete | "Finalizou sessão: Maria - 30/01" |
| Serviço | Apagar | delete | "Apagou serviço: Pilates Individual" |
| Profissional | Apagar | delete | "Apagou profissional: Dr. Silva" |
| Créditos | Adicionar | create | "Adicionou 10 créditos: João Silva" |

---

## Resumo de Novos Ficheiros

| Ficheiro | Propósito |
|----------|-----------|
| `src/services/AuditService.ts` | Lógica de registo e consulta de logs |
| `src/components/shared/DeleteConfirmationDialog.tsx` | Modal de confirmação reutilizável |
| `src/components/settings/AuditLogsPanel.tsx` | Visualização de histórico de ações |

---

## Ordem de Implementação

1. Criar tabela `audit_logs` com migração SQL
2. Criar `AuditService.ts` com funções de log
3. Criar `DeleteConfirmationDialog.tsx` reutilizável
4. Adicionar `deletePatient` ao DataContext + integrar em Pacientes
5. Adicionar `deleteSession` ao DataContext + integrar na Agenda
6. Adicionar `deleteProfessional` ao DataContext + integrar em Profissionais
7. Integrar auditoria no `deleteService` existente
8. Criar `AuditLogsPanel.tsx` e adicionar em Configurações
9. Testar fluxo completo de exclusão e verificar logs
