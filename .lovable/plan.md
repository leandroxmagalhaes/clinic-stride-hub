
# Horários Flexíveis na Agenda

## Análise do Código Atual

O sistema atual está "amarrado" porque:

1. **`Agenda.tsx` (linha 27)**: Define slots fixos de hora em hora
   ```typescript
   const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 to 18:00
   ```

2. **`NewSessionModal.tsx` (linha 80)**: Lista de horários no dropdown
   ```typescript
   const AVAILABLE_HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 to 18:00
   ```

3. **`SessionService.ts` (linha 147)**: Sempre define minutos como 0
   ```typescript
   const startTime = setMinutes(setHours(new Date(data.date), data.hour), 0);
   ```

---

## Solução Proposta

### Mudança 1: Expandir horários de visualização (filtro)

Alterar o array `HOURS` para cobrir 06:00–23:00, mas permitir **filtrar a visualização** sem limitar o agendamento.

```typescript
// Horário completo disponível (para agendamento)
const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

// Filtro de visualização padrão (ajustável pelo utilizador)
const [hourFilter, setHourFilter] = useState({ start: 7, end: 19 });
const displayedHours = ALL_HOURS.filter(h => h >= hourFilter.start && h <= hourFilter.end);
```

### Mudança 2: Permitir minutos flexíveis no modal

Trocar o seletor de hora por um **input de texto** ou **dois selects** (hora + minutos):

```typescript
// Estado para hora e minutos separados
const [selectedHour, setSelectedHour] = useState<number | undefined>();
const [selectedMinute, setSelectedMinute] = useState<number>(0);

// Opções de minutos
const MINUTE_OPTIONS = [0, 15, 30, 45]; // Ou livre: 0-59
```

### Mudança 3: Adaptar SessionService para aceitar minutos

Alterar `CreateSessionData` para aceitar `hour` como número decimal ou adicionar campo `minute`:

```typescript
interface CreateSessionData {
  // ... campos existentes
  hour: number;
  minute?: number; // NOVO: 0-59
}

// Na criação:
const startTime = setMinutes(setHours(new Date(data.date), data.hour), data.minute ?? 0);
```

### Mudança 4: Mostrar sessões no slot correto (grid)

Atualmente, sessões com minutos != 0 aparecem no slot da hora. Isso já funciona (14:30 aparece no slot das 14h). Basta ajustar o texto para mostrar o horário real.

---

## Arquivos a Modificar

| Arquivo | Alteração | Impacto |
|---------|-----------|---------|
| `src/pages/Agenda.tsx` | Expandir `HOURS`, adicionar filtro de visualização | Baixo |
| `src/components/agenda/NewSessionModal.tsx` | Adicionar seletor de minutos (15min intervalos) | Baixo |
| `src/services/SessionService.ts` | Aceitar minutos no `CreateSessionData` | Baixo |
| `src/components/agenda/AgendaDesktopGrid.tsx` | Mostrar hora:minuto nas sessões | Mínimo |
| `src/components/agenda/AgendaMobileTimeline.tsx` | Mostrar hora:minuto nas sessões | Mínimo |
| `src/components/agenda/AgendaControls.tsx` | Adicionar filtro de horário (opcional, UI simples) | Baixo |

---

## Como Vai Funcionar

### Agendamento
1. No modal, você escolhe **hora** (06-23) + **minutos** (00, 15, 30, 45)
2. Exemplo: 14:45, 16:15, 12:30 — tudo válido
3. O sistema grava com precisão de minutos

### Visualização
1. Por padrão, mostra slots de 07:00 às 19:00
2. Você pode expandir/reduzir o filtro (ex: ver 06:00 às 23:00)
3. Sessões fora do filtro continuam existindo, só não aparecem no grid
4. Sessão às 14:45 aparece no slot das 14h, com o horário correto visível

### Conflitos
O `checkConflict` atual compara hora exata. Vou ajustar para verificar **sobreposição de intervalos** (start_time/end_time) em vez de apenas a hora, evitando:
- 14:00-15:00 conflitar com 14:30-15:30 ✓

---

## Fluxo Visual

```text
FILTRO DE VISUALIZAÇÃO (cabeçalho da agenda)
┌─────────────────────────────────────┐
│  Das [07:00 ▼] às [19:00 ▼]         │
└─────────────────────────────────────┘

MODAL DE AGENDAMENTO
┌─────────────────────────────────────┐
│  Hora: [14 ▼]  Minutos: [45 ▼]      │
│                                     │
│  → 14:45 - 15:45 (60min)            │
└─────────────────────────────────────┘

GRID (slot das 14h)
┌─────────────────────────────────────┐
│  14:45 • João Silva                 │
│  Fisioterapia                       │
└─────────────────────────────────────┘
```

---

## Risco e Complexidade

| Aspecto | Avaliação |
|---------|-----------|
| Complexidade | **Baixa** - mudanças localizadas em 6 arquivos |
| Risco de quebrar algo | **Mínimo** - lógica principal não muda |
| Tempo estimado | ~15-20 minutos de implementação |
| Compatibilidade | Sessões existentes continuam funcionando |

---

## Alternativa Mais Simples (se preferir)

Se quiser ainda mais simples:
- Manter grid de hora em hora
- Só adicionar campo de minutos no modal
- Sessões com minutos aparecem no slot da hora inteira

Isso resolve 90% do seu problema com menos mudanças.

---

## Recomendação

Implementar a **solução completa** com filtro de visualização, porque:
1. Você ganha flexibilidade total (06:00–23:00)
2. Evita poluição visual (filtra o que não precisa ver)
3. Permite crescimento futuro (diferentes horários para diferentes dias)
