
# Plano: Evolucao por Voz + Briefing Pre-Sessao

## Status: ✅ IMPLEMENTADO

## Visao Geral

Dois recursos complementares que fecham o ciclo clinico: o fisioterapeuta dita a evolucao por voz apos a sessao (Recurso 1), e antes da proxima sessao recebe automaticamente um briefing com o resumo do que aconteceu (Recurso 2).

---

## Recurso 1 -- Evolucao por Voz com IA ✅

- Edge Function `ai-voice-evolution` criada
- Componente `VoiceRecordButton` com Web Speech API
- Integrado no `NewEvolutionModal` com painel SOAP aceitar/rejeitar
- Metadados de voz salvos em `structured_data` JSONB
- Metodo `AIService.structureVoiceEvolution()` adicionado

## Recurso 2 -- Briefing Automatico Pre-Sessao ✅

- Tabela `session_briefings` criada com RLS por clinic_id
- Edge Function `ai-briefing-generator` com cache
- Componente `PreSessionBriefingCard` criado
- Hook `usePreSessionBriefing` criado
- Integrado no `SessionManagementModal` (Agenda)
- Integrado na pagina `Prontuarios` (aba Evolucoes)
- Registado em `config.toml`

## Proximo: Agentes Autonomos (pendente)
