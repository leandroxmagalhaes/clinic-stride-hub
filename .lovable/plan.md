
# Plano: Evolucao por Voz + Briefing Pre-Sessao

## Visao Geral

Dois recursos complementares que fecham o ciclo clinico: o fisioterapeuta dita a evolucao por voz apos a sessao (Recurso 1), e antes da proxima sessao recebe automaticamente um briefing com o resumo do que aconteceu (Recurso 2).

---

## Recurso 1 -- Evolucao por Voz com IA

### O que muda

Adicionar um botao de microfone no modal `NewEvolutionModal` ao lado do campo "Descricao do Atendimento". O fluxo: gravar audio -> transcrever -> estruturar em SOAP -> preencher campo para revisao.

### Backend

**Edge Function `ai-voice-evolution`**
- Recebe o audio em base64 (ou texto ja transcrito)
- Etapa 1: Transcreve usando Whisper via Lovable AI Gateway (o gateway suporta modelos OpenAI, entao usaremos a API de completions com instrucao para estruturar o texto -- ja que o gateway nao expoe o endpoint /audio/transcriptions diretamente)
- **Alternativa pratica**: Usar a Web Speech API (nativa do browser) para transcricao no cliente (zero custo, sem API externa), e enviar o texto transcrito para a Edge Function que apenas estrutura em SOAP usando `google/gemini-3-flash-preview`
- Etapa 2: Estrutura o texto em formato SOAP (Subjetivo, Objetivo, Avaliacao, Plano)
- Retorna JSON estruturado com transcricao bruta + versao SOAP
- Loga uso em `ai_usage_logs`

**Decisao tecnica**: A Web Speech API (SpeechRecognition) funciona bem em Chrome/Edge e e gratuita. A transcricao acontece no browser, o texto bruto vai para o backend que so faz a estruturacao SOAP. Isso evita enviar audio binario e reduz custos.

### Frontend

**Componente `VoiceRecordButton`** (novo)
- Botao de microfone com estados: idle, recording (pulsa vermelho), transcribing, structuring
- Usa `webkitSpeechRecognition` / `SpeechRecognition` API
- Suporte a gravacao continua com `continuous: true` e `interimResults: true`
- Fallback: se browser nao suporta, mostra tooltip "Nao suportado neste navegador"
- Ao finalizar: envia texto transcrito para edge function `ai-voice-evolution`

**Alteracoes em `NewEvolutionModal`**
- Adicionar `VoiceRecordButton` ao lado do label "Descricao do Atendimento"
- Quando a IA retorna o SOAP, preencher o campo `descricao` com o texto formatado
- Mostrar `AISuggestionPanel` com preview do SOAP para aceitar/rejeitar
- Guardar metadados extras no `structured_data` JSONB: `{ voice_recording_at, raw_transcription, soap_structured: true }`

**Sem alteracoes no banco de dados**: Os campos `descricao` (texto SOAP formatado) e `structured_data` (JSONB com metadados de voz) ja existem na tabela `evolucoes_clinicas`.

### AIService

Adicionar metodo:
```
static async structureVoiceEvolution(payload: {
  rawTranscription: string;
  patientName: string;
  painLevel?: number;
}): Promise<AIResponse<VoiceEvolutionResult>>
```

---

## Recurso 2 -- Briefing Automatico Pre-Sessao

### O que muda

Card de briefing que aparece automaticamente na Agenda e no Prontuario 30 minutos antes de cada sessao agendada. Zero cliques.

### Backend

**Edge Function `ai-briefing-generator`** (nova)
- Recebe: `patient_id`, `session_id` (proxima sessao)
- Consulta no backend: ultima evolucao do paciente, historico de faltas, contagem de sessoes
- Gera resumo de 2-3 linhas da ultima evolucao
- Retorna JSON estruturado:
  - `last_evolution_summary`: resumo IA da ultima evolucao
  - `today_plan`: campo "Plano" extraido da ultima evolucao (se SOAP)
  - `absence_alert`: booleano + contagem de faltas recentes
  - `last_pain_level`: nivel de dor da ultima sessao
  - `session_number`: "Sessao X de Y"
- Cache: resultado salvo em nova tabela `session_briefings` para evitar chamadas repetidas

### Base de dados

**Nova tabela `session_briefings`**
```
id: uuid (PK)
clinic_id: uuid (FK clinics, NOT NULL)
session_id: uuid (FK sessoes, NOT NULL, UNIQUE)
patient_id: uuid (FK pacientes, NOT NULL)
briefing_data: jsonb (NOT NULL) -- conteudo do briefing
generated_at: timestamptz (NOT NULL, DEFAULT now())
expires_at: timestamptz -- invalida se evolucao for editada
```
- RLS: leitura/escrita por clinic_id (mesmo padrao das outras tabelas)
- Indice unico em `session_id` para garantir 1 briefing por sessao

### Frontend

**Componente `PreSessionBriefingCard`** (novo)
- Card compacto com: resumo, plano do dia, alerta de faltas, dor, numero da sessao
- Cores: alerta de faltas em vermelho/amarelo, dor com a mesma escala de cores existente
- Botao "Atualizar" para forcar regeneracao

**Integracao na Agenda (`AgendaDesktopGrid` e `AgendaMobileTimeline`)**
- Para sessoes que comecam nos proximos 30 minutos: mostrar indicador visual (icone de briefing)
- Ao clicar na sessao, o `SessionManagementModal` exibe o briefing card no topo

**Integracao nos Prontuarios**
- Na aba "Evolucoes", se o paciente tem sessao nas proximas horas, mostrar o briefing card acima da lista de evolucoes

**Logica de carregamento**
- Hook `usePreSessionBriefing(sessionId, patientId)`:
  1. Verifica se existe briefing cacheado em `session_briefings`
  2. Se nao existe ou expirou, chama `ai-briefing-generator`
  3. Salva resultado no cache
  4. Retorna dados para o componente

### AIService

Adicionar metodo:
```
static async generatePreSessionBriefing(payload: {
  patientId: string;
  sessionId: string;
}): Promise<AIResponse<PreSessionBriefing>>
```

---

## Sequencia de Implementacao

1. **Migracao**: criar tabela `session_briefings` com RLS
2. **Edge Functions**: criar `ai-voice-evolution` e `ai-briefing-generator`
3. **Frontend Recurso 1**: `VoiceRecordButton` + integracao no `NewEvolutionModal`
4. **Frontend Recurso 2**: `PreSessionBriefingCard` + hook + integracao na Agenda e Prontuarios
5. **AIService**: adicionar os 2 novos metodos
6. **Registar funcoes** em `config.toml`

## Detalhes Tecnicos

- Modelo IA: `google/gemini-3-flash-preview` (rapido, bom para estruturacao de texto)
- Transcricao: Web Speech API (browser-native, zero custo)
- Cache de briefings: tabela dedicada, 1 registro por sessao, invalidado se nova evolucao for criada
- Seguranca: autenticacao + validacao clinic_id em ambas edge functions
- Logging: ambas funcoes registam uso em `ai_usage_logs`
- Nenhuma alteracao em `DataContext.tsx`
