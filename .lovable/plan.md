## Prompt 2 — Base de dados da origem

Migração única na tabela `solicitacoes_vaga`:

1. **`paciente_id`** — `uuid`, opcional, `REFERENCES public.pacientes(id) ON DELETE SET NULL`.
2. **`origem`** — `text`, `NOT NULL`, `DEFAULT 'novo'`, com `CHECK (origem IN ('novo','ativo','inativo'))`.

Sem alterações a RLS, GRANTs, edge functions, painel ou tipos gerados. Linhas existentes ficam automaticamente com `origem = 'novo'` e `paciente_id = NULL`.

No fim confirmo: **colunas paciente_id e origem criadas.**
