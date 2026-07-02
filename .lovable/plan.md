## Objetivo
Passar a criar uma notificação no sino também quando o utente confirma a presença (hoje só é criada quando pede remarcação).

## Alterações

### 1. `supabase/functions/confirmar-presenca/index.ts`
No ramo `accao === "confirmar"`, imediatamente após o `update` que grava `confirmacao_estado: "confirmado"` (linhas 97-100), inserir um registo em `notifications`, no mesmo formato do que já existe para a remarcação:

- `clinic_id`: `s.clinic_id`
- `type`: `"confirmacao"`
- `title`: `"Presenca confirmada"`
- `message`: `` `${patientName} confirmou a consulta de ${dataFormatada} as ${horaFormatada}.` ``
- `patient_id`: `s.paciente_id`
- `read`: `false`

Só é criada quando o estado passa efetivamente de não-confirmado para confirmado (o `if (s.confirmacao_estado === "confirmado") return redirectTo(...)` acima já garante que repetições não geram notificações duplicadas).

Nenhuma outra alteração à função. Deploy da função `confirmar-presenca` no fim.

### 2. `src/services/NotificationService.ts`
Adicionar `'confirmacao'` à união de tipos `NotificationType` (fica a par de `'remarcacao'`).

### 3. `src/components/notifications/NotificationItem.tsx`
- Importar `CheckCircle2` do `lucide-react`.
- Acrescentar `confirmacao: CheckCircle2` ao `iconMap`.

O fallback `|| Calendar` já existente continua a proteger tipos desconhecidos.

## Fora do âmbito
- Não mexer no email nem em `send-day-before-reminder`.
- Não criar cron.
- Não alterar prioridade nem lógica de agrupamento (herda o comportamento atual dos alertas de DB — prioridade `medium`, exceto `new_patient`).
