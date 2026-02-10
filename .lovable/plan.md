
# Layout Contínuo da Agenda (Estilo Google Calendar)

## Problema Atual

A agenda usa um layout discreto por hora: cada sessão é colocada na linha da hora correspondente ao `getHours()`. Uma sessão das 13:30 com 60min aparece apenas dentro da célula das 13:00, sem ocupar visualmente o espaço até às 14:30.

## Solução

Transformar a grelha para usar **posicionamento absoluto baseado em minutos**, como o Google Calendar. Cada hora terá uma altura fixa em pixels e as sessões serão posicionadas com `top` e `height` calculados proporcionalmente.

```text
ANTES (discreto):                 DEPOIS (contínuo):
┌─────────────────┐              ┌─────────────────┐
│ 13:00           │              │ 13:00           │
│ ┌─────────────┐ │              │                 │
│ │ Vicente     │ │              │ ── 13:30 ────── │
│ │ 13:30 60min │ │              │ │ Vicente     │ │
│ └─────────────┘ │              │ │ 13:30 60min │ │
├─────────────────┤              ├─│             │─┤
│ 14:00           │              │ │             │ │
│ + Agendar       │              │ └─────────────┘ │
├─────────────────┤              ├─────────────────┤
│ 15:00           │              │ 15:00           │
```

---

## Alteracoes

### 1. `AgendaDesktopGrid.tsx` - Layout continuo com posicao absoluta

**Mudanca principal:** Em vez de filtrar sessoes por hora e colocar dentro de cada linha, criar um container relativo por coluna (dia) com todas as horas como linhas de fundo, e posicionar sessoes absolutamente.

- Definir constante `HOUR_HEIGHT = 70px` (altura de cada hora)
- Manter as linhas de hora como background grid (labels + bordas)
- Para cada dia, criar uma coluna com `position: relative`
- Posicionar cada sessao com:
  - `top = (startHour - firstHour) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT`
  - `height = (durationMinutes / 60) * HOUR_HEIGHT`
- Manter drag-and-drop funcional
- Slots vazios continuam clicaveis como overlay transparente

### 2. `AgendaMobileTimeline.tsx` - Mesmo conceito para mobile

- Usar o mesmo calculo de posicao
- Manter a coluna de tempo a esquerda
- Sessoes posicionadas absolutamente no container

### 3. `DraggableSession.tsx` - Adaptar ao novo layout

- Aceitar prop `style` para receber top/height do parent
- Manter contendo interno flexivel para sessoes curtas vs longas

### 4. `DroppableSlot.tsx` - Ajustar para layout continuo

- Manter como zona de drop mas com altura fixa `HOUR_HEIGHT`
- Remover renderizacao de filhos (sessoes serao renderizadas na camada acima)

---

## Detalhes Tecnicos

| Ficheiro | Alteracao |
|----------|-----------|
| `src/components/agenda/AgendaDesktopGrid.tsx` | Refactoring para layout absoluto com HOUR_HEIGHT |
| `src/components/agenda/AgendaMobileTimeline.tsx` | Mesmo refactoring para mobile |
| `src/components/agenda/DraggableSession.tsx` | Aceitar style externo (top/height) |
| `src/components/agenda/DroppableSlot.tsx` | Ajustar para servir apenas como drop zone |

### Calculo de posicao

```typescript
const HOUR_HEIGHT = 70; // px por hora

function getSessionStyle(session, firstHour) {
  const start = new Date(session.start_time);
  const end = new Date(session.end_time);
  const startMinutes = (start.getHours() - firstHour) * 60 + start.getMinutes();
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  
  return {
    position: 'absolute',
    top: `${(startMinutes / 60) * HOUR_HEIGHT}px`,
    height: `${(durationMinutes / 60) * HOUR_HEIGHT}px`,
    left: 0,
    right: 0,
  };
}
```

### Sobreposicao (side-by-side)

O layout existente de sessoes lado-a-lado sera mantido. Sessoes que se sobrepoe no tempo serao detetadas e dividirao a largura da coluna igualmente (ja implementado com flex, sera adaptado para posicao absoluta com calculo de `left`/`width`).

## Resultado Esperado

- Sessao das 13:30 com 60min aparece visualmente de 13:30 a 14:30
- Sessao das 16:00 com 45min ocupa 3/4 da altura da hora
- Visual identico ao Google Calendar (terceira imagem de referencia)
- Drag-and-drop continua funcional
