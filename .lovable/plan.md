
# Sistema de Horários Reservados (Bloqueios Recorrentes)

## Avaliação da Estratégia Proposta

A estratégia do Claude está **bem estruturada**, mas precisa de ajustes para:
1. **Simplificar** - Remover funcionalidades secundárias que aumentam complexidade
2. **Adaptar** - Alinhar com padrões existentes no código
3. **Priorizar** - Foco nas funcionalidades essenciais primeiro

### O que está BOM na proposta:
- Conceito de "fixo" vs "personalizado"
- Estrutura da tabela `horarios_reservados`
- Visual diferenciado na agenda (amarelo/verde)
- Função helper `check_horario_reservado`

### O que REMOVER/ADIAR para manter simples:
- Widget no Dashboard (pode adicionar depois)
- Email automático de vencimento (fase 2)
- Relatórios e Analytics (fase 2)
- Pausa temporária com data de retorno automático (fase 2)
- Semanas alternadas (muito complexo, usar bloqueios separados)
- Histórico de alterações (já existe AuditService)

---

## Plano de Implementação em 5 Dias

### DIA 1: Base de Dados e Serviço
**Créditos: ~3-4**

**1.1 Criar tabela `horarios_reservados`:**
```sql
CREATE TABLE horarios_reservados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  service_id UUID,
  
  tipo TEXT NOT NULL DEFAULT 'fixo', -- 'fixo', 'personalizado'
  titulo TEXT NOT NULL,
  
  -- Para tipo FIXO
  dias_semana INTEGER[], -- [1,3,5] = Seg, Qua, Sex (ISO: 1=Seg, 7=Dom)
  horario_inicio TIME NOT NULL,
  duracao_minutos INTEGER DEFAULT 60,
  
  -- Para tipo PERSONALIZADO
  horarios_personalizados JSONB, -- [{dia:1,hora:"10:00",duracao:60},...]
  
  -- Período
  data_inicio DATE NOT NULL,
  data_fim DATE, -- NULL = indefinido
  
  -- Status e visual
  status TEXT DEFAULT 'ativo', -- 'ativo', 'pausado', 'cancelado'
  cor TEXT DEFAULT '#FCD34D',
  observacoes TEXT,
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_horarios_reservados_patient ON horarios_reservados(patient_id);
CREATE INDEX idx_horarios_reservados_clinic ON horarios_reservados(clinic_id);
CREATE INDEX idx_horarios_reservados_status ON horarios_reservados(status) WHERE status = 'ativo';

-- RLS
ALTER TABLE horarios_reservados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_isolation" ON horarios_reservados
FOR ALL USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_horarios_reservados_updated_at
BEFORE UPDATE ON horarios_reservados
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**1.2 Função helper para verificar bloqueio:**
```sql
CREATE OR REPLACE FUNCTION check_horario_reservado(
  p_date DATE,
  p_time TIME,
  p_professional_id UUID
)
RETURNS TABLE (
  reservado BOOLEAN,
  reservation_id UUID,
  patient_id UUID,
  patient_name TEXT,
  tipo TEXT,
  cor TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as reservado,
    hr.id as reservation_id,
    hr.patient_id,
    pac.full_name as patient_name,
    hr.tipo,
    hr.cor
  FROM horarios_reservados hr
  INNER JOIN pacientes pac ON pac.id = hr.patient_id
  WHERE hr.status = 'ativo'
    AND (hr.professional_id IS NULL OR hr.professional_id = p_professional_id)
    AND p_date >= hr.data_inicio
    AND (hr.data_fim IS NULL OR p_date <= hr.data_fim)
    AND (
      (hr.tipo = 'fixo' 
       AND EXTRACT(ISODOW FROM p_date)::INTEGER = ANY(hr.dias_semana)
       AND hr.horario_inicio = p_time)
      OR
      (hr.tipo = 'personalizado'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(hr.horarios_personalizados) elem
         WHERE (elem->>'dia')::INTEGER = EXTRACT(ISODOW FROM p_date)::INTEGER
         AND (elem->>'hora')::TIME = p_time
       ))
    )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
```

**1.3 Criar serviço TypeScript:**
- `src/services/ReservedSlotService.ts`
  - `fetchAll()` - Lista todos os bloqueios
  - `create()` - Cria novo bloqueio
  - `update()` - Atualiza bloqueio
  - `delete()` - Cancela bloqueio
  - `checkSlotReservation()` - Verifica se horário está bloqueado
  - `getReservationsForDateRange()` - Retorna bloqueios para um período

---

### DIA 2: Modal de Criação
**Créditos: ~4-5**

**2.1 Componente `NewReservedSlotModal.tsx`:**

```text
┌────────────────────────────────────────────┐
│ 🔒 NOVO HORÁRIO RESERVADO              [X] │
├────────────────────────────────────────────┤
│                                            │
│ PACIENTE *                                 │
│ [Combobox com busca - padrão existente]    │
│                                            │
│ PROFISSIONAL (opcional)                    │
│ [Select - deixar vazio = qualquer]         │
│                                            │
│ SERVIÇO (opcional)                         │
│ [Select com cor]                           │
│                                            │
│ ────────────────────────────────────────   │
│                                            │
│ TIPO DE BLOQUEIO:                          │
│ ○ Fixo (mesmo horário todo dia)           │
│ ● Personalizado (horários diferentes)     │
│                                            │
│ [Conteúdo dinâmico baseado no tipo]        │
│                                            │
│ ────────────────────────────────────────   │
│                                            │
│ PERÍODO DE VALIDADE:                       │
│ De: [Calendario] Até: [Calendario]         │
│ ☐ Sem data fim (indefinido)                │
│                                            │
│ COR: [🟡][🟢][🔵][🟣][🟠][Custom]          │
│                                            │
│ OBSERVAÇÕES: [Textarea]                    │
│                                            │
│ ────────────────────────────────────────   │
│ PREVIEW:                                   │
│ ┌────────────────────────────────────┐    │
│ │ Seg/Qua 14:00 (60 min)             │    │
│ │ 20/01/2026 até 20/04/2026          │    │
│ │ ~26 bloqueios estimados            │    │
│ └────────────────────────────────────┘    │
│                                            │
│ [Cancelar]              [Criar Bloqueio]   │
└────────────────────────────────────────────┘
```

**2.2 Sub-componente para Tipo Fixo:**
- Checkboxes para dias da semana (Seg-Dom)
- Select para horário (06:00-23:00)
- Input numérico para duração (default: 60)

**2.3 Sub-componente para Tipo Personalizado:**
- Lista editável de horários: `[{dia, hora, duracao}]`
- Botão "+ Adicionar Horário"
- Cada item mostra: "Segunda 10:00 (60 min) [Editar][Remover]"

---

### DIA 3: Visualização na Agenda
**Créditos: ~4-5**

**3.1 Modificar `DroppableSlot.tsx`:**
- Receber prop `reservation?: ReservedSlot`
- Visual diferenciado quando há reserva:

```tsx
// Se slot tem reserva
<div className={cn(
  "min-h-[70px] p-1 border-r",
  reservation && "bg-amber-50 border-l-4 border-l-amber-400",
  reservation?.tipo === 'personalizado' && "bg-emerald-50 border-l-emerald-500"
)}>
  <div className="flex items-center gap-1 text-xs">
    <Lock className="h-3 w-3" />
    <span className="font-medium truncate">{reservation.patientName}</span>
  </div>
  <span className="text-[10px] text-muted-foreground">
    {reservation.tipo === 'fixo' ? 'Horário Fixo' : 'Personalizado'}
  </span>
</div>
```

**3.2 Modificar `AgendaDesktopGrid.tsx`:**
- Integrar busca de reservas para semana visível
- Passar dados de reserva para cada slot
- Tooltip com detalhes ao hover

**3.3 Modificar `AgendaMobileTimeline.tsx`:**
- Mesmo visual adaptado para mobile

**3.4 Tooltip com detalhes:**
```text
┌─────────────────────────────────┐
│ 🔒 Horário Reservado           │
├─────────────────────────────────┤
│ Paciente: Maria Silva           │
│ Profissional: Dr. Pedro         │
│ Serviço: RPG                    │
│ Padrão: Seg/Qua 14h             │
│ Válido até: 20/04/2026          │
│                                 │
│ [Agendar] [Ver/Editar]          │
└─────────────────────────────────┘
```

---

### DIA 4: Interação e Validação
**Créditos: ~4-5**

**4.1 Clique em slot reservado:**
- Modal de ação rápida:
  - "Agendar Sessão Agora" → Abre `NewSessionModal` pré-preenchido
  - "Ver/Editar Bloqueio" → Abre modal de edição
  - "Cancelar Bloqueio" → Confirma e cancela

**4.2 Modal de confirmação ao agendar outro paciente:**
```text
┌─────────────────────────────────────┐
│ ⚠️ CONFLITO DE HORÁRIO             │
├─────────────────────────────────────┤
│                                     │
│ Este horário está reservado para:   │
│                                     │
│ 👤 Maria Silva                      │
│ Seg/Qua 14h (Fixo)                 │
│                                     │
│ Deseja agendar mesmo assim?         │
│                                     │
│ [Não, outro horário] [Sim, agendar] │
└─────────────────────────────────────┘
```

**4.3 Modificar `NewSessionModal.tsx`:**
- Verificar reserva antes de submeter
- Mostrar aviso visual se horário reservado para outro paciente
- Se reservado para o paciente selecionado, pré-preencher dados

**4.4 Integrar notificações (sino):**
- Adicionar tipo `'reservation_expiring'` ao `NotificationService`
- Alertar: "Bloqueio de Maria Silva vence em 7 dias"

---

### DIA 5: Página de Gestão
**Créditos: ~4-5**

**5.1 Botão na Agenda:**
- Adicionar `[🔒 Horários Reservados]` ao lado de `[+ Nova Sessão]`

**5.2 Página/Modal de Gestão:**
```text
┌────────────────────────────────────────────┐
│ HORÁRIOS RESERVADOS                        │
│ [+ Novo Bloqueio]                          │
├────────────────────────────────────────────┤
│ Filtros: [Status ▼] [Paciente ▼] [Prof ▼] │
│                                            │
│ ATIVOS (8)                                 │
│ ┌────────────────────────────────────────┐│
│ │ 🟡 Maria Silva - Seg/Qua 14h           ││
│ │    Dr. Pedro • RPG                      ││
│ │    Até 20/04/2026                       ││
│ │    [Ver] [Editar] [Pausar] [Cancelar]  ││
│ └────────────────────────────────────────┘│
│                                            │
│ ┌────────────────────────────────────────┐│
│ │ 🟢 João Santos - Personalizado         ││
│ │    Seg 10h, Qua 14h, Sex 16h30         ││
│ │    Indefinido                           ││
│ │    [Ver] [Editar] [Pausar] [Cancelar]  ││
│ └────────────────────────────────────────┘│
│                                            │
│ PAUSADOS (2)                               │
│ [expandir]                                 │
└────────────────────────────────────────────┘
```

**5.3 Ações:**
- **Ver**: Navega para agenda destacando slots do bloqueio
- **Editar**: Abre modal de edição (reutiliza formulário de criação)
- **Pausar**: Muda status para "pausado" (slots ficam livres)
- **Cancelar**: Confirma e muda status para "cancelado"

---

## Estrutura de Arquivos

```text
src/
├── services/
│   └── ReservedSlotService.ts    [CRIAR]
│
├── components/
│   └── agenda/
│       ├── ReservedSlotModal.tsx       [CRIAR]
│       ├── ReservedSlotsList.tsx       [CRIAR]
│       ├── ReservedSlotCard.tsx        [CRIAR]
│       ├── ReservedSlotActionModal.tsx [CRIAR]
│       ├── DroppableSlot.tsx           [MODIFICAR]
│       ├── AgendaDesktopGrid.tsx       [MODIFICAR]
│       ├── AgendaMobileTimeline.tsx    [MODIFICAR]
│       └── NewSessionModal.tsx         [MODIFICAR]
│
├── pages/
│   └── Agenda.tsx                [MODIFICAR]
│
└── contexts/
    └── DataContext.tsx           [MODIFICAR - adicionar reservedSlots]
```

---

## Correções Técnicas à Proposta Original

| Aspecto | Proposta Original | Correção |
|---------|-------------------|----------|
| FK para `clinics` | `REFERENCES clinics(id)` | Usar apenas `clinic_id UUID NOT NULL` (RLS já isola) |
| FK para `auth.users` | `created_by REFERENCES auth.users(id)` | Usar apenas `created_by UUID` (não referenciar auth.users diretamente) |
| Trigger | Criar novo trigger | Reutilizar `update_updated_at_column()` existente |
| Semanas alternadas | Campo especial | Criar bloqueios separados (mais simples) |
| Histórico | Campo changelog | Usar `AuditService` existente |

---

## Resumo

| Dia | Foco | Arquivos |
|-----|------|----------|
| 1 | Tabela + Serviço | Migration + ReservedSlotService.ts |
| 2 | Modal de Criação | ReservedSlotModal.tsx + subcomponentes |
| 3 | Visual na Agenda | DroppableSlot, DesktopGrid, MobileTimeline |
| 4 | Interação/Validação | ActionModal, NewSessionModal, Notifications |
| 5 | Gestão | ReservedSlotsList, integração na página |

**Créditos estimados por dia**: 4-5 (dentro do limite de 5 diários)

**Resultado final**: Sistema funcional de horários reservados com:
- Bloqueios fixos e personalizados
- Visual claro na agenda (amarelo/verde)
- Agendamento rápido a partir do bloqueio
- Validação de conflitos
- Gestão centralizada
