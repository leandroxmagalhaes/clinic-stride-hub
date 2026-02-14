
# Fechar Menu Lateral Automaticamente ao Navegar (Mobile)

## Problema

No mobile, ao clicar num item do menu lateral, a navegacao acontece mas o menu continua aberto, obrigando o utilizador a fecha-lo manualmente.

## Solucao

Utilizar o hook `useSidebar` para fechar o menu automaticamente apos o clique num link de navegacao, apenas em dispositivos moveis.

## Detalhes Tecnicos

### Arquivo: `src/components/layout/AppSidebar.tsx`

1. Importar `useSidebar` de `@/components/ui/sidebar`
2. No componente `NavItem`, chamar `useSidebar()` para obter `setOpenMobile` e `isMobile`
3. Adicionar um `onClick` no `Link` que executa `setOpenMobile(false)` quando `isMobile` e verdadeiro
4. Isto garante que no desktop o comportamento permanece inalterado

### Resultado

- **Mobile**: Menu fecha automaticamente ao selecionar uma pagina
- **Desktop**: Comportamento inalterado (sidebar permanece visivel)
