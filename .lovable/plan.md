

# Correção: Erro ao agendar sessão

## Problema

O constraint `sessoes_payment_status_check` na base de dados aceita apenas: `pendente`, `pago`, `parcial`, `cancelado`.

Quando o paciente tem créditos (como o Bruno Fonseca Cravo Roxo com 1 crédito), o código define `payment_status = "reservado"`, que é rejeitado pela base de dados.

## Solução

### 1. Migração SQL

Atualizar o constraint para incluir o valor `"reservado"`:

```sql
ALTER TABLE sessoes DROP CONSTRAINT sessoes_payment_status_check;
ALTER TABLE sessoes ADD CONSTRAINT sessoes_payment_status_check 
  CHECK (payment_status = ANY (ARRAY['pendente','pago','parcial','cancelado','reservado']));
```

### 2. Melhorar mensagem de erro em `Agenda.tsx`

Alterar o bloco `catch` do `handleCreateSession` para exibir a mensagem real do erro em vez do texto genérico "Erro ao agendar sessão", facilitando a depuração futura.

## Ficheiros

| Tipo | Recurso | Alteração |
|------|---------|-----------|
| Migração | Base de dados | Adicionar `"reservado"` ao CHECK constraint |
| Código | `src/pages/Agenda.tsx` | Melhorar mensagem no catch |

## Resultado

Agendamentos para pacientes com créditos (como Bruno) passarão a funcionar normalmente.

