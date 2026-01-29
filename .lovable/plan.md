
# Plano de Implementação - Funcionalidades Adicionais

Este plano aborda 4 módulos independentes que serão implementados com cuidado para não impactar a estrutura existente.

---

## 1. Sistema de Envio de Emails (Resend)

### Objetivo
Enviar emails transacionais para pacientes: confirmação de agendamento, lembrete 24h antes, e link do portal.

### Pré-requisitos
- Criar conta em resend.com
- Validar domínio de email em resend.com/domains
- Gerar API key em resend.com/api-keys

### Implementação

**Passo 1 - Configurar Secret**
- Adicionar `RESEND_API_KEY` como secret do projeto

**Passo 2 - Edge Functions**
Criar 3 funções backend:

| Função | Trigger | Descrição |
|--------|---------|-----------|
| `send-appointment-confirmation` | Manual (ao criar sessão) | Envia confirmação imediata |
| `send-appointment-reminder` | Agendado (Cron) | Envia 24h antes da sessão |
| `send-patient-portal-link` | Manual | Envia link de acesso ao portal |

**Passo 3 - Templates de Email**
Usar React Email para templates bonitos com:
- Logo da clínica
- Dados da sessão (data, hora, profissional, serviço)
- Link para confirmar/cancelar
- Dados de contato da clínica

**Passo 4 - Integração no Frontend**
- Chamar edge function após criar sessão em `Agenda.tsx`
- Adicionar botão "Enviar Link do Portal" em `PatientDetailModal.tsx`

---

## 2. Páginas Legais (LGPD/GDPR)

### Objetivo
Conformidade legal com proteção de dados para Portugal e Brasil.

### Implementação

**Passo 1 - Migração de Banco de Dados**
Adicionar campo `privacy_consent_at` na tabela `pacientes`:
```
ALTER TABLE public.pacientes 
ADD COLUMN privacy_consent_at timestamptz DEFAULT NULL;
```

**Passo 2 - Páginas Públicas**
Criar 2 novas páginas em `src/pages/`:

| Rota | Arquivo | Conteúdo |
|------|---------|----------|
| `/privacy` | `PrivacyPolicy.tsx` | Política de Privacidade |
| `/terms` | `TermsOfService.tsx` | Termos de Uso |

**Conteúdo da Política de Privacidade:**
- Dados coletados (nome, email, telefone, dados de saúde)
- Finalidade do tratamento
- Base legal (consentimento, contrato)
- Tempo de retenção
- Direitos do titular (acesso, retificação, exclusão, portabilidade)
- Medidas de segurança
- Contacto do responsável

**Passo 3 - Checkbox de Consentimento**
Atualizar `Pacientes.tsx` para incluir checkbox obrigatório:
```
[ ] Li e aceito a Política de Privacidade
```

**Passo 4 - Footer Global**
Criar componente `AppFooter.tsx` com links para `/privacy` e `/terms`

---

## 3. Sistema de Backup/Exportação

### Objetivo
Permitir exportação manual de dados em formato CSV compactado.

### Implementação

**Passo 1 - Nova Aba em Configurações**
Adicionar aba "Backup" em `Configuracoes.tsx`

**Passo 2 - Componente de Backup**
Criar `BackupSettingsPanel.tsx` com:
- Botão "Exportar Dados"
- Lista do que será exportado
- Aviso de recomendação semanal
- Histórico de últimos backups (opcional)

**Passo 3 - Edge Function de Export**
Criar `export-clinic-data`:
- Gera CSV de pacientes
- Gera CSV de agendamentos (sessões)
- Gera CSV de transações de crédito
- Empacota em ZIP
- Nome: `backup_YYYY-MM-DD_HH-mm.zip`

**Passo 4 - Download no Frontend**
- Chamar edge function
- Converter resposta em blob
- Disparar download automático

**Dependências:**
- JSZip ou similar (pode ser feito no edge function com Deno)

---

## 4. Integração Sentry (Monitoramento de Erros)

### Objetivo
Capturar e reportar erros JavaScript e de API automaticamente.

### Pré-requisitos
- Criar conta em sentry.io
- Criar projeto React
- Obter DSN

### Implementação

**Passo 1 - Instalar SDK**
Adicionar `@sentry/react` como dependência

**Passo 2 - Configurar Secret**
- Adicionar `VITE_SENTRY_DSN` como variável de ambiente (público, pode estar no código)

**Passo 3 - Inicializar Sentry**
Atualizar `main.tsx`:
```tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

**Passo 4 - Error Boundary**
Envolver app com `Sentry.ErrorBoundary` para capturar erros React

**Passo 5 - Captura de Erros de API**
Adicionar interceptor no cliente Supabase para reportar erros

**Passo 6 - Configurar Alertas**
No dashboard do Sentry, configurar alertas por email para erros críticos

---

## Resumo de Arquivos

### Novos Arquivos
| Arquivo | Propósito |
|---------|-----------|
| `supabase/functions/send-appointment-confirmation/index.ts` | Email de confirmação |
| `supabase/functions/send-appointment-reminder/index.ts` | Email de lembrete |
| `supabase/functions/send-patient-portal-link/index.ts` | Email com link do portal |
| `supabase/functions/send-appointment-confirmation/_templates/confirmation.tsx` | Template React Email |
| `supabase/functions/export-clinic-data/index.ts` | Exportar dados em ZIP |
| `src/pages/PrivacyPolicy.tsx` | Página de privacidade |
| `src/pages/TermsOfService.tsx` | Página de termos |
| `src/components/layout/AppFooter.tsx` | Footer com links legais |
| `src/components/settings/BackupSettingsPanel.tsx` | Painel de backup |

### Arquivos Modificados
| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rotas `/privacy`, `/terms`, Sentry |
| `src/main.tsx` | Inicializar Sentry |
| `src/pages/Pacientes.tsx` | Checkbox de consentimento |
| `src/pages/Configuracoes.tsx` | Aba de Backup |
| `src/pages/Agenda.tsx` | Chamar email de confirmação |

### Migrações de Banco
```sql
-- Adicionar campo de consentimento
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz DEFAULT NULL;
```

---

## Ordem de Implementação Recomendada

1. **Páginas Legais** (sem dependências externas)
2. **Sistema de Backup** (sem dependências externas)
3. **Sentry** (requer DSN)
4. **Emails com Resend** (requer API key + domínio validado)

---

## Secção Técnica

### Estrutura Edge Function (Email)
```typescript
// supabase/functions/send-appointment-confirmation/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  const { patientEmail, patientName, appointmentDate, ... } = await req.json();
  
  await resend.emails.send({
    from: "Respira & Desenvolve <noreply@seu-dominio.pt>",
    to: [patientEmail],
    subject: "Confirmação de Agendamento",
    html: "..." // Template
  });
});
```

### Estrutura Export (CSV + ZIP)
```typescript
// supabase/functions/export-clinic-data/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import JSZip from "npm:jszip";

serve(async (req) => {
  // Fetch data from DB
  // Convert to CSV
  // Create ZIP
  // Return as download
});
```

### Sentry Config
```typescript
// main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```
