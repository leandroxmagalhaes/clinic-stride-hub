# Horários Reservados - Plano de Implementação

## ✅ DIA 1 - CONCLUÍDO

### Tabela `horarios_reservados`
- ✅ Criada com todos os campos (tipo, dias_semana, horario_inicio, horarios_personalizados, etc.)
- ✅ RLS policies para isolamento por clínica
- ✅ Índices para performance
- ✅ Trigger para updated_at automático
- ✅ Função SQL `check_horario_reservado()` para verificar conflitos

### Serviço TypeScript
- ✅ `src/services/ReservedSlotService.ts` criado com:
  - Interfaces tipadas (ReservedSlot, CreateReservedSlotData, etc.)
  - CRUD completo (fetchAll, create, update, cancel, delete)
  - Verificação de conflitos (checkReservation)
  - Expansão de recorrências (getForDateRange, getForDate)

---

## ✅ DIA 2 - CONCLUÍDO

### Modal de Criação
- ✅ Botão "Reservar" na página Agenda (com ícone de cadeado)
- ✅ `NewReservedSlotModal.tsx` com formulário completo:
  - Seleção de paciente (searchable combobox)
  - Tipo (Fixo/Personalizado)
  - Dias da semana (botões toggle para fixo)
  - Horário de início
  - Duração configurável
  - Data início/fim
  - Seleção de cor
  - Observações

### Visualização na Agenda
- ✅ `ReservedSlotCard.tsx` - Cards coloridos com borda tracejada
- ✅ Ícone de cadeado para indicar bloqueio
- ✅ Tooltip com informações do paciente
- ✅ Integração no `AgendaDesktopGrid.tsx`
- ✅ Integração no `AgendaMobileTimeline.tsx`

### Hook de Gerenciamento
- ✅ `useReservedSlots.ts` - Hook customizado com:
  - Estado local dos horários reservados
  - CRUD operations
  - Expansão de recorrências para semana/dia
  - Verificação se slot está reservado

---

## 🔲 DIA 3 - Verificação de Conflitos (Próximo)

### Verificação ao Criar Sessão
- [ ] Ao criar sessão normal, verificar se slot está reservado
- [ ] Aviso visual quando conflito detectado
- [ ] Permitir usar o slot reservado (converte em sessão)

### Gestão de Reservas
- [ ] Lista de todas as reservas ativas
- [ ] Edição e cancelamento de reservas
- [ ] Filtros por paciente/profissional

---

## Resumo Técnico

```text
ARQUIVOS CRIADOS/MODIFICADOS:

src/services/ReservedSlotService.ts     ✅ Serviço CRUD + verificação
src/hooks/useReservedSlots.ts           ✅ Hook de gerenciamento
src/components/agenda/NewReservedSlotModal.tsx    ✅ Modal de criação
src/components/agenda/ReservedSlotCard.tsx        ✅ Card visual
src/components/agenda/AgendaDesktopGrid.tsx       ✅ Atualizado
src/components/agenda/AgendaMobileTimeline.tsx    ✅ Atualizado
src/pages/Agenda.tsx                    ✅ Integração completa

TABELA SQL: horarios_reservados
├── id, clinic_id, patient_id, professional_id, service_id
├── tipo ('fixo' | 'personalizado')
├── dias_semana (INTEGER[]), horario_inicio (TIME), duracao_minutos
├── horarios_personalizados (JSONB)
├── data_inicio, data_fim, status, cor, observacoes
└── RLS: clinic_id = get_user_clinic_id(auth.uid())
```
