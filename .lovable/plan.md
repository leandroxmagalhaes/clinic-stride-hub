
# Busca Avançada na Agenda

Inspirado no Google Calendar, adicionar uma barra de pesquisa na Agenda que abre um painel de resultados com filtros, ações rápidas (editar, duplicar, excluir, marcar status) e exportação para PDF/Excel.

## O que vai mudar para o utilizador

1. **Nova barra de pesquisa** no topo da Agenda (ao lado dos botões "Lote / Reservar / Nova Sessão"), com ícone de lupa e placeholder "Pesquisar utente, profissional, serviço…".
2. Ao escrever (ou clicar na lupa), abre um **painel de resultados** sobreposto à agenda mostrando uma lista cronológica de sessões que correspondem à pesquisa.
3. **Filtros adicionais** no painel:
   - Período (data início / data fim) — atalhos: Hoje, Esta semana, Este mês, Últimos 30 dias, Personalizado
   - Profissional (multi-seleção)
   - Serviço (multi-seleção)
   - Status (Agendado, Confirmado, Realizado, Cancelado, Falta)
   - Status de pagamento (Pago / Pendente)
4. **Cada linha de resultado** mostra: data + hora, utente, profissional, serviço, status (badge colorido), valor, e um menu de ações (⋮):
   - **Abrir / Editar** → reaproveita o `SessionManagementModal` existente
   - **Duplicar** → reaproveita o fluxo de duplicação atual
   - **Marcar como Realizado / Cancelado / Falta** (atalho rápido)
   - **Excluir** (com confirmação)
   - **Ir para na agenda** (fecha painel e navega para a semana/dia da sessão)
5. **Botões de exportação** no topo do painel:
   - **Exportar PDF** — relatório formatado com cabeçalho da clínica, filtros aplicados, tabela de sessões e totais
   - **Exportar Excel (.xlsx)** — planilha com todas as colunas (incluindo notas, telefone do utente, NIF, etc.) para análise
6. **Contador** "X sessões encontradas • Total: € Y" acima da lista.
7. **Mobile**: a pesquisa abre como tela cheia (drawer) com os mesmos filtros e ações.

## Arquitetura técnica

### Novos ficheiros

- `src/components/agenda/AgendaSearchBar.tsx` — input de pesquisa com debounce (250ms) e botão para abrir filtros avançados.
- `src/components/agenda/AgendaSearchPanel.tsx` — painel/drawer principal com filtros, lista de resultados, ações em massa e exportação. Usa `Sheet` (shadcn) lateral em desktop e fullscreen em mobile.
- `src/components/agenda/AgendaSearchResultRow.tsx` — linha de resultado com badge de status e `DropdownMenu` de ações.
- `src/services/AgendaSearchService.ts` — pesquisa client-side sobre `sessions` do `DataContext` (já carregadas), com normalização de acentos e matching em nome do utente, profissional, serviço e notas. Função `filterSessions(sessions, criteria)` retorna lista ordenada cronologicamente.
- `src/services/AgendaExportService.ts`:
  - `exportToPDF(sessions, criteria, clinicInfo)` usa **jsPDF + jspdf-autotable** (já presente no projeto noutros relatórios; verificar e adicionar se faltar).
  - `exportToExcel(sessions, criteria)` usa **xlsx** (SheetJS).

### Ficheiros editados

- `src/pages/Agenda.tsx`
  - Adicionar estado `searchOpen` e `searchQuery`.
  - Inserir `<AgendaSearchBar />` na zona de `actions` do `AppLayout`.
  - Renderizar `<AgendaSearchPanel />` controlado por `searchOpen`.
  - Reaproveitar handlers existentes (`handleSessionClick`, `updateSession`, `deleteSession`, `handleDuplicateSession`) — passados como props para o painel para que as ações sejam exatamente as mesmas da grelha.
- `src/components/agenda/SessionManagementModal.tsx` — sem alterações de lógica; é simplesmente reaproveitado a partir do painel de pesquisa.

### Lógica de pesquisa

- Pesquisa em memória (sem chamadas extra à BD) sobre `sessions` do `useData()` — já contém utente, profissional e serviço com nomes via joins.
- Normalização: `string.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()` para tolerar acentos (Caetana / caetana / Caétana).
- Suporta múltiplos termos separados por espaço (todos têm de bater).
- **Atenção ao alcance dos dados**: o `DataContext` carrega sessões da clínica num intervalo limitado. Se a pesquisa devolver poucos resultados ou o utilizador escolher um intervalo amplo (ex.: últimos 12 meses), disparar uma query Supabase complementar (`sessoes` filtrada por `clinic_id` + `start_time` no intervalo) para garantir que sessões antigas aparecem. Verificar primeiro o que o `DataContext` carrega; se já é "tudo", basta filtrar localmente.

### Exportação

- **PDF**: cabeçalho com nome da clínica + slug, filtros aplicados em texto, tabela com colunas (Data, Hora, Utente, Profissional, Serviço, Status, Valor, Pagamento), rodapé com total de sessões e soma de valores. Nome do ficheiro: `agenda_pesquisa_YYYY-MM-DD.pdf`. Guardar em download direto via `doc.save()`.
- **Excel**: uma folha "Sessões" com todas as colunas + folha "Filtros" com os critérios usados. Nome: `agenda_pesquisa_YYYY-MM-DD.xlsx`.
- BOM UTF-8 não é necessário no XLSX; no PDF garantir fonte que suporta acentos PT (helvetica padrão do jsPDF cobre).

### UX / Performance

- Debounce de 250ms no input.
- Resultados virtualizados não são necessários (utilizadores típicos terão <500 resultados); se ultrapassar 500, paginar 100 a 100 com botão "Carregar mais".
- Ao clicar "Editar" numa linha, o `SessionManagementModal` abre por cima do painel; ao fechar, o painel mantém-se aberto e a lista é refrescada via `refreshSessions()`.
- Ao excluir/duplicar, refrescar lista e mostrar toast.

## Diagrama

```text
Agenda Page
├─ AppLayout actions
│   ├─ AgendaSearchBar  ← (input + lupa)
│   ├─ Lote
│   ├─ Reservar
│   └─ Nova Sessão
│
├─ Grelha semanal (existente)
│
└─ AgendaSearchPanel (Sheet lateral, controlado por searchOpen)
    ├─ Filtros (período, profissional, serviço, status, pagamento)
    ├─ Toolbar (Exportar PDF | Exportar Excel | Contador)
    ├─ Lista de AgendaSearchResultRow
    │   └─ Menu ⋮ → Editar | Duplicar | Marcar status | Excluir | Ir para
    └─ usa SessionManagementModal existente para edição
```

## Confirmação antes de começar

- Confirmas que queres a pesquisa **client-side rápida** (sobre o que já está carregado) com fallback à BD se o intervalo for grande? Ou preferes sempre pesquisa no servidor (mais lenta, mais completa por defeito)?
- Manter os botões "Lote" e "Reservar" visíveis ao lado da nova lupa, ou queres que a lupa expanda e ocupe o espaço quando ativa?

Se nada disto for crítico, sigo com a versão padrão descrita acima.
