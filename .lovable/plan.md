
# Gestão de Horários Reservados: Editar e Excluir

## Problema
Os cards de horário reservado (cadeado) na agenda não respondem ao clique. Não existe nenhum modal de gestão para editar ou excluir reservas existentes.

## Solução

Criar um modal de gestão de horários reservados e conectá-lo aos cards na agenda.

---

### 1. Novo componente: `ReservedSlotManagementModal`

Um modal que abre ao clicar num card de reserva, com as seguintes funcionalidades:

**Visualização:**
- Nome do utente, profissional, serviço
- Tipo (fixo/personalizado), dias da semana, horário
- Período de validade (data início/fim)
- Cor e observações

**Ações:**
- **Editar** campos principais: título, profissional, serviço, dias da semana, horário, cor, datas, observações
- **Pausar/Reativar** reserva (alterna status entre "ativo" e "pausado")
- **Cancelar** reserva (soft delete com confirmação)
- **Excluir permanentemente** (hard delete com confirmação extra)

### 2. Atualizar `Agenda.tsx`

- Adicionar estado para a reserva selecionada e controlo do modal
- Criar handler `handleReservedSlotClick` que recebe a reserva
- Passar funções `updateReservedSlot` e `cancelReservedSlot` do hook para o modal
- Renderizar o novo modal

### 3. Atualizar `AgendaDesktopGrid.tsx`

- Adicionar prop `onReservedSlotClick: (reservation: ReservedSlot) => void`
- Passar o `onClick` ao `ReservedSlotCard` com a reserva correspondente

### 4. Atualizar `AgendaMobileTimeline.tsx`

- Mesma alteração: adicionar prop e conectar o `onClick` do `ReservedSlotCard`

---

### Detalhes Técnicos

**Ficheiros a criar:**
| Ficheiro | Descrição |
|----------|-----------|
| `src/components/agenda/ReservedSlotManagementModal.tsx` | Modal de visualização, edição e exclusão |

**Ficheiros a editar:**
| Ficheiro | Alteração |
|----------|-----------|
| `src/pages/Agenda.tsx` | Estado, handler e renderização do modal |
| `src/components/agenda/AgendaDesktopGrid.tsx` | Prop `onReservedSlotClick`, passar onClick ao card |
| `src/components/agenda/AgendaMobileTimeline.tsx` | Prop `onReservedSlotClick`, passar onClick ao card |

**Estrutura do modal:**
- Modo de leitura por defeito (exibe detalhes)
- Botão "Editar" alterna para modo de edição inline
- Botão "Cancelar Reserva" com `AlertDialog` de confirmação
- Botão "Excluir" com dupla confirmação (não pode ser desfeito)
- Usa `updateReservedSlot` e `cancelReservedSlot` do `useReservedSlots`
