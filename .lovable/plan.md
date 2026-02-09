
# Plano de Correção: Sistema de Horários Reservados

## Diagnóstico

Após análise detalhada, identifiquei que o sistema de horários reservados foi criado mas **não está a funcionar** devido a problemas de arquitetura de dados.

### Problema Principal: Incompatibilidade de Foreign Keys

A tabela `horarios_reservados` foi criada com uma foreign key `professional_id` que aponta para a tabela `profissionais`. No entanto, **a aplicação usa profissionais da tabela `profiles`** (filtrados por role).

```text
SITUAÇÃO ATUAL:
─────────────────────────────────────────
horarios_reservados.professional_id
         ↓ (FK)
    profissionais.id  ← TABELA ERRADA

DataContext.professionals vem de:
    profiles.id (role = 'fisioterapeuta'/'admin'/'professional')
```

Quando um utilizador tenta criar uma reserva:
1. Seleciona um profissional (ID vem de `profiles`)
2. Tenta gravar na tabela `horarios_reservados`
3. A FK falha porque o ID não existe em `profissionais`

### Problema Secundário: Queries de JOIN Incorretas

O `ReservedSlotService.ts` usa:
```typescript
professional:profissionais!professional_id(...)
```

Deveria usar o padrão do `DataContext`:
```typescript
professional:profiles!horarios_reservados_professional_id_fkey(...)
```

---

## Solução Proposta

### Fase 1: Corrigir Foreign Key no Banco de Dados

Alterar a FK `horarios_reservados_professional_id_fkey` para apontar para `profiles.id` em vez de `profissionais.id`.

```sql
-- Remover FK antiga
ALTER TABLE public.horarios_reservados
DROP CONSTRAINT horarios_reservados_professional_id_fkey;

-- Criar FK correta apontando para profiles
ALTER TABLE public.horarios_reservados
ADD CONSTRAINT horarios_reservados_professional_id_fkey
FOREIGN KEY (professional_id) REFERENCES public.profiles(id);
```

### Fase 2: Corrigir ReservedSlotService.ts

Atualizar todas as queries para usar o padrão correto de JOIN:

```typescript
// ANTES (incorreto):
professional:profissionais!professional_id(id, full_name)

// DEPOIS (correto):
professional:profiles!horarios_reservados_professional_id_fkey(id, full_name)
```

Métodos afetados:
- `fetchAll()`
- `fetchActive()`
- `fetchByPatient()`
- `create()`
- `update()`

### Fase 3: Adicionar Tratamento de Erros no Hook

Melhorar o `useReservedSlots.ts` para mostrar erros de forma mais clara:

```typescript
const createReservedSlot = useCallback(async (data: CreateReservedSlotData) => {
  try {
    const newSlot = await ReservedSlotService.create(data);
    setReservedSlots(prev => [newSlot, ...prev]);
    toast.success("Horário reservado com sucesso!");
    return newSlot;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar reserva";
    toast.error(message);
    throw err;
  }
}, []);
```

---

## Resumo de Alterações

| Arquivo/Recurso | Tipo | Descrição |
|-----------------|------|-----------|
| Migração SQL | BD | Corrigir FK para apontar para `profiles` |
| `ReservedSlotService.ts` | TS | Corrigir JOINs nas queries |
| `useReservedSlots.ts` | TS | Adicionar feedback de erros |

---

## Créditos Estimados: 2

| Item | Créditos |
|------|----------|
| Migração SQL | 1 |
| Correções TypeScript | 1 |
| **Total** | **2** |

---

## Resultado Esperado

Após as correções:
1. O botão "Reservar" criará slots corretamente no banco
2. Os slots aparecerão na grelha da agenda com o ícone de cadeado
3. Erros serão mostrados via toast se algo falhar
