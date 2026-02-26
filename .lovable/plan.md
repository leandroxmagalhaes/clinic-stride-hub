

# Plano: Permitir Editar/Excluir Sessoes em Status Final e Registrar No-Show com Reutilizacao de Horario

## Problema Atual

1. Sessoes com status "realizado", "cancelado" ou "falta" estao bloqueadas -- nao e possivel editar, remarcar, cancelar ou apagar. O modal exibe apenas "Duplicar Sessao".
2. Ao marcar uma sessao como no-show (falta), o sistema impede agendar outro paciente no mesmo horario porque a verificacao de conflito no frontend nao exclui sessoes com status terminal.

## Alteracoes

### 1. Remover bloqueio de acoes em status terminal (`SessionManagementModal.tsx`)

- Substituir a logica `isTerminalStatus` que esconde todos os botoes de acao.
- Para sessoes em status terminal, exibir as seguintes acoes:
  - **Remarcar**: permite mover a sessao para outro horario (util para correcoes retroativas)
  - **Cancelar**: permite mudar status para cancelado (com motivo)
  - **Falta (No-Show)**: permite marcar como falta
  - **Apagar**: permite remover permanentemente
  - **Duplicar**: ja funciona, manter
- Manter os botoes "Confirmar" e "Finalizar" apenas para sessoes nao-terminais (faz sentido logico).
- Exibir um aviso informativo amarelo: "Esta sessao ja tem status final. Pode alterar se necessario." em vez da mensagem bloqueante atual.

### 2. Excluir sessoes canceladas/falta da verificacao de conflito (`SessionService.ts`)

- No metodo `checkConflict`, filtrar sessoes com status `cancelado` ou `falta` antes de verificar sobreposicao.
- Isto permite agendar um novo paciente no mesmo horario de uma sessao marcada como no-show, mantendo o registo historico do no-show intacto.

### 3. Ajustar fluxo de No-Show para sessoes ja finalizadas

- Se a sessao estava como "realizado" e o utilizador muda para "falta", oferecer opcao de estorno de credito (caso tenha sido descontado).
- A nota automatica "[FALTA] Utente nao compareceu" e adicionada ao registo.

## Resumo Tecnico

**Ficheiros a editar:**

1. `src/components/agenda/SessionManagementModal.tsx`
   - Linhas 326, 440, 633-693, 697-713: remover condicao `isTerminalStatus` dos botoes de acao (remarcar, cancelar, falta, apagar). Manter Confirmar/Finalizar condicionados a status nao-terminal.
   - Substituir mensagem "nao pode ser alterada" por aviso informativo nao-bloqueante.

2. `src/services/SessionService.ts`
   - Metodo `checkConflict` (linha 100): adicionar filtro para excluir sessoes com status `cancelado` ou `falta` da verificacao de sobreposicao.

**Sem alteracoes na base de dados** -- o trigger `check_session_overlap` ja exclui corretamente sessoes com status `cancelado` e `falta`.
