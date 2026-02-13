

# Permitir Agendamento Retroativo (Datas Passadas)

## Problema

Atualmente, o calendario no modal de "Novo Agendamento" bloqueia a selecao de datas anteriores a hoje. Isso impede registrar sessoes retroativas para fins de historico e dados.

Alem disso, a mensagem "Conflito de horario" aparece na imagem -- isso e um problema separado (ja existe uma sessao nesse horario para essa profissional), mas o agendamento retroativo em si e o foco principal.

## Solucao

### 1. Remover bloqueio de datas passadas no Calendario

No ficheiro `src/components/agenda/NewSessionModal.tsx`, linha 307:

- **Antes**: `disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}`
- **Depois**: Remover completamente a prop `disabled` do Calendar, permitindo selecionar qualquer data

### 2. Adicionar aviso visual para datas passadas

Quando a data selecionada for anterior a hoje, exibir um alerta amarelo informativo:

> "Esta data e anterior a hoje. O agendamento sera registrado como retroativo."

Este aviso sera meramente informativo -- nao impedira o agendamento.

### 3. Marcar sessoes retroativas automaticamente

Sessoes agendadas para datas passadas terao o status `"realizado"` em vez de `"agendado"`, ja que logicamente uma sessao no passado ja ocorreu.

## Ficheiros a alterar

| Ficheiro | Alteracao |
|----------|-----------|
| `src/components/agenda/NewSessionModal.tsx` | Remover `disabled` do Calendar + adicionar alerta de data retroativa |
| `src/pages/Agenda.tsx` | Definir status como "realizado" para sessoes com data passada |

## Resultado

O utilizador podera selecionar qualquer data (passada ou futura), vera um aviso claro quando for retroativo, e a sessao sera criada normalmente.

