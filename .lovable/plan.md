
# Implementar Módulo de Relatórios Clínicos

## Visão Geral

Adicionar sistema completo de Relatórios Clínicos no módulo Prontuários, permitindo gerar documentos profissionais para enviar a médicos e outros profissionais de saúde.

---

## Arquitetura

```text
Prontuários
├── Aba "Evoluções" (existente)
└── Aba "Relatórios" (NOVA)
    ├── Lista de relatórios com filtros
    ├── Alertas de prazo (vencendo/vencidos)
    └── Ações (criar, editar, PDF, enviar)

Componentes:
├── ClinicalReportsList.tsx     → Lista/filtros
├── NewClinicalReportModal.tsx  → Modal 3 abas
├── ClinicalReportPDF.tsx       → Geração PDF
└── ClinicalReportService.ts    → Lógica de negócio
```

---

## Fase 1: Base de Dados

### Nova Tabela: `relatorios_clinicos`

```sql
CREATE TABLE relatorios_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  
  -- Dados básicos
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'avaliacao_inicial', 'evolucao_periodica', 'alta', 'progresso_mensal'
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  
  -- Conteúdo clínico
  diagnostico_clinico TEXT,
  objetivo_tratamento TEXT,
  sessoes_realizadas INTEGER DEFAULT 0,
  evolucao_paciente TEXT,
  resultados_obtidos TEXT,
  recomendacoes TEXT,
  observacoes TEXT,
  
  -- Destinatário
  destinatario_nome TEXT,
  destinatario_especialidade TEXT,
  destinatario_identificacao TEXT, -- CRM ou NIF
  
  -- Controle de prazo
  data_validade DATE,
  dias_aviso_antecedencia INTEGER DEFAULT 7,
  status TEXT DEFAULT 'rascunho', -- 'rascunho', 'finalizado', 'enviado', 'entregue'
  
  -- Rastreabilidade
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_relatorios_patient ON relatorios_clinicos(patient_id);
CREATE INDEX idx_relatorios_professional ON relatorios_clinicos(professional_id);
CREATE INDEX idx_relatorios_clinic ON relatorios_clinicos(clinic_id);
CREATE INDEX idx_relatorios_validade ON relatorios_clinicos(data_validade) 
  WHERE status NOT IN ('entregue');
CREATE INDEX idx_relatorios_status ON relatorios_clinicos(status);
```

### Políticas RLS

| Política | Comando | Regra |
|----------|---------|-------|
| Visualizar | SELECT | clinic_id = get_user_clinic_id(auth.uid()) |
| Criar | INSERT | clinic_id = get_user_clinic_id(auth.uid()) AND (admin OR professional) |
| Atualizar | UPDATE | clinic_id = get_user_clinic_id(auth.uid()) AND (admin OR profissional dono) |
| Eliminar | DELETE | clinic_id = get_user_clinic_id(auth.uid()) AND has_role('admin') |

---

## Fase 2: Service Layer

### Novo Arquivo: `src/services/ClinicalReportService.ts`

```typescript
// Interface principal
interface ClinicalReport {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  titulo: string;
  tipo: ReportType;
  periodo_inicio: string;
  periodo_fim: string;
  diagnostico_clinico?: string;
  objetivo_tratamento?: string;
  sessoes_realizadas?: number;
  evolucao_paciente?: string;
  resultados_obtidos?: string;
  recomendacoes?: string;
  observacoes?: string;
  destinatario_nome?: string;
  destinatario_especialidade?: string;
  destinatario_identificacao?: string;
  data_validade?: string;
  dias_aviso_antecedencia: number;
  status: ReportStatus;
  enviado_em?: string;
  entregue_em?: string;
  created_at: string;
  updated_at: string;
  // Joins
  paciente?: { full_name: string; email?: string; phone?: string };
  profissional?: { full_name: string; council_number?: string };
}

// Métodos:
// - getAll(clinicId, filters) → Lista com filtros
// - getById(id) → Relatório completo
// - create(data) → Novo relatório
// - update(id, data) → Atualizar
// - delete(id) → Remover
// - markAsFinalized(id) → Mudar para "finalizado"
// - markAsSent(id) → Mudar para "enviado"
// - markAsDelivered(id) → Mudar para "entregue"
// - countSessionsInPeriod(patientId, start, end) → Contar sessões
// - getExpiring(days) → Relatórios a vencer
```

---

## Fase 3: Interface - Aba Relatórios

### Modificar: `src/pages/Prontuarios.tsx`

Adicionar nova aba "Relatórios" ao lado de "Evoluções":

```typescript
<Tabs defaultValue="evolucoes">
  <TabsList>
    <TabsTrigger value="evolucoes">Evoluções</TabsTrigger>
    <TabsTrigger value="relatorios">Relatórios</TabsTrigger> {/* NOVA */}
  </TabsList>
  
  <TabsContent value="evolucoes">
    {/* Conteúdo existente */}
  </TabsContent>
  
  <TabsContent value="relatorios">
    <ClinicalReportsList patientId={selectedProntuario.paciente_id} />
  </TabsContent>
</Tabs>
```

### Novo Componente: `ClinicalReportsList.tsx`

Layout da lista:
- Header com botão "+ Novo Relatório"
- Filtros: status, prazo (vencendo/vencido)
- Alertas visuais de prazos
- Cards/tabela com ações

Ações por relatório:
- Ver detalhes
- Editar (se não entregue)
- Download PDF
- Enviar por Email
- Marcar como entregue

---

## Fase 4: Modal de Criação/Edição

### Novo Componente: `NewClinicalReportModal.tsx`

Modal grande (700px) com 3 abas:

**Aba 1 - Dados Básicos:**
- Tipo de relatório (select)
- Período (data início/fim)
- Sessões realizadas (auto-calculado)
- Destinatário (nome, especialidade, CRM/NIF)
- Prazo de entrega

**Aba 2 - Conteúdo Clínico:**
- Diagnóstico clínico (textarea)
- Objetivo do tratamento (textarea)
- Evolução do paciente (textarea grande)
- Resultados obtidos (textarea)
- Recomendações (textarea)
- Observações (textarea)
- Botão "Importar Evoluções" → busca evoluções do período

**Aba 3 - Preview:**
- Visualização do PDF
- Botões: Salvar Rascunho, Finalizar, Download PDF

---

## Fase 5: Geração de PDF

### Nova Dependência: `jsPDF`

Usar jsPDF (mais leve que @react-pdf/renderer):

```bash
npm install jspdf
```

### Novo Arquivo: `ClinicalReportPDF.ts`

Layout profissional:
- Cabeçalho com logo da clínica
- Dados do paciente
- Período e sessões
- Seções de conteúdo clínico
- Destinatário
- Assinatura do profissional
- Rodapé com dados da clínica

Nome do arquivo: `Relatorio_{NomePaciente}_{AAAAMM}.pdf`

---

## Fase 6: Envio por Email (Fase Posterior)

### Edge Function: `send-clinical-report`

Reutilizar padrão do `send-appointment-reminder`:
- Recebe: reportId
- Busca: relatório + paciente + clínica
- Anexa: PDF gerado
- Template: Email profissional com link para download
- Atualiza: status para "enviado" + enviado_em

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `migrations/*.sql` | Criar | Tabela + RLS + índices |
| `src/services/ClinicalReportService.ts` | Criar | Lógica de negócio |
| `src/components/prontuarios/ClinicalReportsList.tsx` | Criar | Lista com filtros |
| `src/components/prontuarios/NewClinicalReportModal.tsx` | Criar | Modal 3 abas |
| `src/components/prontuarios/ClinicalReportPDF.ts` | Criar | Geração PDF |
| `src/pages/Prontuarios.tsx` | Modificar | Adicionar aba Relatórios |
| `src/contexts/DataContext.tsx` | Modificar | Adicionar state relatórios |

---

## Tipos de Relatório

| Tipo | Descrição |
|------|-----------|
| `avaliacao_inicial` | Primeira avaliação do paciente |
| `evolucao_periodica` | Evolução mensal/trimestral |
| `progresso_mensal` | Relatório de progresso |
| `alta` | Relatório de alta do tratamento |

---

## Status do Relatório

| Status | Badge | Ações Permitidas |
|--------|-------|------------------|
| `rascunho` | Cinza | Editar, Excluir |
| `finalizado` | Azul | Download PDF, Enviar, Marcar Entregue |
| `enviado` | Amarelo | Download PDF, Marcar Entregue |
| `entregue` | Verde | Apenas visualizar |

---

## Cronograma de Implementação

| Etapa | Tempo | Entregável |
|-------|-------|------------|
| 1. Migração BD | 15 min | Tabela + RLS |
| 2. Service | 20 min | CRUD completo |
| 3. Lista | 30 min | Componente com filtros |
| 4. Modal | 45 min | 3 abas funcionais |
| 5. PDF | 30 min | Geração profissional |
| 6. Integração | 15 min | Conectar tudo |

**Total estimado: ~2.5 horas**

---

## Resultado Esperado

| Funcionalidade | Status |
|----------------|--------|
| Nova aba "Relatórios" em Prontuários | Incluído |
| CRUD completo de relatórios | Incluído |
| Filtros por status e prazo | Incluído |
| Alertas de prazo (vencendo/vencido) | Incluído |
| Geração de PDF profissional | Incluído |
| Download de PDF | Incluído |
| Contagem automática de sessões | Incluído |
| Importar evoluções do período | Incluído |
| RLS por clínica | Incluído |

---

## Funcionalidades para Fase 2 (Após MVP)

- Envio por email com Resend
- Envio por WhatsApp
- Portal do Paciente: ver/confirmar entrega
- Widget no Dashboard com alertas
- Lembretes automáticos (edge function)
- Templates salvos
- Assinatura digital

