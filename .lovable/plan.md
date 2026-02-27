

# Plano: Notificacoes em Tempo Real com Tabela Dedicada

## Resumo

Criar uma tabela `notifications` na base de dados, atualizar a Edge Function `patient-onboarding` para inserir notificacoes ao registar novos utentes, e reescrever o `NotificationBell` para combinar as notificacoes agregadas existentes com as notificacoes persistentes da nova tabela, incluindo Realtime e toasts.

---

## 1. Criar tabela `notifications` (Migration)

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  patient_id uuid REFERENCES pacientes(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON notifications(clinic_id, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic members can manage notifications"
ON notifications FOR ALL
USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Ativar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

---

## 2. Edge Function `patient-onboarding/index.ts`

No bloco POST do modo `clinic_id` (linhas 123-136):

- Trocar `.insert(insertData)` por `.insert(insertData).select("id").single()`
- Apos INSERT bem-sucedido, inserir notificacao na tabela `notifications` usando service role
- Retornar `{ success: true, patient_id: newPatient.id }`

---

## 3. Atualizar `NotificationService.ts`

Adicionar novo tipo `new_patient` ao `NotificationType`.

Adicionar dois metodos:
- `getDbNotifications()`: busca notificacoes nao lidas da tabela `notifications`
- `markAsRead(id)` e `markAllAsRead()`: atualiza o campo `read`

Atualizar `getNotifications()` para combinar notificacoes agregadas existentes com as da tabela.

---

## 4. Reescrever `NotificationBell.tsx`

Manter a estrutura visual atual (popover com categorias), mas adicionar:
- Subscricao Realtime ao montar, filtrada por `clinic_id`
- Quando chega notificacao nova via Realtime, adiciona-la ao estado e mostrar toast com acao "Ver ficha"
- Botao "Marcar todas como lidas" no footer do dropdown
- Clicar numa notificacao `new_patient` navega para `/pacientes?id={patient_id}&edit=true` e marca como lida

---

## 5. Atualizar `NotificationItem.tsx`

Adicionar suporte ao novo tipo `new_patient`:
- Icone `UserPlus` para notificacoes de novo utente
- Tempo relativo usando `date-fns` (`formatDistanceToNow`)
- Handler de clique que marca como lida e navega

---

## 6. Nenhuma alteracao no layout

O `NotificationBell` ja esta integrado no `PersistentHeader.tsx` (linha 36). Nao e necessario alterar o layout.

---

## Sequencia de Implementacao

1. Migration: criar tabela `notifications` + RLS + Realtime
2. Edge Function: atualizar `patient-onboarding` para inserir notificacao
3. Service: estender `NotificationService` com metodos de DB
4. Componentes: atualizar `NotificationBell` e `NotificationItem` com Realtime + toast

---

## Ficheiros a Editar

| Ficheiro | Acao |
|---|---|
| Migration SQL | Criar tabela `notifications` |
| `supabase/functions/patient-onboarding/index.ts` | INSERT com `.select("id").single()` + notificacao |
| `src/services/NotificationService.ts` | Novos metodos DB + tipo `new_patient` |
| `src/components/notifications/NotificationBell.tsx` | Realtime + toast + mark as read |
| `src/components/notifications/NotificationItem.tsx` | Tipo `new_patient` + tempo relativo |

