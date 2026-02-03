
# Sistema de Notificações no Sino

## Objetivo

Adicionar funcionalidade ao ícone do sino (🔔) no cabeçalho, mostrando um centro de notificações com alertas relevantes para a clínica.

---

## Tipos de Notificações

O sistema irá agregar notificações de várias fontes já existentes:

| Tipo | Descrição | Prioridade |
|------|-----------|------------|
| 🎂 **Aniversários** | Pacientes aniversariantes hoje | Alta |
| ⚠️ **Relatórios Vencidos** | Relatórios fisioterapêuticos com prazo expirado | Alta |
| 📋 **Relatórios a Vencer** | Relatórios que vencem em 7 dias | Média |
| 📅 **Sessões Hoje** | Resumo das sessões do dia | Info |
| ⏰ **Pacientes Inativos** | Pacientes sem sessões há 30+ dias | Média |

---

## Interface Visual

```text
┌─────────────────────────────────────┐
│  🔔 Notificações                  ✕ │
├─────────────────────────────────────┤
│                                     │
│  🎂 ANIVERSÁRIOS HOJE               │
│  ─────────────────────              │
│  • Maria Silva faz anos hoje        │
│  • João Santos faz anos hoje        │
│                                     │
│  ⚠️ ALERTAS                         │
│  ─────────────────────              │
│  • 2 relatórios com prazo vencido   │
│  • 1 relatório vence em 3 dias      │
│                                     │
│  📅 AGENDA DE HOJE                  │
│  ─────────────────────              │
│  • 8 sessões agendadas              │
│  • 2 confirmadas, 6 pendentes       │
│                                     │
│  ────────────────────────────────── │
│  [Ver Todas] [Marcar como lidas]    │
└─────────────────────────────────────┘
```

---

## Arquitetura

```text
┌──────────────────────────────────────────────────────────────────┐
│                         PersistentHeader                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    NotificationBell                         │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │                NotificationPopover                   │   │  │
│  │  │  ┌───────────────────────────────────────────────┐  │   │  │
│  │  │  │            NotificationItem (x N)             │  │   │  │
│  │  │  └───────────────────────────────────────────────┘  │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

         │
         ▼
┌─────────────────────┐
│ NotificationService │ ◄── Agrega dados de múltiplas fontes
└─────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────────┐
│Pacientes│ │Relatórios      │
│(aniv.)  │ │(prazos)        │
└────────┘ └────────────────┘
    │              │
    ▼              ▼
┌────────┐ ┌────────────────┐
│Sessões │ │EngagementSvc   │
│(hoje)  │ │(inativos)      │
└────────┘ └────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/services/NotificationService.ts` | **Criar** | Serviço para buscar e agregar notificações |
| `src/components/notifications/NotificationBell.tsx` | **Criar** | Componente do sino com popover |
| `src/components/notifications/NotificationItem.tsx` | **Criar** | Item individual de notificação |
| `src/components/layout/PersistentHeader.tsx` | **Modificar** | Substituir botão estático pelo NotificationBell |

---

## Implementação Detalhada

### 1. NotificationService.ts

```typescript
// Tipos de notificação
export type NotificationType = 
  | 'birthday' 
  | 'report_expired' 
  | 'report_expiring' 
  | 'sessions_today'
  | 'inactive_patient';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  link?: string;
  createdAt: Date;
}

// Métodos:
// - getNotifications(): Promise<Notification[]>
// - getBirthdayNotifications()
// - getReportAlerts()
// - getTodaySessions()
// - getInactivePatients()
```

### 2. NotificationBell.tsx

- Usa `Popover` do Radix UI (já instalado)
- Mostra badge com contagem de notificações não lidas
- Lista notificações agrupadas por tipo
- Animação sutil ao haver novas notificações

### 3. NotificationItem.tsx

- Ícone baseado no tipo (🎂, ⚠️, 📅, etc.)
- Cores de acordo com prioridade
- Clique navega para a secção relevante

---

## Comportamento

1. **Carregamento**: Notificações são buscadas ao carregar o header
2. **Badge**: Mostra número de notificações de alta prioridade
3. **Clique**: Abre popover com lista scrollável
4. **Navegação**: Clicar numa notificação leva à página correspondente
5. **Responsivo**: Funciona em mobile com popover adaptado

---

## Navegação por Tipo

| Tipo | Destino ao Clicar |
|------|-------------------|
| Aniversário | `/engajamento` |
| Relatório vencido/a vencer | `/prontuarios` |
| Sessões hoje | `/agenda` |
| Paciente inativo | `/engajamento` |

---

## Resumo Técnico

| Aspecto | Valor |
|---------|-------|
| Complexidade | Média |
| Arquivos criados | 3 |
| Arquivos modificados | 1 |
| Dependências novas | Nenhuma |
| Risco | Baixo |
| Usa banco de dados | Apenas leitura |
