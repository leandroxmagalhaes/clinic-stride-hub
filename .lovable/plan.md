
# Botao "Enviar Link de Pre-Registo" na Tela de Pacientes

## Resumo

Adicionar um botao na tela de Pacientes que permite selecionar um utente e enviar-lhe o link de auto-cadastro (`/pre-registo/:token`) por email ou copiar o link para a area de transferencia.

## Abordagem

Como o envio do link requer escolher **qual utente** vai receber, a melhor abordagem e criar um modal simples de selecao:

1. O utilizador clica no botao "Enviar Link"
2. Abre um modal com a lista de utentes (com pesquisa)
3. Ao selecionar um utente, mostra duas opcoes:
   - **Copiar Link** -- copia o URL `/pre-registo/{public_token}` para a area de transferencia
   - **Enviar por Email** -- envia via edge function `send-patient-portal-link` (se o utente tiver email)

## Alteracoes

### 1. Novo componente: `src/components/patients/SendOnboardingLinkModal.tsx`

Modal com:
- Campo de pesquisa para filtrar utentes
- Lista de utentes com nome, telefone e email
- Ao clicar num utente, mostra opcoes de envio
- Botao "Copiar Link" (sempre disponivel)
- Botao "Enviar por Email" (disponivel se tiver email cadastrado)
- Feedback visual de sucesso

### 2. Editar: `src/pages/Pacientes.tsx`

- Importar o novo modal e o icone `Send` do lucide-react
- Adicionar estado `isOnboardingLinkModalOpen`
- Adicionar botao "Enviar Link" na barra de acoes (ao lado de "Importar Planilha" e "Novo Paciente")
- Renderizar o novo modal

### Detalhes tecnicos

- O `public_token` ja existe na tabela `pacientes` (gerado automaticamente)
- O URL do pre-registo sera construido com `window.location.origin + '/pre-registo/' + patient.public_token`
- Para copiar, usa-se `navigator.clipboard.writeText()`
- Para envio por email, reutiliza-se a edge function `send-patient-portal-link` existente, adaptando o conteudo para mencionar "Pre-Registo" em vez de "Portal do Paciente"
- O tipo `Patient` no `PatientService` precisara incluir `public_token` se ainda nao o tiver

### Layout dos botoes (barra de acoes)

```text
[ Enviar Link ]  [ Importar Planilha ]  [ + Novo Paciente ]
```

Em mobile, o texto ficara abreviado ("Link", "Importar", "Novo").
