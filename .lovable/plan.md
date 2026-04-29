## Objetivo

Garantir que o problema do questionário "perdido" (Francisco Chante Vasco) nunca mais acontece em silêncio: detector de rascunho **antes** do utente começar, painel de diagnóstico para a equipa, e mensagem WhatsApp pronta a copiar.

---

## Medida 1 — Detector de rascunho ANTES do início do preenchimento

**Onde:** `src/pages/PortalOnboarding.tsx` (fluxo do utente no portal) e `src/components/patient-portal/DynamicQuestionnaireRenderer.tsx`.

**Comportamento:**

1. Quando o utente abre `/portal/onboarding` e há um `pacienteId`, antes de mostrar qualquer questionário, fazer **uma única consulta** a duas fontes:
   - `localStorage.getItem("portal_questionario_draft:{pacienteId}:{templateId}")` — rascunho local não sincronizado
   - `portal_questionario` no servidor — `respostas`, `updated_at`, `completo`
2. Determinar o estado:
   - **Rascunho servidor** existe e `completo=false` → mostrar banner azul
   - **Apenas rascunho local** (servidor vazio) → mostrar banner amarelo (ainda não foi sincronizado)
   - **Já completo no servidor** → mostrar banner verde "Questionário já submetido em DD/MM/AAAA"
   - **Nada** → seguir fluxo normal
3. Banner aparece **antes** do botão "Começar questionário", com:
   - Ícone + título ("Continuar onde parou" / "Rascunho local detetado" / "Já submetido")
   - Texto "Último guardado: há X minutos / horas / dias" (usar `formatDistanceToNow` do `date-fns/locale/pt`)
   - Botões: **Continuar** (carrega respostas e abre o renderer) e **Começar do zero** (com confirmação dupla)

**Componente novo:** `src/components/patient-portal/DraftDetectionBanner.tsx` — recebe `pacienteId`, `templateId`, callback `onResume(answers)` e `onStartFresh()`.

**Aproveitar:** o `PortalOnboarding.tsx` já tem `resumeData` e `showResumeDialog` para o fluxo de retomar — mas o diálogo aparece **dentro** do questionário. Mover essa lógica para o ecrã inicial, antes de o utente clicar em "Começar".

---

## Medida 2 — Painel de diagnóstico do Portal na ficha do utente

**Onde:** `src/components/patients/PatientPortalTab.tsx` (já existe e está montado no `PatientDetailModal`).

**Visibilidade:** Mostrar apenas se `useUserRole()` indicar `isAdmin` (admin/admin_master) **ou** `isProfessional`. Esconder para roles `secretary` (já não vê outras coisas sensíveis) e `patient`.

**Conteúdo do painel "Diagnóstico técnico" (Collapsible fechado por defeito):**

1. **Estado do questionário no servidor:**
   - `portal_questionario` row: existe? `completo`? `updated_at`?
   - Tamanho do `respostas` (`Object.keys(respostas).length` secções com conteúdo)
   - Aviso vermelho se `respostas = {}` E existe convite usado: "Atenção — convite foi usado mas nenhuma resposta chegou ao servidor."

2. **Histórico de convites (todos, não só o último):**
   - Tabela compacta: data | enviado para | status (pendente / utilizado / expirado) | tentativas
   - Lê `portal_convites` por `paciente_id`, ordenado por `created_at desc`, limite 10

3. **Histórico de alterações (`portal_questionario_historico`):**
   - Última 5 entradas: campo alterado, valor anterior → novo, alterado por, quando

4. **Conta portal:**
   - `auth_user_id`, `email`, `provider`, `ultimo_acesso`, `onboarding_completo`
   - Lista de utentes associados a esta conta (`portal_conta_pacientes`) — útil quando pais/mães usam a mesma conta para vários filhos

5. **Ação de recuperação manual:**
   - Botão "Importar respostas de rascunho local" — explica que só funciona se feito no mesmo dispositivo e abre prompt para colar JSON do localStorage. Permite gravar via `upsert_portal_questionnaire`.

**Lógica de role check:**
```ts
const { isAdmin, isProfessional } = useUserRole();
const showDiagnostics = isAdmin || isProfessional;
```

---

## Medida 3 — Mensagem WhatsApp pronta a copiar

**Onde:** Botão dentro do `PatientPortalTab.tsx`, perto de "Copiar link" e "Enviar Link do Portal".

**Comportamento:**

1. Botão "Mensagem WhatsApp" abre um diálogo simples com:
   - Textarea pré-preenchida (read-only ou editável) com o template:
     ```
     Olá {primeiroNome},

     Aqui está o seu acesso ao Portal Physione para preencher o questionário do/a {nomeUtente}:

     🔗 {link}
     🔢 Código: {codigo}

     ⚠️ Importante: o link expira em 48h e tem 3 tentativas.
     Se já tinha começado a preencher noutro dispositivo, o sistema vai detetar e oferecer continuar.

     Qualquer dúvida, responda a esta mensagem.
     ```
   - Botão grande "Copiar mensagem" (usa `navigator.clipboard.writeText`)
   - Botão secundário "Abrir WhatsApp" — gera `https://wa.me/{telefone}?text={encodeURIComponent(mensagem)}` (usa o telefone do utente já com prefixo 351)

2. Substituições dinâmicas:
   - `{primeiroNome}` — primeiro nome do destinatário (do convite ou do utente)
   - `{nomeUtente}` — nome completo do utente
   - `{link}` — `getPublicBaseUrl() + "/portal/" + lastInvite.link_token`
   - `{codigo}` — `lastInvite.codigo`

3. Se não houver convite válido, o botão fica desabilitado com tooltip "Gere primeiro um convite".

---

## Resumo dos ficheiros tocados

**Novos:**
- `src/components/patient-portal/DraftDetectionBanner.tsx`
- `src/components/patients/PortalDiagnosticsPanel.tsx`
- `src/components/patients/WhatsAppMessageDialog.tsx`

**Modificados:**
- `src/pages/PortalOnboarding.tsx` — integrar `DraftDetectionBanner` antes do `DynamicQuestionnaireRenderer`
- `src/components/patients/PatientPortalTab.tsx` — adicionar `PortalDiagnosticsPanel` (gated por role) e botão "Mensagem WhatsApp"

**Sem migrations de DB.** Tudo usa tabelas que já existem (`portal_questionario`, `portal_convites`, `portal_questionario_historico`, `portal_contas`, `portal_conta_pacientes`).

**Sem alterações ao questionário do Francisco Cação Costa** — está completo, fica intacto.

---

## Riscos e limitações honestas

- O detector de rascunho local **só funciona no mesmo dispositivo + mesmo browser** onde o utente preencheu. Se o pai começou no telemóvel e abre noutro lado, o `localStorage` está vazio nesse novo dispositivo. O painel de diagnóstico ajuda a equipa a perceber isto rapidamente.
- A "importação manual de rascunho" no painel de diagnóstico exige que o utente envie o JSON do `localStorage` (instruções claras serão dadas) — é uma rede de segurança, não a solução principal. A solução principal é o autosave já ativo.
