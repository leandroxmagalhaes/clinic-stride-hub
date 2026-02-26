
# Corrigir desalinhamento header/colunas no AgendaDesktopGrid

## Problema
O header e o body da grade estao em containers de scroll separados. O body tem seu proprio `max-h-[600px] overflow-y-auto` (linha 176), o que faz a scrollbar vertical aparecer apenas no body, desalinhando as colunas do header.

## Solucao
Duas alteracoes cirurgicas na estrutura de divs:

### 1. Container pai: trocar `overflow-x-auto` para `overflow-auto max-h-[600px]`
- **Linha 152**: `overflow-x-auto scrollbar-thin` → `overflow-auto max-h-[600px] scrollbar-thin`

### 2. Header: adicionar `sticky top-0 z-20`
- **Linha 156**: `grid border-b bg-muted/30` → `grid sticky top-0 z-20 border-b bg-muted/30`

### 3. Remover div wrapper do body
- **Linha 176**: Remover `<div className="max-h-[600px] overflow-y-auto scrollbar-thin">` e seu `</div>` de fecho correspondente

### Resultado
Header e body ficam dentro do mesmo container scrollavel. O `sticky top-0 z-20` no header mantem-no visivel ao scrollar verticalmente, sempre alinhado com as colunas.

Nenhuma logica, evento ou componente sera alterado -- apenas a estrutura de scroll.
