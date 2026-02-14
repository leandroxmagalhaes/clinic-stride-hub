
# NIF Obrigatorio com Opcao "Ainda nao possuo NIF"

## Resumo

Manter o NIF como campo obrigatorio, mas adicionar um checkbox "Ainda nao possuo NIF" que desbloqueia a submissao sem NIF. Quando marcado, o sistema regista que o utente precisa atualizar o NIF futuramente.

## Comportamento

1. Por defeito, o NIF e obrigatorio (com asterisco)
2. Abaixo do campo NIF, aparece um checkbox: "Ainda nao possuo NIF (ex: bebe/crianca)"
3. Ao marcar o checkbox:
   - O campo NIF fica desativado e limpo
   - A validacao de NIF e ignorada na submissao
   - Aparece um aviso amarelo: "Lembre-se de atualizar o cadastro assim que obtiver o NIF."
4. O formulario submete normalmente com `cpf: null`
5. Na listagem de pacientes, utentes sem NIF ficam sinalizados para lembrar a clinica

## Alteracoes

### 1. Frontend: `src/pages/PreRegisto.tsx`

- Adicionar estado `noNif` (boolean, default false)
- Adicionar checkbox "Ainda nao possuo NIF" abaixo do campo NIF
- Quando `noNif = true`:
  - Desativar e limpar o campo NIF
  - Mostrar alerta informativo amarelo com lembrete
- Ajustar validacao no `handleSubmit`:
  - Se `noNif` e false: NIF obrigatorio com 9 digitos (logica atual)
  - Se `noNif` e true: ignorar validacao de NIF

### 2. Edge Function: `patient-onboarding/index.ts`

- Remover a validacao server-side que exige NIF (o campo `cpf` ja e nullable na base de dados)
- Manter apenas a validacao de formato (9 digitos) quando o valor e fornecido

### 3. Sinalizacao na listagem (opcional, fase futura)

- Utentes sem NIF podem ser identificados na tela de Pacientes com um badge "NIF em falta" para facilitar o acompanhamento

## Resultado

- A grande maioria dos utentes preenche o NIF normalmente (sem opcao de "saltar")
- Casos excepcionais (bebes) conseguem completar o registo
- O lembrete visual incentiva a atualizacao futura
- Sem retrabalho para a clinica na maioria dos casos
