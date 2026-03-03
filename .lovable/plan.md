

# Substituir Financeiro.tsx com nova versao completa

## Resumo

Substituir o ficheiro `src/pages/Financeiro.tsx` com a versao melhorada que adiciona:

1. **Nova tab "Contas a Receber"** -- lista sessoes realizadas com pagamento pendente, com botao "Receber" para registar pagamento
2. **KPI de Pendencias** -- card com total de contas a receber em destaque (borda laranja quando > 0)
3. **Receitas de sessoes** -- sessoes pagas sao incluidas nas entradas e na tab de transaccoes
4. **Modal "Registar Recebimento"** -- permite escolher metodo de pagamento e marcar sessao como paga
5. **Import do supabase client** -- para queries directas a tabela `sessoes`

## Alteracoes

**Ficheiro**: `src/pages/Financeiro.tsx` (substituicao completa)

Principais diferencas face ao actual:
- Novos imports: `supabase` client, icones `Hourglass`, `CircleDollarSign`, `CheckCircle2`, `AlertCircle`
- Remove import `Textarea` e `Area` (recharts) que nao sao usados na nova versao
- Nova funcao `loadSessionRevenues()` que busca sessoes com `status = "realizado"` e `price > 0`
- Nova funcao `markSessionAsPaid()` que actualiza `payment_status` e `payment_method` na tabela `sessoes`
- Estado adicional: `sessionRevenues`, `showReceiveModal`, `receiveSession`, `receiveMethod`
- `useMemo` para `sessionPaidRevenue`, `pendingRevenue`, `pendingSessions`
- Stats combinados incluem receita de sessoes pagas
- `allTransactions` inclui sessoes pagas como entradas
- Nova tab "Contas a Receber" com tabela de pendencias e badge com contador
- Novo modal de recebimento de pagamento

## Validacao tecnica

- A tabela `sessoes` tem os campos necessarios: `price`, `payment_status`, `payment_method`, `status`, `paciente_id`, `servico_id`
- A query usa relacoes existentes: `paciente:paciente_id(full_name)` e `servico:servico_id(name)`
- Remove `PeriodType = "custom"` (nao era usado) e simplifica para `"mes" | "trimestre" | "ano"`

