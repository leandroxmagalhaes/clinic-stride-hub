

# Adicionar Relatorio de Cadastros na pagina Pacientes

## Resumo

Adicionar um botao "Relatorio" na barra de acoes da pagina de Pacientes que abre um modal com uma tabela filtravel e exportavel (CSV e PDF). A tabela mostra: data/hora de cadastro, nome completo, origem (sistema vs link), telefone, email e estado -- com ordenacao clicavel e filtro por origem.

## Alteracoes no ficheiro `src/pages/Pacientes.tsx`

### 1. Imports novos (topo do ficheiro)

Adicionar imports para:
- `useRef` ao import existente do React
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` de `@/components/ui/table`
- `FileBarChart2, ArrowUpDown, ArrowUp, ArrowDown, Download` de `lucide-react`
- `format` de `date-fns`
- `ptBR` de `date-fns/locale`

### 2. Estado e logica do relatorio (apos `selectedPatient`)

Adicionar:
- Estado: `isReportModalOpen`, `reportSearch`, `reportOrigin`, `reportSortField`, `reportSortDir`, `reportTableRef`
- Funcao `detectOrigin(patient)` que verifica se o paciente veio via link publico ou sistema
- `reportData` (useMemo) com filtragem por origem, pesquisa e ordenacao
- `toggleSort(field)` para alternar ordenacao
- `handleExportCSV()` -- gera CSV com BOM UTF-8 e faz download
- `handleExportPDF()` -- abre janela de impressao do browser com HTML formatado

### 3. Botao "Relatorio" na barra de acoes

Inserir um novo `Button` com icone `FileBarChart2` antes do botao "Link Generico", que abre o modal do relatorio.

### 4. Modal do Relatorio (novo Dialog)

Modal grande (`max-w-[900px]`) com:
- Barra de pesquisa e filtro por origem (Select)
- Botoes de exportacao CSV e PDF
- Contador de resultados
- Tabela com colunas ordenadaveis (Data, Hora, Nome, Origem, Telefone, Email, Estado)
- Badges coloridos para origem e estado
- Scroll horizontal em ecras pequenos
- Botao "Fechar" no rodape

## Detalhes tecnicos

- Todas as alteracoes sao no ficheiro `src/pages/Pacientes.tsx` (4 blocos de insercao, sem remover codigo existente)
- A detecao de origem usa campos `source`, `onboarding_token`, e `onboarding_completed_at` do paciente
- O export CSV inclui BOM (`\uFEFF`) para compatibilidade com Excel
- O export PDF usa `window.open` + `window.print` (sem dependencia de jsPDF para esta funcionalidade)
- Componentes UI ja existentes no projeto: `Table`, `Dialog`, `Select`, `Badge`, `Button`, `Input`

