

# Alterar Terminologia: Relatório Clínico → Relatório Fisioterapêutico

## Resumo

Substituir todas as ocorrências de "Relatório Clínico" por "Relatório Fisioterapêutico" na interface do utilizador e no PDF gerado.

---

## Locais a Alterar

| Arquivo | Linha | Texto Atual | Novo Texto |
|---------|-------|-------------|------------|
| `ClinicalReportsList.tsx` | 226 | "Relatórios Clínicos" | "Relatórios Fisioterapêuticos" |
| `ClinicalReportsList.tsx` | 293 | "relatório clínico" | "relatório fisioterapêutico" |
| `NewClinicalReportModal.tsx` | 301 | "Editar Relatório Clínico" / "Novo Relatório Clínico" | "Editar Relatório Fisioterapêutico" / "Novo Relatório Fisioterapêutico" |
| `NewClinicalReportModal.tsx` | 531 | "relatório clínico..." | "relatório fisioterapêutico..." |
| `NewClinicalReportModal.tsx` | 560 | "RELATÓRIO CLÍNICO" | "RELATÓRIO FISIOTERAPÊUTICO" |
| `ClinicalReportPDF.ts` | 72 | "RELATÓRIO CLÍNICO" | "RELATÓRIO FISIOTERAPÊUTICO" |

---

## Alterações por Arquivo

### 1. `src/components/prontuarios/ClinicalReportsList.tsx`

- Linha 226: Título da secção
- Linha 293: Mensagem de lista vazia

### 2. `src/components/prontuarios/NewClinicalReportModal.tsx`

- Linha 301: Título do modal (editar/novo)
- Linha 531: Placeholder do textarea
- Linha 560: Preview do cabeçalho do relatório

### 3. `src/components/prontuarios/ClinicalReportPDF.ts`

- Linha 72: Cabeçalho do PDF gerado

---

## Resumo Técnico

| Aspecto | Valor |
|---------|-------|
| Complexidade | Muito baixa |
| Arquivos modificados | 3 |
| Linhas alteradas | ~6 |
| Risco | Nenhum (apenas texto) |

