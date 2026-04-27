Plano cirúrgico para corrigir o Portal do Paciente

Consigo resolver diretamente aqui, sem precisar criar solução no Claude. O problema é uma combinação de 3 pontos: falta uma tela real de redefinição de senha, o portal redireciona para o local errado quando a sessão expira, e o questionário em andamento não é priorizado ao voltar ao portal.

1. Corrigir recuperação de senha do Portal
- Criar a rota pública `/portal/reset-password`.
- Alterar o botão “Esqueci a password” em `PortalLogin.tsx` para enviar o link de recuperação para `/portal/reset-password`, não para `/portal/login`.
- Criar uma página de redefinição com:
  - leitura do token enviado no link de email;
  - formulário “Nova senha” + “Confirmar senha”;
  - validação mínima de senha;
  - chamada segura para atualizar a senha;
  - redirecionamento final para `/portal/login` com mensagem clara.
- Evitar que o utilizador volte à tela de login sem concluir a redefinição.

2. Corrigir redirecionamentos do Portal do Paciente
- Em `PatientPortal.tsx`, se não houver sessão, redirecionar para `/portal/login` em vez de `/login`.
- Manter o portal separado do login profissional.
- Se o paciente estiver autenticado e existir questionário incompleto, mostrar chamada clara para continuar o questionário.

3. Garantir retomada automática do questionário incompleto
- No login do portal (`PortalLogin.tsx`), depois de autenticar:
  - buscar o paciente vinculado à conta;
  - verificar `portal_questionario`;
  - se `completo = false` ou `onboarding_completo = false`, enviar para `/portal/onboarding`;
  - guardar novamente o `portal_paciente_id` localmente para o onboarding conseguir carregar o progresso.
- Em `PortalOnboarding.tsx`, reforçar o carregamento para funcionar mesmo se o `localStorage` tiver sido limpo:
  - se `portal_paciente_id` não existir, recuperar o paciente a partir da conta autenticada;
  - carregar o convite/template mais recente;
  - carregar respostas parciais já guardadas;
  - abrir o diálogo “Continuar de onde parei” quando houver progresso.

4. Melhorar autosave para resistir a sair do navegador no celular
- Manter o autosave já existente por debounce.
- Adicionar salvamento também em eventos de saída/pausa:
  - `visibilitychange` quando o navegador/app fica em segundo plano;
  - `pagehide` antes da página ser suspensa/fechada;
  - `beforeunload` como fallback.
- Usar sempre `upsert` parcial em `portal_questionario.respostas`, sem alterar schema e sem apagar dados.
- Preservar questionários já completos: autosave parcial nunca deve sobrescrever `completo=true` durante edição normal.

5. Ajustar o fluxo do Google no portal
- Rever a lógica pós-OAuth em `PortalLogin.tsx` para não depender apenas do evento `SIGNED_IN`.
- Ao retornar do Google, chamar uma rotina única de resolução da conta e encaminhar corretamente:
  - questionário incompleto -> `/portal/onboarding`;
  - questionário completo -> `/patient-portal`;
  - conta não vinculada -> mensagem clara e logout.

6. QA e validação
- Rodar typecheck/build após as alterações.
- Validar os cenários críticos:
  - pedir recuperação de senha e cair em `/portal/reset-password`;
  - definir nova senha e conseguir entrar;
  - fechar/suspender navegador durante questionário e voltar depois;
  - login por email/senha retoma questionário incompleto;
  - login Google retoma questionário incompleto;
  - questionário completo continua indo para o portal/diário.

Arquivos previstos
- `src/pages/PortalLogin.tsx`
- `src/pages/PortalResetPassword.tsx` novo
- `src/pages/PatientPortal.tsx`
- `src/pages/PortalOnboarding.tsx`
- `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx`
- `src/App.tsx`

Sem alterações destrutivas
- Não vou usar `DROP`, `TRUNCATE`, nem `DELETE` em massa.
- Não vou alterar schema.
- Não vou apagar respostas existentes.
- A solução usa apenas frontend + leituras/upserts parciais nas tabelas já existentes.