Vou corrigir de forma cirúrgica o fluxo de redefinição de senha do Portal, sem mexer em regras funcionais do questionário ou do portal.

Problema provável identificado:
- O email de recuperação está a gerar login temporário, mas a aplicação não está a capturar de forma suficientemente robusta o retorno do link para mostrar a tela “Nova senha”.
- Há risco de o estado global de autenticação/rotas processar o utilizador como “logado” antes da página de redefinição conseguir assumir o fluxo.
- O link pode voltar com parâmetros/hash de recuperação em formatos diferentes, e a tela atual depende quase só do evento `PASSWORD_RECOVERY`/sessão existente.

Plano de correção:
1. Tornar `/portal/reset-password` resiliente a todos os formatos de retorno do link
   - Ler explicitamente `window.location.hash` e `window.location.search`.
   - Detectar `type=recovery`, `access_token`, `refresh_token`, `code`, `token_hash` e erros como `error_code`.
   - Se houver tokens no hash, chamar `supabase.auth.setSession(...)` antes de mostrar o formulário.
   - Se houver sessão válida, mostrar imediatamente o formulário de nova senha.
   - Se houver erro/expiração, mostrar mensagem clara e botão para solicitar novo link.

2. Impedir redirecionamento indevido enquanto o link de recuperação está a ser processado
   - Ajustar o handler da tela de login para não redirecionar automaticamente quando a URL contiver parâmetros de recuperação.
   - Se a rota `/portal/login` receber acidentalmente um retorno de recuperação, encaminhar para `/portal/reset-password` preservando hash/query.

3. Melhorar mensagens de erro do pedido de recuperação
   - No envio do email, exibir a mensagem real quando houver limite de email, link expirado ou erro de autenticação.
   - Manter o `redirectTo` apontado para `/portal/reset-password`.

4. Validar build/preview após a alteração
   - Rodar verificação de TypeScript/build para garantir que o preview continua a arrancar.
   - Não alterar regras de negócio, tabelas, permissões, questionário ou autosave.

Ficheiros previstos:
- `src/pages/PortalResetPassword.tsx`
- `src/pages/PortalLogin.tsx`

Sem alterações previstas em banco de dados.