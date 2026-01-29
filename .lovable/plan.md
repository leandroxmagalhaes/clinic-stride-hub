
# Plano: Sistema de Convites de Equipe Funcional

## Problema Atual

O botão "Convidar" nas Configurações da Equipe não faz nada de concreto. Apenas mostra uma mensagem informando que "o convite será enviado quando o sistema de emails estiver configurado".

A boa notícia é que:
- A chave **RESEND_API_KEY** já está configurada
- O sistema já tem edge functions funcionais para envio de emails

---

## Solução Proposta

Implementar um sistema completo de convites com:

1. **Tabela de convites pendentes** no banco de dados
2. **Edge function** para envio de email de convite
3. **Link de convite** que direciona para signup com dados pré-preenchidos
4. **Associação automática** do novo utilizador à clínica ao fazer signup

---

## Fluxo do Utilizador

```text
Admin clica "Convidar"
         │
         ▼
  Preenche nome, email, função
         │
         ▼
  Sistema cria registo na tabela "team_invites"
         │
         ▼
  Edge function envia email com link de convite
         │
         ▼
  Convidado recebe email e clica no link
         │
         ▼
  Página de signup com email pré-preenchido
         │
         ▼
  Ao criar conta, sistema:
    - Associa o utilizador à clínica do convite
    - Atribui a função definida no convite
    - Marca o convite como "aceito"
```

---

## Alterações Necessárias

### 1. Nova Tabela: `team_invites`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | ID único |
| `clinic_id` | uuid | Clínica que está a convidar |
| `email` | text | Email do convidado |
| `full_name` | text | Nome do convidado |
| `role` | app_role | Função: admin, professional, secretary |
| `invited_by` | uuid | ID do utilizador que convidou |
| `status` | text | pending, accepted, expired |
| `token` | text | Token único para validar o link |
| `expires_at` | timestamp | Expiração (7 dias) |
| `created_at` | timestamp | Data de criação |
| `accepted_at` | timestamp | Data de aceitação |

### 2. Nova Edge Function: `send-team-invite`

Responsabilidades:
- Receber dados do convite
- Criar registo na tabela `team_invites`
- Gerar token único
- Enviar email via Resend com link de convite

### 3. Atualização: Página de Signup

Modificar para:
- Aceitar parâmetro `?invite=TOKEN` na URL
- Pré-preencher email e nome se vier de convite
- Após criar conta, processar o convite automaticamente

### 4. Atualização: TeamService.ts

Substituir o método placeholder `inviteUser` por chamada real à edge function

### 5. Atualização: TeamSettingsPanel.tsx

- Mostrar lista de convites pendentes
- Permitir reenviar ou cancelar convites

---

## Ficheiros a Criar

| Ficheiro | Propósito |
|----------|-----------|
| `supabase/functions/send-team-invite/index.ts` | Edge function para envio do convite |

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/services/TeamService.ts` | Chamar edge function real |
| `src/pages/Signup.tsx` | Processar convites via URL |
| `src/components/settings/TeamSettingsPanel.tsx` | Mostrar convites pendentes |

---

## Secção Técnica

### Migração SQL

```sql
-- Tabela de convites
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'professional',
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_team_invites_clinic ON public.team_invites(clinic_id);
CREATE INDEX idx_team_invites_email ON public.team_invites(email);
CREATE INDEX idx_team_invites_token ON public.team_invites(token);

-- RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Política: membros da clínica podem ver convites
CREATE POLICY "Users can view invites from their clinic"
  ON public.team_invites FOR SELECT
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Política: admins podem criar convites
CREATE POLICY "Admins can create invites"
  ON public.team_invites FOR INSERT
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

-- Política: admins podem atualizar convites
CREATE POLICY "Admins can update invites"
  ON public.team_invites FOR UPDATE
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Função para processar convite após signup
CREATE OR REPLACE FUNCTION public.process_team_invite(invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
BEGIN
  -- Buscar o convite
  SELECT * INTO v_invite FROM public.team_invites
  WHERE token = invite_token AND status = 'pending' AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Obter user_id do utilizador atual
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilizador não autenticado');
  END IF;
  
  -- Atualizar o perfil com a clínica
  UPDATE public.profiles
  SET clinic_id = v_invite.clinic_id
  WHERE user_id = v_user_id;
  
  -- Adicionar o role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_invite.role)
  ON CONFLICT DO NOTHING;
  
  -- Marcar convite como aceito
  UPDATE public.team_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;
  
  RETURN jsonb_build_object('success', true, 'clinic_id', v_invite.clinic_id);
END;
$$;
```

### Edge Function: send-team-invite

```typescript
// supabase/functions/send-team-invite/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface InviteRequest {
  email: string;
  full_name: string;
  role: 'admin' | 'professional' | 'secretary';
  clinicName: string;
  inviterName: string;
}

serve(async (req) => {
  // Criar convite na tabela
  // Enviar email com link: {BASE_URL}/signup?invite={token}
  // Retornar sucesso
});
```

### TeamService.ts Atualizado

```typescript
static async inviteUser(data: InviteUserData): Promise<{ success: boolean; error?: string }> {
  // Chamar edge function
  const response = await supabase.functions.invoke('send-team-invite', {
    body: { ...data, clinicName, inviterName }
  });
  
  if (response.error) {
    return { success: false, error: response.error.message };
  }
  
  return { success: true };
}
```

### Signup.tsx Atualizado

```typescript
// Verificar se há token de convite na URL
const [searchParams] = useSearchParams();
const inviteToken = searchParams.get('invite');

// Se houver token, buscar dados do convite
useEffect(() => {
  if (inviteToken) {
    fetchInviteDetails(inviteToken);
  }
}, [inviteToken]);

// Após signup bem-sucedido, processar o convite
if (inviteToken) {
  await supabase.rpc('process_team_invite', { invite_token: inviteToken });
}
```

---

## Experiência do Convidado

### Email Recebido

```text
Assunto: Convite para juntar-se à Clínica ABC

Olá João,

Você foi convidado por Maria Silva para juntar-se à equipe 
da Clínica ABC como Fisioterapeuta.

[Aceitar Convite]

Este convite expira em 7 dias.
```

### Página de Signup

- Email já preenchido (não editável)
- Nome já preenchido
- Apenas precisa definir a senha
- Mensagem: "Você foi convidado para a Clínica ABC"

---

## Resumo das Entregas

| Item | Descrição |
|------|-----------|
| Tabela | `team_invites` com tokens e expiração |
| Edge Function | `send-team-invite` para criar e enviar convites |
| Signup | Processar convites automaticamente |
| TeamService | Chamar edge function real |
| UI | Lista de convites pendentes no painel |

