
# Correção: Erro "SelectItem must have a value prop that is not an empty string"

## Diagnóstico

O erro acontece quando o utilizador clica no botão "Reservar" (cadeado) na página da Agenda. A aplicação quebra devido a um problema no componente `NewReservedSlotModal.tsx`.

### Causa Raiz

O Radix UI Select **não permite** que `<SelectItem>` tenha `value=""` (string vazia). Esta string é reservada para limpar a seleção e mostrar o placeholder.

Linhas problemáticas em `NewReservedSlotModal.tsx`:

```text
Linha 425-427:
<SelectItem value="" className="min-h-[44px]">
  Qualquer profissional
</SelectItem>

Linha 445-447:
<SelectItem value="" className="min-h-[44px]">
  Qualquer serviço
</SelectItem>
```

## Solução

Substituir `value=""` por um valor placeholder especial (ex: `"__none__"`) e ajustar a lógica para converter este valor de volta para `null` quando necessário.

### Alterações no NewReservedSlotModal.tsx

1. **Linha 425-427** - SelectItem de Profissional:
   - Antes: `value=""`
   - Depois: `value="__none__"`

2. **Linha 445-447** - SelectItem de Serviço:
   - Antes: `value=""`
   - Depois: `value="__none__"`

3. **Handler onValueChange** - Converter `"__none__"` para string vazia:
   - Linha 420: `onValueChange={(v) => setSelectedProfessional(v === "__none__" ? "" : v)}`
   - Linha 440: `onValueChange={(v) => setSelectedService(v === "__none__" ? "" : v)}`

4. **Valor do Select** - Converter string vazia de volta para `"__none__"`:
   - Linha 420: `value={selectedProfessional || "__none__"}`
   - Linha 440: `value={selectedService || "__none__"}`

### Resumo de Ficheiros

| Ficheiro | Alteração |
|----------|-----------|
| `src/components/agenda/NewReservedSlotModal.tsx` | Corrigir valores vazios em SelectItem |

## Resultado Esperado

Após a correção:
1. O modal "Novo Horário Reservado" abrirá sem erros
2. Os campos opcionais (Profissional e Serviço) funcionarão corretamente com opção "Qualquer"
3. A aplicação não crashará ao clicar no botão Reservar

## Créditos Estimados: 1
