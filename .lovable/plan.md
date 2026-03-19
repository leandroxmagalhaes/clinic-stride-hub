

## Remove Fields from "Novo Relatório Fisioterapêutico" Modal

Remove the highlighted fields from the "Dados Básicos" tab, keeping only Título, Tipo de Relatório, and Profissional.

### Changes in `src/components/prontuarios/NewClinicalReportModal.tsx`

1. **Remove state variables** (lines 86-92): `periodoInicio`, `periodoFim`, `destinatarioNome`, `destinatarioEspecialidade`, `destinatarioIdentificacao`, `dataValidade`, `diasAviso`

2. **Remove reset logic** for those variables in the reset/edit-load effects

3. **Remove validation** for `periodoInicio`/`periodoFim` (lines 231-235)

4. **Update `handleSave` payload** (lines 250-265): Remove `periodo_inicio`, `periodo_fim`, `destinatario_*`, `data_validade`, `dias_aviso_antecedencia` — set sensible defaults (e.g., current date for periodo fields if DB requires them)

5. **Update `handleDownloadPDF` temp report** (lines 296-305): Same removals

6. **Remove UI sections** (lines 405-540): The "Período Início/Fim" date pickers, the sessions count alert, the "Destinatário do Relatório" section, and the "Prazo de Entrega" section

7. **Clean up unused imports**: `Calendar`, `Popover`/`PopoverContent`/`PopoverTrigger`, `CalendarIcon`, `cn` (if no longer used), `Info`, `Alert`/`AlertDescription`

