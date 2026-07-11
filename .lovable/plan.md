# O que falta do plano Solicitação de Vaga

Estado atual:
- **A. Formulário público (NIF)** — Concluído.
- **C. Migração SQL** — Parcial (existem `paciente_id` e `origem`; faltam `nif` e `possivel_homonimo`).
- **B, D, E, F** — Por fazer.

Ordem de execução, um prompt por turno:

## 1) Prompt C — completar migração (idempotente)
Ficheiro: nova migração SQL.
- `ALTER TABLE public.solicitacoes_vaga ADD COLUMN IF NOT EXISTS nif text;`
- `ALTER TABLE public.solicitacoes_vaga ADD COLUMN IF NOT EXISTS possivel_homonimo boolean NOT NULL DEFAULT false;`
- Confirmar `paciente_id uuid` FK `pacientes(id) ON DELETE SET NULL` e `origem text NOT NULL DEFAULT 'novo'` com CHECK `('novo','ativo','inativo')` — só adicionar se faltarem.
- Sem alterações a RLS/GRANT.

## 2) Prompt D — reconhecimento na edge function
Ficheiro: `supabase/functions/solicitar-vaga/index.ts`.
- Normalização: lowercase + trim + `normalize('NFD').replace(/\p{Diacritic}/gu,'')`.
- Query a `pacientes` (id, full_name, cpf/nif, birth_date, is_active) por `clinic_id`. Usar coluna `cpf` (memória: NIF guardado em `cpf`); se não existir cair para nome + data de nascimento.
- Regras (nunca por email/telefone):
  1. Match forte = nome normalizado igual **E** (`cpf` igual não vazio **OU** `birth_date` igual) → `paciente_id` do match; `origem` = `ativo` se `is_active`, senão `inativo`; `possivel_homonimo` = false.
  2. Só nome coincide → `paciente_id` null, `origem` = `novo`, `possivel_homonimo` = true.
  3. Sem coincidência → tudo `novo` / null / false.
- Inserir `nif`, `paciente_id`, `origem`, `possivel_homonimo`.
- Email à clínica: linha "Origem" no topo (`Paciente ativo` / `Paciente inativo` / `Novo contacto`) e, se `possivel_homonimo`, aviso "Atenção, nome coincide com paciente existente, verificar."
- Tudo em `try/catch` — falha degrada para `novo` / null / false, nunca bloqueia o pedido.
- Redeploy da função.

## 3) Prompt E — painel: origem, homónimo e Ver ficha
Ficheiro: `src/pages/SolicitacoesVaga.tsx`.
- Etiqueta de origem no cartão: verde (ativo), laranja (inativo), azul/neutra (novo).
- Botão "Ver ficha" quando `paciente_id` existe → `/pacientes?id=<paciente_id>&edit=true` (mesmo padrão das notificações).
- Aviso discreto quando `possivel_homonimo` = true: "Nome coincide com paciente existente, verificar."
- Filtro por origem: Todas / Ativo / Inativo / Novo contacto.
- Sem alterações a Prompt B (painel já cobre cartões, contadores, filtros de estado/tipo/urgência criados anteriormente); qualquer requisito em falta de B será tratado neste mesmo passo como verificação.

## 4) Prompt F — sino: ordenação e prioridade
Ficheiros: `src/services/NotificationService.ts` e `src/components/notifications/NotificationItem.tsx`.
- Adicionar `'solicitacao_vaga'` ao union `NotificationType`.
- Em `getDbNotifications`, ao mapear: `type === 'solicitacao_vaga'` → prioridade `high` se mensagem contém "URGENTE", senão `medium`. Restantes tipos mantêm lógica atual.
- Mapear ícone (ex.: `UserPlus` ou `ClipboardList`) com fallback defensivo em `NotificationItem`.
- Ordenação por `createdAt` desc dentro de cada prioridade já existe.

## Notas técnicas
- Sem alterações a RLS, GRANT, `config.toml`, tipos gerados.
- Uso de `(supabase as any)` para tabelas não tipadas.
- Nada fora do descrito.

Confirmas para eu avançar com **Prompt C**?
