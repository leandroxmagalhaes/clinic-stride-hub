

# Colapsar Lista de Pacientes ao Selecionar Prontuario (Mobile)

## Problema

Na versao mobile (tela pequena), a lista de pacientes e o prontuario ficam empilhados verticalmente. Ao selecionar um paciente, o utilizador precisa descer ate ao final da pagina para ver o prontuario.

## Solucao

Implementar um comportamento de "lista/detalhe" responsivo: em telas pequenas, ao selecionar um paciente, a lista e escondida e so aparece o prontuario com um botao "Voltar" para regressar a lista.

## Detalhes Tecnicos

### Arquivo: `src/pages/Prontuarios.tsx`

1. **Logica de visibilidade mobile**: Quando `selectedProntuario` existe, esconder a coluna da lista de pacientes em mobile (`hidden lg:block`) e mostrar apenas o prontuario. Quando nenhum paciente esta selecionado, mostrar a lista normalmente.

2. **Botao "Voltar a lista"**: Adicionar um botao visivel apenas em mobile (`lg:hidden`) no topo do prontuario, permitindo limpar a selecao e voltar a lista de pacientes.

3. **Classes condicionais**:
   - Lista de pacientes: `className={cn("lg:col-span-4 space-y-4", selectedProntuario && "hidden lg:block")}`
   - Detalhe do prontuario: sempre visivel quando ha selecao
   - O placeholder "Selecione um utente" mantem `hidden lg:block` (nao aparece em mobile sem selecao)

4. **Scroll automatico**: Apos selecionar um paciente em mobile, fazer scroll para o topo da pagina para garantir que o prontuario fica imediatamente visivel.

### Resultado

- **Desktop**: Comportamento inalterado (lista a esquerda, prontuario a direita)
- **Mobile**: Lista desaparece ao selecionar paciente, prontuario aparece de imediato com botao para voltar

