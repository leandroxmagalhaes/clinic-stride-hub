

# Alinhamento Google Calendar - Sessões Lado a Lado

## Objetivo

Quando há múltiplos agendamentos no mesmo slot horário, exibi-los lado a lado (como no Google Calendar) em vez de empilhados verticalmente.

---

## Comportamento Atual vs. Desejado

```text
ATUAL (empilhado)               DESEJADO (lado a lado - Google Style)
┌─────────────────┐             ┌─────────────────────────┐
│ 09:00 João      │             │ 09:00 João │ 09:00 Maria│
├─────────────────┤             │ Fisio      │ Pilates    │
│ 09:00 Maria     │             └─────────────────────────┘
│ Pilates         │
└─────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/agenda/DroppableSlot.tsx` | Adicionar layout flex horizontal para conter múltiplas sessões |
| `src/components/agenda/DraggableSession.tsx` | Remover margin-bottom, adaptar para dividir largura igualmente |

---

## Implementação Técnica

### 1. DroppableSlot.tsx

Adicionar uma prop `sessionCount` para saber quantas sessões há no slot, e usar `flex` horizontal:

```typescript
// Nova prop
sessionCount: number;

// Container com flex horizontal
<div className={cn(
  "min-h-[70px] p-1 border-r last:border-r-0 transition-colors",
  "flex gap-0.5", // NOVO: layout horizontal
  // ... outras classes
)}>
  {children}
</div>
```

### 2. DraggableSession.tsx

Remover `mb-1` e ajustar para preencher espaço disponível:

```typescript
// De:
className="... mb-1 ..."

// Para:
className="... flex-1 min-w-0 ..." // Divide espaço igualmente
```

---

## Detalhes de Implementação

### Divisão de Espaço

- **1 sessão**: ocupa 100% da largura
- **2 sessões**: cada uma ocupa ~50%
- **3+ sessões**: divide igualmente, com `min-width` para não ficarem muito pequenas

### CSS Flexbox

```css
/* Container (DroppableSlot) */
display: flex;
gap: 2px;
flex-wrap: nowrap; /* Não quebra linha */

/* Item (DraggableSession) */
flex: 1 1 0; /* Cresce e encolhe igualmente */
min-width: 0; /* Permite truncar texto */
```

### Comportamento Visual

1. Sessões simultâneas aparecem lado a lado
2. Cada sessão reduz sua largura proporcionalmente
3. Texto trunca com `...` quando necessário
4. Mantém arrasto funcional (drag & drop)

---

## Fluxo Visual

```text
SLOT COM 1 SESSÃO
┌───────────────────────────────────────┐
│ 09:00 • João Silva                    │
│ Fisioterapia • Dr. Pedro              │
└───────────────────────────────────────┘

SLOT COM 2 SESSÕES
┌──────────────────┬──────────────────┐
│ 09:00 • João     │ 09:15 • Maria    │
│ Fisio • Pedro    │ Pilates • Ana    │
└──────────────────┴──────────────────┘

SLOT COM 3 SESSÕES
┌────────────┬────────────┬────────────┐
│ 09:00 João │ 09:15 Mari │ 09:30 José │
│ Fisio      │ Pilates    │ RPG        │
└────────────┴────────────┴────────────┘
```

---

## Considerações Especiais

1. **Mobile**: Manter comportamento empilhado no mobile (tela menor)
2. **Truncamento**: Nomes e serviços truncam automaticamente
3. **Status Badge**: Pode ser escondido quando há 3+ sessões para economizar espaço
4. **Drag & Drop**: Continua funcionando normalmente

---

## Risco e Complexidade

| Aspecto | Avaliação |
|---------|-----------|
| Complexidade | **Baixa** - apenas CSS/layout |
| Risco | **Mínimo** - mudanças visuais localizadas |
| Compatibilidade | Total com sessões existentes |

