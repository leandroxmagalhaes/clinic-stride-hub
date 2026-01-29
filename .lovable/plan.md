

# Plano de Correção - Menu Lateral na Página Comercial

## Problema Identificado

A página **Comercial** não possui o menu lateral porque não está a utilizar o componente `AppLayout`, que é responsável por renderizar a sidebar em todas as outras páginas.

## Comparação

| Página | Usa AppLayout | Menu Lateral |
|--------|---------------|--------------|
| Dashboard | Sim | Visível |
| Agenda | Sim | Visível |
| Pacientes | Sim | Visível |
| Engajamento | Sim | Visível |
| **Comercial** | **Não** | **Ausente** |

## Solução

Envolver o conteúdo da página Comercial com o componente `AppLayout`, seguindo o mesmo padrão das demais páginas.

---

## Ficheiro a Modificar

**`src/pages/Comercial.tsx`**

### Alterações Necessárias

1. Adicionar import do `AppLayout`
2. Envolver o conteúdo existente com `<AppLayout>`
3. Mover título e subtítulo para as props do AppLayout (opcional, para consistência)

---

## Antes vs Depois

### Antes (atual)
```tsx
export default function Comercial() {
  // ... código do componente ...
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Comercial (CRM)</h1>
          ...
```

### Depois (corrigido)
```tsx
import { AppLayout } from "@/components/layout/AppLayout";

export default function Comercial() {
  // ... código do componente ...
  
  return (
    <AppLayout 
      title="Comercial (CRM)" 
      subtitle="Gerencie seus leads e funil de vendas"
    >
      <div className="space-y-6">
        {/* Resto do conteúdo */}
        ...
```

---

## Resultado Esperado

Após a correção:
- Menu lateral aparecerá na página Comercial
- Layout consistente com todas as outras páginas
- Header com título será gerido pelo AppLayout (padrão do sistema)

---

## Secção Técnica

### Alteração Específica

```typescript
// Linha 1: Adicionar import
import { AppLayout } from "@/components/layout/AppLayout";

// Linha 172-174: Trocar div por AppLayout
return (
  <AppLayout 
    title="Comercial (CRM)" 
    subtitle="Gerencie seus leads e funil de vendas"
  >
    <div className="space-y-6">
      {/* Remover o header manual pois AppLayout já gerencia o título */}
      
      {/* Dashboard Stats */}
      <CRMDashboard leads={leads} />
      
      {/* Resto do conteúdo permanece igual */}
      ...
    </div>
  </AppLayout>
);
```

### Header Ajustado

O header manual com `<h1>` pode ser simplificado, mantendo apenas os botões de ação, já que o `AppLayout` exibe o título na barra superior. Porém, para manter consistência visual com as demais páginas que têm headers próprios, podemos manter apenas os botões no header interno.

---

## Resumo

| Ação | Detalhe |
|------|---------|
| Import | Adicionar `AppLayout` |
| Wrapper | Envolver conteúdo com `<AppLayout>` |
| Props | `title="Comercial (CRM)"`, `subtitle="Gerencie seus leads e funil de vendas"` |

