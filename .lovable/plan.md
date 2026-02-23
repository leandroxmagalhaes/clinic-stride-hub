

# Duplicar Agendamento com Nova Data

## Resumo

Adicionar um botao "Duplicar" no modal de Gestao de Sessao (`SessionManagementModal`) que permite criar rapidamente uma nova sessao com os mesmos dados (utente, profissional, servico) mas numa data/hora diferente. O fluxo respeita toda a logica de creditos existente.

## Como vai funcionar

1. O utilizador clica numa sessao existente na agenda (abre o modal que ja existe)
2. No modal, aparece um novo botao "Duplicar" ao lado de "Remarcar Sessao"
3. Ao clicar, abre um picker de data e hora (igual ao de remarcar)
4. Ao confirmar, o sistema cria uma nova sessao com:
   - Mesmo utente, profissional e servico
   - Nova data/hora escolhida
   - Status "agendado" (ou "realizado" se data passada)
   - Verifica conflitos de horario
   - Se o servico consome creditos e o utente tem saldo, marca `payment_status = "reservado"`
   - Se nao tem creditos, marca `payment_status = "pendente"`

## Ficheiros a alterar

### 1. `src/components/agenda/SessionManagementModal.tsx`

**Novas props:**
- `onDuplicateSession`: callback que recebe os dados da sessao duplicada e cria no banco

**Novo estado:**
- `isDuplicating` (boolean) -- controla se o formulario de duplicacao esta visivel
- `dupDate` / `dupHour` -- data e hora da nova sessao

**Novo botao na UI:**
- Botao "Duplicar" com icone `Copy`, posicionado junto ao botao "Remarcar Sessao"
- Ao clicar, mostra o picker de data/hora (layout identico ao de remarcar)

**Handler `handleDuplicate`:**
- Valida data e hora
- Chama `onDuplicateSession` passando: `{ pacienteId, profissionalId, servicoId, date, hour, minute, notes }`
- Mostra toast de sucesso/erro

### 2. `src/pages/Agenda.tsx`

**Nova funcao `handleDuplicateSession`:**
- Recebe os dados da sessao a duplicar + nova data/hora
- Reutiliza a logica existente de `handleCreateSession` (verificacao de creditos, conflitos, status retroativo)
- Cria a sessao via `addSession`
- Executa trigger de automacao se aplicavel

**Passar a nova prop ao `SessionManagementModal`:**
- `onDuplicateSession={handleDuplicateSession}`

## Detalhes tecnicos

### Logica de creditos na duplicacao

A duplicacao segue exactamente a mesma logica de criacao de sessao avulsa:
- Verifica `selectedService.consumes_credit`
- Verifica `getCreditBalance(pacienteId)`
- Se tem creditos e servico consome: `payment_status = "reservado"`
- Se nao tem creditos: `payment_status = "pendente"`
- O credito so e efectivamente descontado quando a sessao for finalizada (fluxo existente)

### Verificacao de conflitos

Usa `SessionService.checkConflict()` para garantir que nao ha sobreposicao de horario para o mesmo profissional na nova data/hora.

### Layout do botao

O botao "Duplicar" aparece:
- Apenas quando a sessao NAO esta em status terminal (realizado/cancelado/falta) -- para manter consistencia
- Tambem disponivel em sessoes terminais (permite reagendar o mesmo utente rapidamente)
- Na mesma zona dos botoes "Remarcar Sessao", como botao outline com icone `Copy`

