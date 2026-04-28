# Correção — Impressão/PDF da Anamnese gera apenas 1 página

## Causa raiz

No `src/index.css`, o bloco `@media print` usa:

```css
.anamnese-print-area {
  position: absolute !important;
  left: 0; top: 0; right: 0;
  ...
}
```

Quando um elemento é `position: absolute` durante a impressão, o navegador **retira-o do fluxo do documento** e não consegue paginar corretamente — o resultado é que apenas o conteúdo que cabe na primeira página A4 é renderizado, e tudo o resto fica cortado. Esta é a razão pela qual só aparece 1 página.

A técnica de "esconder tudo via `visibility: hidden`" e revelar apenas `.anamnese-print-area` também é problemática: `visibility: hidden` mantém o espaço ocupado, então os ancestrais escondidos continuam a "consumir" altura e empurram o conteúdo para baixo de formas imprevisíveis.

## Solução

Substituir a estratégia de impressão por uma que:
1. **Não usa `position: absolute`** na área a imprimir → o conteúdo segue o fluxo normal e pagina automaticamente.
2. **Usa `display: none`** (em vez de `visibility: hidden`) para esconder app chrome (sidebar, header, FAB, etc.) — assim o espaço é colapsado.
3. **Garante que cada secção (`.anamnese-section`) não é cortada** entre páginas via `break-inside: avoid`.
4. **Permite quebra de página entre secções grandes** quando necessário.

### Alterações

**`src/index.css`** — substituir o bloco `@media print` existente por:

```css
@media print {
  @page { size: A4; margin: 12mm; }

  /* Reset visual do body para impressão */
  html, body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Esconder app chrome via display:none (colapsa o espaço) */
  .anamnese-print-hide,
  [data-sidebar],
  aside,
  nav,
  header.sticky,
  .fixed,
  button[aria-label*="Copilot" i],
  [role="toolbar"] {
    display: none !important;
  }

  /* Estratégia: em vez de absolute, usar all:revert no container e esconder
     visualmente os irmãos via uma classe utilitária aplicada ao <html>. 
     Mais simples: deixar a área no fluxo natural e remover decoração. */
  .anamnese-print-area {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    color: #1e293b !important;
    box-shadow: none !important;
    border: none !important;
    display: block !important;
  }

  /* Cada secção: não cortar entre páginas */
  .anamnese-section {
    box-shadow: none !important;
    background: white !important;
    border: 1px solid #e2e8f0 !important;
    margin-bottom: 10px !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Remover cores de fundo gradient que não imprimem bem */
  .anamnese-section[style*="gradient"] {
    background: white !important;
  }

  /* Forçar impressão de cores (badges, tags, bordas laterais) */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
}
```

**`src/components/patient-portal/FullQuestionnaireView.tsx`** — pequeno ajuste no `handlePrint` para garantir que ao imprimir adicionamos uma classe ao `<html>` que esconde TUDO exceto a área de impressão. Isto resolve o caso de elementos pais (ex.: tabs, modais, headers) que não temos como prever via seletores CSS:

```tsx
const handlePrint = () => {
  // Marca o documento como "modo impressão de anamnese" — usado pelo CSS
  // para esconder qualquer chrome de app via uma única classe no <html>.
  document.documentElement.classList.add("printing-anamnese");
  
  // Garante que a impressão dispara só após o paint
  requestAnimationFrame(() => {
    window.print();
    // Cleanup imediato após fechar/cancelar diálogo de impressão
    setTimeout(() => {
      document.documentElement.classList.remove("printing-anamnese");
    }, 100);
  });
};
```

E no CSS adicionar a regra complementar:

```css
@media print {
  /* Quando o html tem .printing-anamnese, esconder qualquer coisa que NÃO
     seja ancestral nem descendente da área de impressão. */
  html.printing-anamnese body > *:not(:has(.anamnese-print-area)) {
    display: none !important;
  }
  /* E nos ancestrais directos da área de impressão, remover qualquer
     restrição de altura/overflow que impeça paginação. */
  html.printing-anamnese body,
  html.printing-anamnese body *:has(> .anamnese-print-area),
  html.printing-anamnese :has(.anamnese-print-area) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
}
```

## Garantias

- Conteúdo completo do questionário é impresso, com paginação automática do navegador entre secções.
- Secções não são cortadas a meio entre páginas (`break-inside: avoid`).
- Cores das bordas laterais, badges e tags são preservadas no PDF (`print-color-adjust: exact`).
- Nenhuma alteração ao conteúdo, schema, lógica de gravação ou UI fora do modo impressão.
- O botão "Imprimir / PDF" continua no mesmo lugar com o mesmo comportamento (abre o diálogo nativo do navegador, onde o utilizador pode escolher "Guardar como PDF").

## Ficheiros a editar

1. `src/index.css` — substituir bloco `@media print` da Anamnese.
2. `src/components/patient-portal/FullQuestionnaireView.tsx` — atualizar `handlePrint` para adicionar/remover a classe `printing-anamnese` no `<html>`.
