

# Layout Continuo da Agenda (Estilo Google Calendar)

## Objetivo

Transformar a grelha da agenda para que as sessoes e reservas ocupem visualmente o espaco proporcional a sua duracao. Uma sessao das 13:30 com 60 minutos aparecera de 13:30 a 14:30, cruzando a linha das 14:00.

## Arquitetura da Mudanca

A estrutura atual renderiza sessoes **dentro** de cada linha de hora. A nova estrutura separa duas camadas:

1. **Camada de fundo** - linhas de hora com labels e drop zones (grelha visual)
2. **Camada de sessoes** - posicionadas absolutamente sobre a grelha

### Calculo de posicao

```text
HOUR_HEIGHT = 70px

top  = ((horaInicio - primeiraHora) * 60 + minutoInicio) / 60 * HOUR_HEIGHT
height = duracaoMinutos / 60 * HOUR_HEIGHT
```

Exemplo: sessao 13:30, 60min, primeiraHora=8
- top = ((13-8)*60 + 30) / 60 * 70 = 330/60 * 70 = 385px
- height = 60/60 * 70 = 70px

### Sobreposicao lado-a-lado

Sessoes que se sobrepoe no tempo serao detetadas por intervalo e dividirao a largura da coluna. Cada sessao recebera `left` e `width` calculados (ex: 2 sessoes sobrepostas = cada uma com 50% da largura).

---

## Ficheiros a Alterar

### 1. `src/components/agenda/AgendaDesktopGrid.tsx` (reescrita principal)

**Estrutura nova:**
- Header mantido igual (dias da semana)
- Corpo: grid com coluna de horas (60px) + 1 coluna relativa por dia
- Cada coluna de dia:
  - Linhas de hora como divs com `height: HOUR_HEIGHT` (fundo visual + drop zones)
  - Sessoes e reservas posicionadas absolutamente com `top`/`height` calculados
- Funcao `getOverlappingGroups()` para detetar sobreposicoes e calcular `left`/`width`
- Drop zones continuam como `DroppableSlot` empilhados verticalmente (1 por hora)
- Sessoes renderizadas numa camada `position: absolute` sobre os drop zones

### 2. `src/components/agenda/DraggableSession.tsx` (aceitar estilo externo)

- Adicionar prop `positionStyle?: React.CSSProperties` para receber `top`, `height`, `left`, `width`, `position: absolute`
- Mesclar com o estilo interno existente (cor, borda)
- Quando a sessao e curta (< 35px de altura), usar layout compacto (1 linha)

### 3. `src/components/agenda/DroppableSlot.tsx` (simplificar)

- Altura fixa `HOUR_HEIGHT` (70px) em vez de `min-h-[70px]`
- Remover layout flex horizontal (sessoes ja nao sao filhos)
- Manter como zona de drop + click para agendar
- Nao renderiza `children` (sessoes sao renderizadas na camada acima)

### 4. `src/components/agenda/ReservedSlotCard.tsx` (aceitar estilo externo)

- Adicionar prop `positionStyle?: React.CSSProperties` similar ao DraggableSession
- Manter visual existente

### 5. `src/components/agenda/AgendaMobileTimeline.tsx` (layout continuo mobile)

- Mesma logica de posicionamento absoluto
- Container relativo com altura = totalHoras * HOUR_HEIGHT
- Linhas de hora como fundo
- Sessoes e reservas posicionadas absolutamente
- Manter indicador de hora atual

---

## Detalhes Tecnicos

| Ficheiro | Tipo | Descricao |
|----------|------|-----------|
| `AgendaDesktopGrid.tsx` | Editar | Refactoring completo para layout absoluto |
| `AgendaMobileTimeline.tsx` | Editar | Mesmo refactoring para mobile |
| `DraggableSession.tsx` | Editar | Aceitar `positionStyle` + layout compacto |
| `DroppableSlot.tsx` | Editar | Simplificar para drop zone pura |
| `ReservedSlotCard.tsx` | Editar | Aceitar `positionStyle` |

### Logica de sobreposicao

```text
Para cada dia:
  1. Ordenar sessoes por start_time
  2. Agrupar sessoes cujos intervalos se sobrepoe
  3. Dentro de cada grupo, atribuir indice (0, 1, 2...)
  4. Calcular: left = (indice / total) * 100%, width = (1 / total) * 100%
```

### Drag-and-drop

- Drop zones (`DroppableSlot`) permanecem empilhadas verticalmente, uma por hora
- Ao soltar, o handler recebe a hora do slot de destino (igual ao atual)
- O overlay de drag mantem o visual atual

## Resultado Esperado

- Sessao das 13:30 com 60min: bloco visual de 13:30 a 14:30
- Sessao das 16:00 com 45min: bloco ocupa 3/4 da linha de hora
- Sessoes sobrepostas: lado a lado com largura dividida
- Reservas: mesmo comportamento de posicionamento continuo
- Drag-and-drop: funcional sem alteracoes de comportamento

