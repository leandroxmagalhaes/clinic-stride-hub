# Plano — Solicitação de Vaga: NIF, reconhecimento e origem

Executamos os 6 prompts pela ordem A → F, um bloco por turno, sem tocar em nada fora do descrito.

## A. Formulário público — campo NIF
Ficheiro: `src/pages/SolicitarVaga.tsx`.
- Novo campo de texto livre "NIF / Documento de identificação" logo a seguir à data de nascimento (aceita qualquer formato — clientes estrangeiros).
- Checkbox "Ainda não tem NIF ou documento" por baixo: quando ativa, esconde o campo e desliga a obrigatoriedade.
- Validação: se a checkbox não estiver ligada, `nif` obrigatório com mensagem clara.
- No payload enviado à edge function `solicitar-vaga`, incluir `nif` (valor introduzido ou string vazia se a checkbox estiver ligada).
- Não mexer na edge function nem na BD.

## B. Painel de gestão (revisão/complemento)
Ficheiro: `src/pages/SolicitacoesVaga.tsx` (+ entrada de menu em `AppSidebar.tsx` e rota em `App.tsx` — só se ainda não existirem; ambos já foram criados numa fase anterior, pelo que este prompt será tratado como verificação/ajuste para garantir todos os requisitos: cartões, urgência em destaque no topo, seletor de estado com timestamp `estado_em`, filtros (estado default ativas, tipo, urgentes, ordenação), 3 contadores no topo (Novas, Em análise, Urgentes ativas), estado vazio).
- Ler `solicitacoes_vaga` via `(supabase as any)`.
- Sem alterações a edge function/BD/sino.

## C. Migração SQL
Tabela `solicitacoes_vaga`:
- `nif text` opcional.
- `paciente_id uuid` opcional, FK `pacientes(id) ON DELETE SET NULL` (já foi adicionada num prompt anterior — a migração deve ser idempotente com `ADD COLUMN IF NOT EXISTS`).
- `origem text NOT NULL DEFAULT 'novo'` com CHECK `('novo','ativo','inativo')` (já existente — idempotente).
- `possivel_homonimo boolean DEFAULT false`.
- Sem alterações a RLS/GRANTs (já configurados).

## D. Reconhecimento automático na edge function
Ficheiro: `supabase/functions/solicitar-vaga/index.ts`. Adicionar passo entre validação e insert:
- Função de normalização: lowercase, trim, `normalize('NFD').replace(/\p{Diacritic}/gu,'')`.
- Query `pacientes` (id, full_name, nif se existir, birth_date, is_active) filtrando por `clinic_id`. Se coluna `nif` não existir em `pacientes`, cair para nome + data de nascimento.
- Regras (nunca por email/telefone):
  1. Match forte = nome normalizado igual **E** (nif igual, não vazio) **OU** (data_nascimento igual).
     - `paciente_id` = id do match. `origem` = `ativo` se `is_active` senão `inativo`. `possivel_homonimo` = false.
  2. Sem match forte mas nome normalizado coincide → `paciente_id` null, `origem` `novo`, `possivel_homonimo` true.
  3. Sem qualquer coincidência → `paciente_id` null, `origem` `novo`, `possivel_homonimo` false.
- Inserir `nif`, `paciente_id`, `origem`, `possivel_homonimo` no insert.
- Email de aviso à clínica: linha "Origem" no topo (`Paciente ativo` / `Paciente inativo` / `Novo contacto`) e, se `possivel_homonimo`, linha "Atenção, nome coincide com paciente existente, verificar."
- Tudo dentro de `try/catch` — falha degrada para novo/null/false, nunca bloqueia o pedido.

## E. Painel: origem, homónimo e Ver ficha
Ficheiro: `src/pages/SolicitacoesVaga.tsx`.
- Etiqueta de origem no cartão: verde (ativo), laranja (inativo), azul/neutra (novo contacto).
- Botão pequeno "Ver ficha" quando `paciente_id` existe → `/pacientes?id=<paciente_id>` (mesmo padrão das notificações).
- Nota discreta de aviso quando `possivel_homonimo` true: "Nome coincide com paciente existente, verificar."
- Filtro por origem na barra: Todas / Paciente ativo / Paciente inativo / Novo contacto.

## F. Sino — ordenação e prioridade
Ficheiro: `src/services/NotificationService.ts`.
- No `getDbNotifications`, ao mapear registos com `type = 'solicitacao_vaga'`: prioridade `high` se a mensagem contém "URGENTE", senão `medium`. Restantes tipos mantêm a lógica atual.
- Confirmar ordenação por `createdAt` desc dentro de cada grupo de prioridade (já existe em `getNotifications`).
- Adicionar `'solicitacao_vaga'` ao union `NotificationType` para tipagem.

## Detalhes técnicos
- BD: uma única migração idempotente com `ADD COLUMN IF NOT EXISTS` para os quatro campos.
- Edge function: deploy após alterações; segue padrão existente (Deno + Supabase service role).
- Sem alteração de RLS, GRANT, `config.toml`, ou tipos gerados.
- Sem uso de "Try to fix".

Confirmas para eu avançar com o **Prompt A**?
