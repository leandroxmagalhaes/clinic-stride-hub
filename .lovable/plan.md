## Autosave e Retomar Preenchimento do Questionário

### Problema
Quando o paciente sai a meio do questionário, perde todo o progresso. Precisa de poder continuar de onde parou.

### Solução (apenas frontend — sem alterações de schema)

Usar a coluna `respostas` (jsonb) já existente em `portal_questionario`, gravando parcialmente com `completo = false` enquanto preenche.

---

### 1. `DynamicQuestionnaireRenderer.tsx` — autosave + UI

Adicionar suporte a:
- `pacienteId` como prop (necessário para autosave)
- `initialAnswers` carregadas ao retomar
- `onAutosave` callback (debounced 1500ms) — guarda `respostas` parciais via upsert no `portal_questionario` com `completo: false`
- Indicador no canto superior direito: "💾 A guardar…" / "✓ Guardado às HH:MM" / "⚠️ Erro ao guardar" (12px, discreto)
- Barra de progresso no topo: cálculo = secções com pelo menos 1 campo preenchido / total de secções; texto "Secção X de Y · NN%"
- Botão "Sair e continuar depois" (variant ghost com ícone Bookmark) ao lado do "Concluir" — força flush do autosave e chama `onExit` callback

### 2. `PortalOnboarding.tsx` — detecção e retomada

Ao carregar (apenas no fluxo dinâmico com `template_id`):
- Após carregar o template, fazer query a `portal_questionario` filtrando por `paciente_id`
- Se `completo === false` E `respostas` tem chaves → mostrar diálogo "Continuar ou Recomeçar"
- Se `completo === true` → ir direto para o portal (já completou — não reabrir)
- Caso contrário → começar do zero

Diálogo "Continuar ou Recomeçar" (componente `Dialog` existente):
- Ícone documento + título "Tem um questionário em curso"
- Mostra "Já preencheu X de Y secções" e "Última atualização: [data formatada pt-PT]"
- Botão primário **"Continuar de onde parei"** → carrega `respostas` no estado e abre o renderer
- Botão secundário **"Começar de novo"** → confirmação inline ("Tem a certeza? Vai perder o progresso anterior.") → limpa `respostas` no DB (update setando `respostas: {}`) e abre o renderer vazio

Implementar callback `onExit` do renderer (botão "Sair e continuar depois"):
- Toast "Progresso guardado. Pode voltar a qualquer momento."
- `navigate("/patient-portal")` ou voltar para a página inicial do portal

### 3. Compatibilidade

- Fluxo legado (sem `template_id`) **não é alterado** — autosave é apenas no renderer dinâmico
- Pacientes com `completo === true` mantêm comportamento atual (não veem retomada)
- O upsert usa `onConflict: 'paciente_id'` para preservar o registo único existente

### Detalhes técnicos

- Debounce 1500ms via `useEffect` + `setTimeout` cleanup
- Upsert no autosave preserva `template_id`, `perfil_tipo`, define `completo: false`, atualiza `respostas` e `updated_at`
- Submissão final ("Concluir") mantém o fluxo atual (`saveDynamicAnswers`) que define `completo: true`
- Usar `(supabase as any).from("portal_questionario")` (padrão do projeto para tabelas do portal)
- Formato data: `toLocaleString("pt-PT", { hour: "2-digit", minute: "2-digit" })`

### Ficheiros alterados

| Acção | Ficheiro |
|---|---|
| Modificado | `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx` |
| Modificado | `src/pages/PortalOnboarding.tsx` |

### O que NÃO muda

- Nenhuma migração SQL
- Nenhum DROP / ALTER / TRUNCATE / DELETE
- Schema `portal_questionario` intacto (usa colunas existentes `respostas`, `completo`, `template_id`, `updated_at`)
- Fluxo legado de questionário (steps 0-3) preservado
- Visual do portal e dos cards inalterado
