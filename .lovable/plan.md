
# Plano: Sistema de Convite com Link Manual (Copiável)

## Problema Atual

O envio de emails via Resend está bloqueado porque o domínio `@resend.dev` só permite enviar para o email do proprietário da conta. Configurar um domínio próprio requer passos adicionais de DNS.

## Solução Proposta

Criar um fluxo alternativo onde o Admin:
1. Preenche os dados do convidado (nome, email, função)
2. O sistema gera o convite no banco de dados (sem enviar email)
3. Um link de convite é exibido para o Admin copiar
4. O Admin envia o link manualmente (WhatsApp, email pessoal, etc.)

---

## Fluxo do Utilizador

```text
Admin clica "Convidar"
        │
        ▼
Preenche nome, email, função
        │
        ▼
Sistema cria registo na tabela team_invites
        │
        ▼
Modal exibe link copiável: /signup?invite=TOKEN
        │
        ▼
Admin clica "Copiar Link"
        │
        ▼
Admin envia link pelo WhatsApp/Email pessoal
        │
        ▼
Convidado acessa o link e cria conta
```

---

## Alterações na Interface

### InviteUserModal - Novo Estado "Link Gerado"

Após criar o convite com sucesso, em vez de fechar o modal, mostrar uma tela com:

```text
┌──────────────────────────────────────────────────────────┐
│  ✓ Convite Criado                                    [X] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  O convite para João Silva foi criado com sucesso!       │
│                                                          │
│  Copie o link abaixo e envie para o convidado:           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ https://clinic-stride-hub.lovable.app/signup?      │  │
│  │ invite=abc123...                                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│         [ Copiar Link ]  [ Enviar por WhatsApp ]         │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│  Este link expira em 7 dias.                             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                      [ Fechar ]          │
└──────────────────────────────────────────────────────────┘
```

### Aba de Convites Pendentes

Adicionar botão "Copiar Link" em cada convite pendente, permitindo recopiar o link se necessário.

---

## Ficheiros a Modificar

| Ficheiro | Alteração |
|----------|-----------|
| `src/services/TeamService.ts` | Novo método `createInvite` que só cria o convite (sem enviar email) e retorna o token |
| `src/components/settings/InviteUserModal.tsx` | Adicionar estado de "sucesso" com link copiável |
| `src/components/settings/TeamSettingsPanel.tsx` | Adicionar botão "Copiar Link" nos convites pendentes |
| `supabase/functions/send-team-invite/index.ts` | (opcional) Simplificar para não tentar enviar email |

---

## Secção Técnica

### TeamService.ts - Novo Método

```typescript
interface CreateInviteResult {
  success: boolean;
  error?: string;
  inviteUrl?: string;
  token?: string;
}

static async createInvite(data: InviteUserData): Promise<CreateInviteResult> {
  // Obter clinic_id do utilizador atual
  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id')
    .single();

  if (!profile?.clinic_id) {
    return { success: false, error: 'Clínica não encontrada' };
  }

  // Verificar se já existe convite pendente
  const { data: existing } = await supabase
    .from('team_invites')
    .select('id')
    .eq('clinic_id', profile.clinic_id)
    .eq('email', data.email.toLowerCase())
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Já existe um convite pendente para este email' };
  }

  // Criar o convite (o token é gerado automaticamente pelo default da coluna)
  const { data: invite, error } = await supabase
    .from('team_invites')
    .insert({
      clinic_id: profile.clinic_id,
      email: data.email.toLowerCase(),
      full_name: data.full_name,
      role: data.role,
      invited_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select('token')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Construir a URL de convite
  const baseUrl = window.location.origin;
  const inviteUrl = `${baseUrl}/signup?invite=${invite.token}`;

  return { success: true, inviteUrl, token: invite.token };
}

// Método para obter URL de um convite existente
static async getInviteUrl(inviteId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_invites')
    .select('token')
    .eq('id', inviteId)
    .single();

  if (!data?.token) return null;

  const baseUrl = window.location.origin;
  return `${baseUrl}/signup?invite=${data.token}`;
}
```

### InviteUserModal.tsx - Estados do Modal

```typescript
type ModalState = 'form' | 'success';

const [modalState, setModalState] = useState<ModalState>('form');
const [generatedLink, setGeneratedLink] = useState<string>('');

const handleSubmit = async (values: FormData) => {
  setIsSubmitting(true);
  const result = await TeamService.createInvite({
    email: values.email,
    full_name: values.full_name,
    role: values.role,
  });
  setIsSubmitting(false);

  if (result.success && result.inviteUrl) {
    setGeneratedLink(result.inviteUrl);
    setModalState('success');
  } else {
    toast.error(result.error || 'Erro ao criar convite');
  }
};

const handleCopyLink = () => {
  navigator.clipboard.writeText(generatedLink);
  toast.success('Link copiado!');
};

const handleWhatsApp = () => {
  const message = encodeURIComponent(
    `Olá! Você foi convidado para se juntar à nossa clínica. ` +
    `Clique no link para criar sua conta: ${generatedLink}`
  );
  window.open(`https://wa.me/?text=${message}`, '_blank');
};
```

### Visualização do Estado de Sucesso

```tsx
{modalState === 'success' && (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-green-600">
      <CheckCircle className="h-5 w-5" />
      <span className="font-medium">Convite criado com sucesso!</span>
    </div>
    
    <p className="text-sm text-muted-foreground">
      Copie o link abaixo e envie para {form.getValues('full_name')}:
    </p>
    
    <div className="flex gap-2">
      <Input 
        value={generatedLink} 
        readOnly 
        className="font-mono text-xs"
      />
      <Button onClick={handleCopyLink} variant="outline">
        <Copy className="h-4 w-4" />
      </Button>
    </div>
    
    <div className="flex gap-2">
      <Button onClick={handleCopyLink} className="flex-1">
        <Copy className="h-4 w-4 mr-2" />
        Copiar Link
      </Button>
      <Button onClick={handleWhatsApp} variant="outline" className="flex-1">
        <MessageCircle className="h-4 w-4 mr-2" />
        WhatsApp
      </Button>
    </div>
    
    <p className="text-xs text-muted-foreground text-center">
      Este link expira em 7 dias
    </p>
  </div>
)}
```

### TeamSettingsPanel - Botão Copiar em Convites Pendentes

```tsx
// Adicionar no card de cada convite pendente
<Button
  variant="outline"
  size="sm"
  onClick={async () => {
    const url = await TeamService.getInviteUrl(invite.id);
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  }}
>
  <Copy className="h-4 w-4" />
  <span className="sr-only sm:not-sr-only sm:ml-2">Copiar</span>
</Button>
```

---

## Interface da PendingInvite Atualizada

Adicionar `token` ao tipo para facilitar a cópia:

```typescript
export interface PendingInvite {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: string;
  token: string;  // Adicionar
  created_at: string;
  expires_at: string;
}
```

---

## Resumo das Entregas

| Item | Descrição |
|------|-----------|
| Modal atualizado | Mostra link copiável após criar convite |
| Botão WhatsApp | Abre WhatsApp com mensagem pré-formatada |
| Botão Copiar | Em convites pendentes para recopiar link |
| Sem dependência de email | Funciona sem configurar domínio Resend |

---

## Benefícios

- Funciona imediatamente sem configuração de domínio
- Admin tem controle total sobre como enviar o convite
- Ideal para clínicas que usam WhatsApp como canal principal
- Mantém a estrutura de tokens e expiração já implementada
