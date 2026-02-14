

# Link Generico de Pre-Registo para Novos Utentes

## Resumo

Criar um link generico por clinica (sem associacao a utente existente) que permite a qualquer pessoa preencher o formulario de pre-registo e criar automaticamente um novo registo de paciente. O link sera copiavel a partir da tela de Pacientes.

## Como funciona

O link tera o formato: `/pre-registo/novo?c={clinic_id}`

- Ao abrir, mostra o mesmo formulario de pre-registo, mas completamente em branco
- Ao submeter, cria um novo paciente na tabela `pacientes` (em vez de atualizar um existente)
- A clinica e identificada pelo parametro `c` (clinic_id)

## Alteracoes

### 1. Edge Function `patient-onboarding/index.ts`

Adicionar suporte para o modo "novo":
- **GET** `?clinic_id=xxx` (sem token): Retorna apenas os dados da clinica (nome + logo), sem dados de utente
- **POST** `?clinic_id=xxx` (sem token): Cria um novo registo na tabela `pacientes` com os dados do formulario, associando ao `clinic_id`

A logica existente com `?token=xxx` continua a funcionar como antes.

### 2. Pagina `PreRegisto.tsx`

Adaptar para dois modos:
- **Modo edicao** (existente): URL `/pre-registo/:token` -- carrega e atualiza dados de um utente
- **Modo novo**: URL `/pre-registo/novo` com query param `?c=CLINIC_ID` -- formulario em branco, cria novo utente ao submeter

A rota `/pre-registo/novo` sera adicionada ao `App.tsx` apontando para o mesmo componente.

### 3. Pagina `Pacientes.tsx`

Adicionar um botao "Link Generico" (ou integrar na area existente) que copia para a area de transferencia o URL:
`{origin}/pre-registo/novo?c={clinic_id}`

Pode ser um botao simples junto ao "Enviar Link" existente, ou uma opcao adicional dentro do mesmo modal.

### 4. Rota em `App.tsx`

Adicionar rota publica: `/pre-registo/novo` apontando para `PreRegisto`

## Detalhes tecnicos

### Edge Function -- novo fluxo

```text
GET ?clinic_id=xxx (sem token)
  -> SELECT name, logo_url FROM clinics WHERE id = clinic_id
  -> Retorna { patient: null, clinic: { name, logo_url }, mode: "new" }

POST ?clinic_id=xxx (sem token)
  -> Valida dados (full_name obrigatorio, data_consent obrigatorio)
  -> INSERT INTO pacientes (...) VALUES (...) com clinic_id
  -> Retorna { success: true }
```

### PreRegisto.tsx -- logica de modo

```text
Se URL = /pre-registo/novo?c=xxx
  -> mode = "new", clinicId vem da query string
  -> GET edge function com ?clinic_id=xxx (carrega logo)
  -> POST edge function com ?clinic_id=xxx (cria utente)

Se URL = /pre-registo/:token
  -> mode = "edit" (comportamento atual)
```

### Botao na tela de Pacientes

Junto ao botao "Enviar Link", adicionar botao "Link Generico" com icone de copia. Ao clicar, copia o URL generico e mostra toast de confirmacao.

### Validacao de seguranca

- O clinic_id e um UUID, validado no edge function
- A criacao de pacientes via link generico e intencional (a clinica partilha o link conscientemente)
- Campos sensiveis continuam protegidos (apenas dados de formulario sao aceites)
- Telefone sera obrigatorio na criacao (consistente com a validacao existente do PatientService)

