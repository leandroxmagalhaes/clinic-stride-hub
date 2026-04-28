## Problema

Na página `Pacientes`, os 6 botões de acção são passados via `AppLayout actions` → renderizados na `PersistentHeader` (header global, sticky, h-14). A header também contém: SidebarTrigger, título "Pacientes" + contador, campo global "Buscar..." (w-64) e o sino de notificações. Em 1560px largo, o conjunto de botões não cabe e sobrepõe-se visualmente ao título, ao input de busca e ao sino.

## Solução

Mover a barra de acções da página `Pacientes` para **fora** da header global, transformando-a numa **toolbar dedicada no topo do conteúdo da página** (Linha 2). A header global passa a mostrar apenas título + subtítulo + busca global + sino (Linha 1, sem sobreposição).

Alteração isolada a `src/pages/Pacientes.tsx`. Nenhum outro ficheiro tocado. Funcionalidade dos botões preservada — só muda onde são renderizados.

## Alterações em `src/pages/Pacientes.tsx`

### 1. Remover `actions` do `AppLayout`

Tanto no estado de `isLoading` (linhas ~347-364) como no return principal (linhas ~368-429), retirar a prop `actions` do `<AppLayout>`. Manter `title` e `subtitle`.

### 2. Extrair os botões para um JSX local

Definir um bloco `actionsBar` (ou inline no JSX) com os mesmos 6 botões e a mesma lógica `onClick` actual — copiar tal e qual de dentro de `actions={...}`:

- Verificar Duplicados
- Relatório
- Link Genérico (com estado `genericLinkCopied`)
- Enviar Link
- Importar Planilha
- + Novo Paciente

Sem alterar handlers, ícones, labels ou estados.

### 3. Render no topo do `children`

Dentro do return, renderizar a toolbar como primeiro filho do conteúdo, antes do `Card` de pesquisa:

```tsx
<AppLayout title="Pacientes" subtitle={`${patients.length} pacientes cadastrados`}>
  <div className="space-y-4 animate-fade-in">
    {/* Linha 2: toolbar de acções da página */}
    <div className="flex items-center gap-2 flex-wrap">
      {/* botões aqui */}
    </div>

    <Card className="shadow-card">
      {/* campo de pesquisa local existente */}
      ...
    </Card>
    ...
  </div>
</AppLayout>
```

Classes da toolbar: `flex items-center gap-2 flex-wrap` — em ecrãs estreitos, os botões quebram naturalmente para a linha seguinte. Mantém a aparência visual (mesmos `variant="outline"` / default, mesmos ícones), só muda o contentor.

### 4. Estado `isLoading`

No ramo de `isLoading`, fazer o mesmo: remover `actions` do `AppLayout` e renderizar uma versão `disabled` resumida da toolbar (Importar + Novo Paciente, como hoje) acima do `<TableSkeleton />`.

## Garantias de não regressão

- Lógica, queries, handlers, modais e estados (`genericLinkCopied`, `isModalOpen`, etc.) mantêm-se idênticos.
- Outras páginas (Agenda, Prontuários, Dashboard, etc.) continuam a usar `AppLayout actions` normalmente — não são tocadas.
- A `PersistentHeader` global e o `AppLayout` não são alterados — apenas a página `Pacientes` deixa de usar a slot `actions`.
- Mobile: o `flex-wrap` garante que os botões quebram para várias linhas; classes `sm:hidden`/`hidden sm:inline` dos labels já existentes continuam a encurtar os botões em mobile.

## Validação visual

- [ ] Header global em `/pacientes` mostra apenas: trigger sidebar, "Pacientes" + "242 pacientes cadastrados", campo busca global, sino — sem sobreposição.
- [ ] Logo abaixo do header surge a fila com os 6 botões de acção, alinhada à esquerda, com `gap` consistente.
- [ ] Em viewports < 1024px os botões quebram para múltiplas linhas (`flex-wrap`).
- [ ] Cada botão mantém comportamento (abrir modal correspondente, copiar link, etc.).
- [ ] Outras páginas inalteradas — header continua a mostrar acções dessas páginas.
