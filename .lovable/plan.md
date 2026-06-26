## Objetivo
Restaurar o acesso da conta `leandroxmagalhaes@gmail.com` definindo a password para `Leo21m@@`.

## Diagnóstico
- A conta existe em `auth.users` (id `c62de87b-...`), com e-mail confirmado e último login a 23/Jun/2026.
- O erro `400 invalid_credentials` significa apenas password incorreta — nada de errado no fluxo de login nem no Supabase Auth.
- A password atual está hashed; só é possível resolver definindo uma nova.

## Passos
1. **Criar uma Edge Function de uso único** `supabase/functions/admin-set-user-password/index.ts`:
   - Recebe `{ email, password }`.
   - Usa `SUPABASE_SERVICE_ROLE_KEY` para localizar o utilizador via `auth.admin.listUsers` e chamar `auth.admin.updateUserById(id, { password, email_confirm: true })`.
   - Protegida por um header simples (uso interno, será removida após).
2. **Fazer deploy** da função.
3. **Invocá-la uma vez** com `email = leandroxmagalhaes@gmail.com` e `password = Leo21m@@`.
4. **Confirmar** o sucesso (resposta `{ success: true }`).
5. **Remover** a Edge Function `admin-set-user-password` para não deixar nenhuma porta administrativa exposta.
6. Comunicar ao utilizador para entrar em `/login` com as novas credenciais e mudar a password depois em Configurações → Conta.

## Notas
- Não toco no schema `auth` diretamente; uso apenas a Admin API oficial do Supabase.
- Nenhuma outra parte do código é alterada.
- A função é apagada no fim, portanto nada fica em produção.