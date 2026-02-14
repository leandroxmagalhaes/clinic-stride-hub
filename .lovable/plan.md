
# Corrigir Erro de Constraint no Agendamento Retroativo

## Problema

A constraint `sessoes_status_check` na tabela `sessoes` nao inclui o valor `realizado`, que e o status atribuido automaticamente a sessoes retroativas (datas passadas). O codigo tenta inserir `status: "realizado"` mas o banco rejeita com erro de violacao de constraint.

**Valores permitidos atualmente:** `agendado`, `confirmado`, `em_atendimento`, `finalizado`, `cancelado`, `faltou`

**Valores usados no codigo mas ausentes:** `realizado`, `falta`

## Solucao

Atualizar a constraint `sessoes_status_check` para incluir todos os valores de status usados na aplicacao.

### Migracao SQL

```sql
ALTER TABLE public.sessoes DROP CONSTRAINT sessoes_status_check;
ALTER TABLE public.sessoes ADD CONSTRAINT sessoes_status_check 
  CHECK (status = ANY (ARRAY[
    'agendado', 'confirmado', 'em_atendimento', 
    'finalizado', 'realizado', 'cancelado', 'faltou', 'falta'
  ]));
```

### Nenhuma alteracao de codigo necessaria

O codigo ja esta correto ao usar `realizado` para sessoes retroativas. O problema e exclusivamente na constraint do banco de dados.
