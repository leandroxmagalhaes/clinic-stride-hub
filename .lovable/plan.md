

# DIA 1 - Implementação Imediata

## O que será feito agora

Vou executar as seguintes tarefas nesta ordem:

### 1. Migração SQL
Criar a tabela `horarios_reservados` com:
- Campos para bloqueios fixos e personalizados
- Políticas RLS para isolamento por clínica
- Índices para performance
- Trigger para `updated_at` automático
- Função helper `check_horario_reservado()`

### 2. Serviço TypeScript
Criar `src/services/ReservedSlotService.ts` com:
- Interfaces TypeScript tipadas
- Métodos CRUD (fetchAll, create, update, cancel)
- Verificação de conflitos
- Busca por intervalo de datas

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
├── fetchAll()
├── create(data)
├── update(id, data)
├── cancel(id)
├── checkReservation(date, time, professionalId)
└── getForDateRange(startDate, endDate)
```

---

## Próximo Passo

Após aprovar este plano, vou:
1. Executar a migração SQL
2. Criar o arquivo ReservedSlotService.ts
3. Marcar Dia 1 como concluído

**Créditos estimados: 2-3**

