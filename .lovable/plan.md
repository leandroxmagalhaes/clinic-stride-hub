
# Correção: Erro ao agendar sessão para pacientes com créditos

## Problema

O agendamento falha para pacientes que têm créditos disponíveis. A base de dados tem um constraint `CHECK` na coluna `payment_status` da tabela `sessoes` que aceita apenas: `pendente`, `pago`, `parcial`, `cancelado`.

O código em `Agenda.tsx` (linha ~177) define `payment_status = "reservado"` quando o paciente tem créditos, mas este valor não é aceite pela base de dados.

```text
Paciente SEM créditos -> payment_status = "pendente"  -> OK (valor aceite)
Paciente COM créditos -> payment_status = "reservado"  -> ERRO (valor rejeitado)
```

## Solução

Duas alterações necessárias:

### 1. Atualizar o CHECK constraint na base de dados

Adicionar o valor `"reservado"` à lista de valores permitidos no constraint `sessoes_payment_status_check`.

```sql
ALTER TABLE sessoes DROP CONSTRAINT sessoes_payment_status_check;
ALTER TABLE sessoes ADD CONSTRAINT sessoes_payment_status_check 
  CHECK (payment_status = ANY (ARRAY['pendente','pago','parcial','cancelado','reservado']));
```

### 2. Melhorar a mensagem de erro no código

Alterar `Agenda.tsx` para exibir a mensagem real do erro (incluindo erros do backend que não são instâncias de `Error`).

Na linha do catch (~202):
- Antes: `toast.error(error instanceof Error ? error.message : "Erro ao agendar sessão")`
- Depois: incluir também `error.message` de objetos que não sejam `Error` (como erros do Supabase/PostgrestError)

## Ficheiros

| Tipo | Ficheiro/Recurso | Alteração |
|------|-------------------|-----------|
| Migração SQL | Base de dados | Adicionar `"reservado"` ao CHECK constraint |
| Código | `src/pages/Agenda.tsx` | Melhorar tratamento de erros no catch |

## Resultado Esperado

Após a correção, o agendamento para o Bruno Fonseca Cravo Roxo (e qualquer paciente com créditos) funcionará normalmente, com `payment_status = "reservado"`.
