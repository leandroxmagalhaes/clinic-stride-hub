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

## 🔲 DIA 2 - UI Básica (Próximo)

### Modal de Criação
- [ ] Botão "Horário Reservado" na página Agenda
- [ ] Modal com formulário:
  - Seleção de paciente
  - Tipo (Fixo/Personalizado)
  - Dias da semana (para Fixo)
  - Horário de início
  - Duração
  - Data início/fim
  - Cor e observações

### Visualização na Agenda
- [ ] Cards coloridos nos slots reservados
- [ ] Ícone de cadeado para indicar bloqueio
- [ ] Tooltip com info do paciente

---

## 🔲 DIA 3 - Integração Completa

### Verificação de Conflitos
- [ ] Ao criar sessão normal, verificar se slot está reservado
- [ ] Aviso visual quando conflito detectado
- [ ] Opção de prosseguir ou cancelar

### Gestão de Reservas
- [ ] Lista de todas as reservas ativas
- [ ] Edição e cancelamento
- [ ] Filtros por paciente/profissional

---

## Resumo Técnico

```text
TABELA: horarios_reservados
├── id (UUID PK)
├── clinic_id (UUID NOT NULL)
├── patient_id (UUID NOT NULL)
├── professional_id (UUID opcional)
├── service_id (UUID opcional)
├── tipo ('fixo' | 'personalizado')
├── titulo (TEXT)
├── dias_semana (INTEGER[] - para fixo)
├── horario_inicio (TIME)
├── duracao_minutos (INTEGER)
├── horarios_personalizados (JSONB - para personalizado)
├── data_inicio (DATE)
├── data_fim (DATE nullable)
├── status ('ativo' | 'pausado' | 'cancelado')
├── cor (TEXT)
├── observacoes (TEXT)
├── created_by (UUID)
├── created_at / updated_at (TIMESTAMPTZ)
└── RLS: clinic_id = get_user_clinic_id(auth.uid())

SERVIÇO: ReservedSlotService.ts
├── fetchAll() / fetchActive() / fetchByPatient()
├── create(data) / update(id, data)
├── cancel(id) / pause(id) / activate(id) / delete(id)
├── checkReservation(date, time, professionalId)
└── getForDateRange(startDate, endDate) / getForDate(date)
```
