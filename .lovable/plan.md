

# Corrigir Alinhamento das Colunas da Agenda

## Problema Identificado

Os cartões de sessão estão transbordando para fora dos limites das colunas dos dias, criando um visual desorganizado. Isso acontece porque:

1. O `DroppableSlot` não tem `overflow: hidden`
2. O texto longo (nome do serviço) não está sendo truncado corretamente
3. O conteúdo não respeita a largura máxima da célula

---

## Solução

Garantir que cada sessão fique **contida dentro dos limites da sua coluna**, com truncamento adequado do texto.

---

## Alterações Necessárias

### 1. DroppableSlot.tsx

Adicionar `overflow-hidden` para conter as sessões dentro da célula:

```typescript
className={cn(
  "min-h-[70px] p-1 border-r last:border-r-0 transition-colors",
  "flex gap-0.5 flex-nowrap overflow-hidden", // Adicionar overflow-hidden
  // ...
)}
```

### 2. DraggableSession.tsx

Garantir que o card respeite a largura e trunce o texto corretamente:

```typescript
// Container principal
className={cn(
  "p-2 rounded-md text-xs cursor-grab hover:opacity-90 transition-all",
  "flex-1 min-w-0 max-w-full overflow-hidden", // Adicionar max-w-full e overflow-hidden
  // ...
)}

// Linha do nome - garantir truncamento
<div className="flex items-center gap-1 min-w-0 flex-1">
  <p className="font-medium truncate min-w-0">
    {session.paciente?.full_name.split(' ')[0]}
  </p>
</div>

// Linha do serviço - garantir truncamento
<p className="text-muted-foreground truncate text-[10px] w-full">
  {session.servico?.name} • {session.profissional?.full_name.split(' ')[0]}
</p>
```

---

## Mudanças Detalhadas

| Arquivo | Propriedade | Antes | Depois |
|---------|-------------|-------|--------|
| `DroppableSlot.tsx` | className | `flex gap-0.5 flex-nowrap` | `flex gap-0.5 flex-nowrap overflow-hidden` |
| `DraggableSession.tsx` | container | `flex-1 min-w-0` | `flex-1 min-w-0 max-w-full overflow-hidden` |
| `DraggableSession.tsx` | linha nome | `flex items-center gap-1` | `flex items-center gap-1 min-w-0 flex-1 overflow-hidden` |
| `DraggableSession.tsx` | texto serviço | `truncate text-[10px]` | `truncate text-[10px] w-full` |

---

## Comportamento Visual Esperado

```text
ANTES (transbordando)
┌────────────────┐────────────────┐
│ SEG            │ TER            │
├────────────────┼────────────────┤
│ 09:00 João ────│───────Agendado │  <-- texto vaza
│ Fisioterapia Neurodesenvolvimento...
└────────────────┴────────────────┘

DEPOIS (contido na coluna)
┌────────────────┐────────────────┐
│ SEG            │ TER            │
├────────────────┼────────────────┤
│ 09:00 João Ag..│                │  <-- contido
│ Fisio Neuro... │                │  <-- truncado
└────────────────┴────────────────┘
```

---

## Resumo Técnico

- **Complexidade**: Baixa (apenas CSS)
- **Arquivos afetados**: 2
- **Risco**: Mínimo
- **Compatibilidade**: Mantém drag & drop funcional

