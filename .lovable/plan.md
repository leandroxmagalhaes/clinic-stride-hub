

# Criar FinancialTransactionService.ts

## Contexto

O projeto tem dois servicos financeiros:
- `FinancialService.ts` -- KPIs e consultas agregadas (receita, ticket medio)
- `CreditService.ts` -- Operacoes de credito (compra, uso, reembolso, saldo)

O novo `FinancialTransactionService.ts` servira como camada dedicada para operacoes transacionais financeiras, separando responsabilidades: queries de transacoes individuais, filtros avancados, e operacoes CRUD sobre `credit_transactions` e `transacoes_credito`.

## Ficheiro a criar

**`src/services/FinancialTransactionService.ts`**

Conteudo:
- Interface `FinancialTransaction` unificada com campos de ambas as tabelas (`credit_transactions` e `transacoes_credito`)
- Interface `TransactionFilters` para filtros (tipo, metodo pagamento, status, periodo)
- Metodos estaticos:
  - `getTransactions(filters)` -- listar transacoes com filtros e paginacao
  - `getTransactionById(id)` -- detalhe de uma transacao
  - `updatePaymentStatus(id, status)` -- atualizar status de pagamento
  - `getTransactionsByPatient(patientId)` -- historico por paciente
  - `getRevenueByPaymentMethod(startDate, endDate)` -- breakdown por metodo de pagamento
- Segue o padrao existente: classe estatica, import do supabase client, tratamento de erros com console.error

## Detalhes tecnicos

| Aspeto | Detalhe |
|---|---|
| Tabela principal | `credit_transactions` (ja usada pelos outros servicos) |
| Padrao | Classe estatica com metodos async, mesmo estilo de `FinancialService` e `CreditService` |
| Dependencias | Apenas `@/integrations/supabase/client` |
| RLS | Ja configurado na tabela `credit_transactions` -- sem alteracoes necessarias |

