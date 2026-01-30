
# Remover Item "Clínicas" do Menu Lateral

## Problema Identificado

Na linha 116 do arquivo `src/components/layout/AppSidebar.tsx`, existe um item de menu "Clínicas" marcado como desabilitado com badge "Em breve":

```typescript
{ title: "Clínicas", url: "/clinicas", icon: Building2, disabled: true, badge: "Em breve" },
```

Este item está a aparecer no menu mesmo não estando funcional, causando confusão visual.

---

## Solução Proposta

Remover completamente a linha do item "Clínicas" do array `managementNavItems`.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Remover linha 116 (item Clínicas) |

---

## Antes

```typescript
const managementNavItems: NavItem[] = [
  { title: "Serviços", url: "/servicos", icon: Briefcase, module: "servicos" },
  { title: "Comercial", url: "/comercial", icon: TrendingUp, module: "comercial" },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, module: "financeiro" },
  { title: "Engajamento", url: "/engajamento", icon: Heart, module: "engajamento" },
  { title: "Clínicas", url: "/clinicas", icon: Building2, disabled: true, badge: "Em breve" },
];
```

## Depois

```typescript
const managementNavItems: NavItem[] = [
  { title: "Serviços", url: "/servicos", icon: Briefcase, module: "servicos" },
  { title: "Comercial", url: "/comercial", icon: TrendingUp, module: "comercial" },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, module: "financeiro" },
  { title: "Engajamento", url: "/engajamento", icon: Heart, module: "engajamento" },
];
```

---

## Impacto

- **Imediato**: O item "Clínicas" deixa de aparecer no menu
- **Import não utilizado**: O ícone `Building2` pode ser removido dos imports se não for usado em outro lugar

---

## Resumo Técnico

| Aspecto | Avaliação |
|---------|-----------|
| Complexidade | Muito baixa |
| Arquivos modificados | 1 |
| Linhas alteradas | 1-2 |
| Risco | Nenhum |
