
Objetivo: adicionar IA ao sistema com impacto real (clínico + gestão), sem quebrar os fluxos atuais e mantendo segurança de dados de pacientes.

Diagnóstico da base atual (análise do código)
- Prontuários já têm ótima base para IA:
  - Página e fluxo central em `src/pages/Prontuarios.tsx`
  - Modais de edição clínica e evolução: `EditClinicalDataModal.tsx`, `NewEvolutionModal.tsx`
  - Relatórios clínicos já estruturados: `ClinicalReportsList.tsx`, `NewClinicalReportModal.tsx`, `ClinicalReportService.ts`
- Gestão comercial/financeira/engajamento já está pronta para receber “insights IA”:
  - `src/pages/Comercial.tsx` + `LeadService.ts`
  - `src/pages/Financeiro.tsx` + `FinancialService.ts`
  - `src/pages/Engajamento.tsx` + `EngagementService.ts`
- Notificações e dashboard já existem para distribuição de alertas inteligentes:
  - `NotificationService.ts`, `NotificationBell.tsx`, `Dashboard.tsx`
- Backend já usa funções server-side e já possui segredo de IA disponível:
  - segredo `LOVABLE_API_KEY` configurado
- Segurança atual está boa por clínica (RLS por `clinic_id`), então IA pode ser adicionada mantendo isolamento por clínica.

Onde incluir IA (prioridade por ROI)
1) Prontuários: Resumo clínico automático por paciente
- Botão “Gerar Resumo IA” no tab Evoluções.
- Entrada: evoluções do prontuário + dor + dados estruturados.
- Saída: resumo de progresso, alertas clínicos e próximos focos terapêuticos.
- Benefício: poupa tempo na revisão de histórico.

2) Prontuários: Assistente de escrita em Anamnese/Diagnóstico/Objetivos
- Botões “Sugerir IA” dentro do `EditClinicalDataModal`.
- Modo “melhorar texto” e “expandir com linguagem técnica”.
- Benefício: padroniza linguagem clínica e acelera preenchimento.

3) Relatórios clínicos: rascunho automático
- Em `NewClinicalReportModal`, adicionar “Gerar com IA” no tab de conteúdo.
- Usa período + evoluções importadas para montar conteúdo inicial.
- Benefício: reduz drasticamente o tempo de geração de relatório.

4) Engajamento: risco de churn com explicação e mensagem sugerida
- Evoluir `ChurnRiskPanel` (hoje baseado só em dias sem sessão).
- IA gera risco, motivo e texto de reativação personalizado.
- Benefício: campanhas mais assertivas.

5) Financeiro: insights acionáveis
- Novo card “Insights IA” em `Financeiro.tsx`.
- IA analisa KPIs já existentes (caixa vs competência, ticket, volume).
- Benefício: transforma números em decisão prática.

6) Comercial: score de lead e próximo passo
- Em `NewLeadModal` e `LeadCard`, mostrar classificação (alto/médio/baixo potencial).
- Sugere abordagem comercial.
- Benefício: priorização de pipeline.

7) Dashboard: briefing diário inteligente
- Card no topo do dashboard com resumo do dia (agenda, riscos, prioridades).
- Benefício: visão executiva rápida ao abrir o sistema.

8) Portal do paciente (fase avançada): resumo de diário + orientação não diagnóstica
- Baseado em `PatientDiaryService`.
- Benefício: mais engajamento e autocuidado entre sessões.

Arquitetura proposta (seguindo padrões existentes)
Frontend
- Criar `src/services/AIService.ts` para centralizar chamadas às funções backend (padrão semelhante aos serviços atuais).
- Criar componentes reutilizáveis:
  - `AIAssistButton` (estado loading, erro, retry)
  - `AISuggestionPanel` (aceitar/rejeitar sugestão)
- Importante: não editar `DataContext.tsx` (arquivo sensível/congelado); integrações serão em páginas/componentes e novos serviços.

Backend (funções)
- Criar funções dedicadas por caso de uso:
  - `ai-clinical-summary`
  - `ai-clinical-assist`
  - `ai-report-draft`
  - `ai-churn-analysis`
  - `ai-financial-insights`
  - `ai-lead-scoring`
  - `ai-daily-briefing`
- Padrão técnico:
  - validar usuário autenticado
  - determinar `clinic_id` no backend (não confiar no front)
  - buscar somente dados da clínica do usuário
  - enviar prompt ao modelo de IA suportado (ex.: `google/gemini-2.5-flash`)
  - retornar JSON estruturado (não texto livre solto)

Dados e governança (recomendado)
- Migração 1: ampliar `clinic_settings` com flags de IA (ex.: `ai_enabled`, `ai_clinical_enabled`, `ai_management_enabled`).
- Migração 2: nova tabela `ai_usage_logs` (metadados de uso e erros, sem armazenar conteúdo sensível completo).
- RLS:
  - leitura por clínica
  - escrita feita por funções backend com validação de clínica
- Auditoria:
  - registrar “gerou sugestão IA” e “aceitou sugestão IA” com usuário e timestamp.

Sequência de implementação
Fase 0 (fundação e segurança)
1. Criar contratos de payload/resposta no frontend (`AIService`).
2. Criar funções backend base com autenticação, validação e tratamento de erro.
3. Implementar fallback de erro amigável no frontend (429, 402, timeout, indisponibilidade).
4. Adicionar flags de IA nas configurações da clínica.

Fase 1 (impacto clínico imediato)
1. Resumo IA em Prontuários.
2. Assistente IA em Anamnese/Diagnóstico/Objetivos.
3. Geração IA de rascunho de relatório clínico.
4. Validação clínica: saída sempre revisável, nunca auto-gravada sem confirmação humana.

Fase 2 (gestão e crescimento)
1. Churn inteligente em Engajamento.
2. Insights financeiros em Financeiro.
3. Lead scoring em Comercial.

Fase 3 (orquestração e experiência)
1. Briefing diário no Dashboard.
2. Integração com notificações para highlights IA.
3. (Opcional) módulo no portal do paciente com orientação textual segura.

Regras de segurança e qualidade (obrigatórias)
- Não substituir julgamento clínico: IA como sugestão assistida.
- Não auto-salvar texto gerado sem confirmação.
- Minimização de dados enviados para IA (somente campos necessários).
- Sanitizar e truncar contexto para evitar excesso de tokens e exposição desnecessária.
- Mensagens de erro claras com retorno ao fluxo manual.
- Feature flags para desligar IA por módulo imediatamente, se necessário.

Testes e validação (aceite)
1. Teste end-to-end dos fluxos de UI:
   - gerar resumo IA
   - sugerir texto e aceitar/rejeitar
   - gerar relatório IA e editar antes de salvar
2. Testes de autorização:
   - usuário de outra clínica nunca acessa dados indevidos
   - usuário sem permissão de módulo não vê botões IA
3. Testes de resiliência:
   - simular 429/402/timeout e garantir fallback funcional
4. Testes de regressão:
   - fluxo manual atual continua funcionando sem IA

Confirmações que preciso obter antes de executar (checkpoint)
1. Ordem de prioridade inicial:
- opção recomendada: Resumo clínico + Assistente de escrita + Relatório IA
2. Política de uso:
- IA apenas para sugestão (sem auto-save) como padrão
3. Escopo de perfis:
- liberar IA para admin/profissional inicialmente
4. Modelo padrão:
- `google/gemini-2.5-flash` (equilíbrio custo/velocidade/qualidade)

Resultado esperado ao final
- Equipa clínica escreve menos e decide melhor.
- Gestão ganha visão prática (churn, finanças, pipeline).
- Sistema mantém segurança por clínica e controle operacional.
- IA entra de forma incremental, com risco baixo e retorno rápido.
