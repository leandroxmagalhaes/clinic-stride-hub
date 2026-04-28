## Objetivo

Tornar a coluna de pacientes (lista do meio) na página `Prontuários` recolhível, libertando espaço para a área principal (ficha/anamnese), com persistência em localStorage. Apenas frontend, apenas em `Prontuarios.tsx`.

## Estrutura atual (resumo)

`src/pages/Prontuarios.tsx` usa um grid responsivo:

```text
<div class="grid lg:grid-cols-12 gap-6">
  <div class="lg:col-span-4">  ← lista de pacientes
  <div class="lg:col-span-8">  ← área principal (ficha)
</div>
```

Em mobile, já existe lógica de esconder a lista quando há paciente seleccionado (`hidden lg:block`). Vamos preservar isso — o toggle só actua em `lg:` e acima.

## Alterações (ficheiro único: `src/pages/Prontuarios.tsx`)

### 1. Estado persistente

Adicionar:

```ts
const [patientsCollapsed, setPatientsCollapsed] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("prontuarios-patients-collapsed") === "true";
});

useEffect(() => {
  localStorage.setItem("prontuarios-patients-collapsed", String(patientsCollapsed));
}, [patientsCollapsed]);
```

### 2. Importar ícones

Adicionar `PanelLeftClose` e `PanelLeftOpen` ao import do `lucide-react`.

### 3. Tornar o grid dinâmico

Trocar as classes fixas pelas condicionais:

- Wrapper grid: manter `grid grid-cols-1 lg:grid-cols-12 gap-6`.
- Lista (col esquerda):
  - Quando expandida: `lg:col-span-4` (atual).
  - Quando recolhida: `hidden` em todos os breakpoints onde `lg:` aplica (i.e. `lg:hidden`), mas mantendo o comportamento mobile actual (`hidden lg:block` quando há paciente).
  - Combinação: `selectedProntuario && "hidden lg:block"` + `patientsCollapsed && "lg:hidden"`.
- Área principal (col direita):
  - Quando expandida: `lg:col-span-8` (atual).
  - Quando recolhida: `lg:col-span-12`.
- Adicionar `transition-all duration-300` na coluna principal para a expansão ser suave.

### 4. Botão de recolher (dentro da lista)

No topo do `Card` de pesquisa (à direita do `Input`), adicionar um botão pequeno e discreto:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="hidden lg:inline-flex h-8 w-8 text-muted-foreground hover:text-primary"
  onClick={() => setPatientsCollapsed(true)}
  title="Recolher lista de utentes"
  aria-label="Recolher lista de utentes"
>
  <PanelLeftClose className="h-4 w-4" />
</Button>
```

Layout: envolver o `Search`+`Input` e o botão num `flex items-center gap-2`.

### 5. Botão de expandir (dentro da área principal)

Quando `patientsCollapsed === true`, mostrar um botão flutuante no canto superior esquerdo da área principal — acima do header do paciente — visível apenas em `lg:`:

```tsx
{patientsCollapsed && (
  <Button
    variant="outline"
    size="sm"
    className="hidden lg:inline-flex gap-2 mb-2 text-muted-foreground hover:text-primary"
    onClick={() => setPatientsCollapsed(false)}
    title="Mostrar lista de utentes"
  >
    <PanelLeftOpen className="h-4 w-4" />
    Mostrar utentes
  </Button>
)}
```

Posição: dentro da `div` da coluna direita, antes do `Card` de header do paciente; também aparece quando não há paciente seleccionado (estado vazio), para que o utilizador possa sempre re-expandir.

### 6. Atalho de teclado (opcional, trivial)

`Ctrl/Cmd + \` para alternar — só activo na rota `Prontuarios`:

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
      e.preventDefault();
      setPatientsCollapsed((v) => !v);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

## Garantias de não regressão

- Nenhuma query, serviço, contexto ou tabela é tocada.
- Nenhuma outra página partilha este layout — alteração isolada a `src/pages/Prontuarios.tsx`.
- Mobile (`< lg`): comportamento idêntico ao actual (lista esconde quando há paciente; botão "Voltar à lista" continua a funcionar). O botão de recolher tem `hidden lg:inline-flex`, logo nunca aparece em mobile.
- Sidebar global do Physione: não tocada.

## Validação

- Em desktop, botão `PanelLeftClose` aparece no topo da lista; clicar recolhe e a ficha expande para 100%.
- Botão `PanelLeftOpen` aparece no canto superior esquerdo da ficha; clicar restaura a lista.
- Transição animada (300ms) entre estados.
- Refresh da página mantém o estado (localStorage).
- Em mobile, nada muda visualmente vs hoje.
- Outras páginas inalteradas.
