Vou corrigir especificamente o fluxo do link de redefinição de senha do Portal, sem alterar regras do questionário, onboarding, autosave ou dados clínicos.

Diagnóstico do erro atual:
- O screenshot mostra que a página `/portal/reset-password` está a abrir, mas falha com `The operation was aborted`.
- Nos logs de autenticação há uma sequência importante: o link foi usado com sucesso por um acesso real e, 3 segundos depois, outro acesso ao mesmo `/verify` recebeu `One-time token not found`. Isto confirma que o token de recuperação é de uso único e está a ser consumido/reutilizado num fluxo frágil.
- O código atual também chama métodos de autenticação enquanto há listeners globais de auth ativos, e o projeto tem mais de uma subscrição `onAuthStateChange` (`AuthContext`, `DataContext`, `PortalLogin`, `PortalResetPassword`). Isto aumenta risco de corrida/deadlock/abort no processamento do link.

Plano cirúrgico:

1. Ajustar `PortalResetPassword.tsx` para processar o link de forma determinística
   - Remover dependência do listener local `onAuthStateChange` dentro da página de reset.
   - Processar primeiro tokens/código/hash da URL numa única função assíncrona.
   - Para `access_token + refresh_token`, chamar `setSession` uma única vez.
   - Para `code`, chamar `exchangeCodeForSession` uma única vez.
   - Para `token_hash + type=recovery`, chamar `verifyOtp` uma única vez.
   - Limpar query/hash da URL só depois de uma troca bem-sucedida.
   - Tratar `AbortError`/`The operation was aborted` como falha recuperável e mostrar instrução clara para pedir novo link, em vez de mensagem técnica.

2. Evitar consumo/reutilização acidental do token
   - Adicionar uma guarda em memória/ref para impedir que o processamento rode duas vezes no mesmo carregamento React.
   - Evitar que o fallback “sessão já existente” aceite qualquer sessão antiga como reset válido, a menos que a URL indique recuperação ou a sessão tenha acabado de ser estabelecida pela própria página.
   - Não chamar `signOut` antes/durante a validação do link, para não interferir na sessão temporária de recuperação.

3. Preservar o comportamento do login normal
   - Manter `/portal/login` como entrada do Portal.
   - Manter Google OAuth via `lovable.auth`.
   - Manter o encaminhamento de recovery que chega por engano em `/portal/login`, mas tornar a deteção mais estrita para não competir com o processamento da página de reset.

4. Corrigir a experiência quando o link já foi consumido/expirou
   - Trocar a mensagem técnica `The operation was aborted` por uma mensagem orientada: “Este link já foi usado ou expirou. Peça um novo link e abra-o uma única vez.”
   - Botão para voltar ao login e pedir novo link.
   - Não alterar templates de email nem backend neste passo, salvo se o teste indicar que o redirect autorizado está incorreto.

5. Validar apenas o necessário
   - Rodar build/typecheck após a alteração.
   - Testar que `/portal/reset-password` continua público e renderiza sem quebrar o preview.
   - Não mexer em banco de dados, permissões, questionário ou autosave nesta correção.

Ficheiros previstos:
- `src/pages/PortalResetPassword.tsx`
- `src/pages/PortalLogin.tsx` apenas se necessário para tornar a guarda de recovery mais precisa.

Sem alterações previstas em banco de dados.