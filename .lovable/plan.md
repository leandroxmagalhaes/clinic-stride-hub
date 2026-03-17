

## Add Missing Session Detail Fields to Respiratory Report

### New Fields
From the PDF's "Session Summary" and "Session Detail" sections, add 6 new fields:

| Field | Key | Source in PDF |
|-------|-----|---------------|
| Respirações Realizadas/Propostas | `respiracoes` | "Breaths Completed: 18" → "18/30" |
| Carga Alvo (cmH2O) | `carga_alvo` | "Target Load (cmH20): 3" |
| Tipo de Sessão | `tipo_sessao` | "Session Type: Test / SIndex" |
| SIndex Média de Sessão | `sindex_session_avg` | "S.Avg: 92.89" |
| PIF Média de Sessão | `pif_session_avg` | "PIF S.Avg: 5.15" |
| Volume Médio de Sessão | `volume_session_avg` | "Volume S.Avg: 1.67" |

### Changes

**1. Edge Function `supabase/functions/relatorio-respiratorio-ai/index.ts`**
- Add 6 new fields to the system prompt instruction list
- Add 6 new properties to the tool calling schema (`respiracoes`, `carga_alvo`, `tipo_sessao`, `sindex_session_avg`, `pif_session_avg`, `volume_session_avg`)
- Add them to the `required` array

**2. `src/pages/RelatorioRespiratorio.tsx`**
- Add 6 new fields to `EMPTY_DATA` with empty string defaults
- In the `parametros` tab of `StepEditor`, add 6 new `<Field>` components in a logical layout after the existing parameters
- Note: `sindex_avg` (existing) represents the PNV-based average; the new `sindex_session_avg` is the session S.Avg value from the table

