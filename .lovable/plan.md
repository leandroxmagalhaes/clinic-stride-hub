

# Modulo de Auto-Cadastro do Paciente (Onboarding Digital)

## Resumo

Criacao de um sistema completo de pre-registo publico para utentes. Um link unico e gerado automaticamente para cada utente, permitindo que preencha/atualize os seus dados pessoais, de saude e de faturacao antes da consulta -- sem necessidade de login.

## Etapa 1 -- Atualizacao da Base de Dados

Adicionar as seguintes colunas a tabela `pacientes` (que ja contem `full_name`, `birth_date`, `gender`, `phone`, `email`, `address`, `emergency_contact`, `emergency_phone`, `cpf`/NIF):

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| nif | text | Numero de Identificacao Fiscal (reutiliza `cpf` existente OU nova coluna dedicada) |
| height_cm | integer | Altura em cm |
| weight_kg | numeric | Peso em kg |
| billing_name | text | Nome para faturacao |
| billing_nif | text | NIF para faturacao |
| billing_address | jsonb | Morada fiscal (rua, numero, andar, codigo_postal, localidade) |
| image_consent | boolean | Consentimento de imagem (default false) |
| data_consent | boolean | Consentimento de dados (default false) |
| public_token | uuid | Token unico para acesso publico (unique, not null, default gen_random_uuid) |
| onboarding_completed_at | timestamptz | Data em que o utente completou o formulario |

**Nota**: Os campos `emergency_contact` e `emergency_phone` ja existem na tabela. O campo `cpf` existente sera reutilizado como NIF (ja e texto generico). O campo `gender` tambem ja existe.

### Trigger automatico

Criar uma funcao + trigger para gerar `public_token` automaticamente em INSERT, caso o valor seja NULL. Isso garante que utentes ja existentes recebam o token via UPDATE e novos utentes recebam automaticamente.

### Politica RLS para acesso publico

Criar uma politica SELECT e UPDATE na tabela `pacientes` que permita acesso anonimo quando o `public_token` corresponder -- restrito apenas aos campos do formulario.

Uma edge function sera usada em vez de acesso direto anon para maior seguranca.

## Etapa 2 -- Edge Function de Backend

Criar uma edge function `patient-onboarding` com dois endpoints:

- **GET** `?token=xxx`: Retorna os dados do utente (campos do formulario apenas) -- sem necessidade de autenticacao.
- **POST** `?token=xxx`: Atualiza os dados do utente com os valores do formulario -- sem necessidade de autenticacao.

A edge function usa o `SUPABASE_SERVICE_ROLE_KEY` para contornar RLS de forma segura, validando apenas pelo `public_token`.

## Etapa 3 -- Pagina Publica `/pre-registo/:token`

### Layout
- Sem sidebar, sem menu do sistema
- Fundo branco, mobile-first
- Logo da clinica no topo (carregada via edge function junto com os dados)
- Formulario em secoes Accordion

### Secoes do Formulario

**1. Dados Pessoais**
- Nome Completo
- Data de Nascimento (date picker)
- Genero (Masculino / Feminino / Outro)
- NIF (validacao: apenas numerico, 9 digitos)
- Altura (cm) e Peso (kg)

**2. Contactos**
- Telemovel (pre-preenchido se existir)
- Email (pre-preenchido se existir)
- Contacto de Emergencia -- Nome
- Contacto de Emergencia -- Telefone

**3. Dados de Faturacao**
- Botao "Replicar dados cadastrais" (copia Nome para Nome Fatura e NIF para NIF Fatura)
- Nome na Fatura
- NIF da Fatura
- Morada Completa: Rua, Numero, Andar, Codigo Postal, Localidade

**4. Consentimentos**
- [ ] Autorizo o uso da minha imagem para fins de divulgacao da clinica
- [x] Declaro que estou de acordo com o armazenamento e tratamento dos meus dados pessoais (obrigatorio)

### Botao Final
"Atualizar Ficha" -- ao submeter com sucesso:
- Animacao de sucesso (checkmark)
- Formulario fica bloqueado/desativado
- Mensagem: "Os seus dados foram atualizados com sucesso!"

## Ficheiros a Criar/Alterar

| Ficheiro | Acao | Descricao |
|----------|------|-----------|
| Migracao SQL | Criar | Novas colunas + trigger para public_token + update dos registos existentes |
| `supabase/functions/patient-onboarding/index.ts` | Criar | Edge function para GET/POST dados do utente via token |
| `src/pages/PreRegisto.tsx` | Criar | Pagina publica do formulario de onboarding |
| `src/App.tsx` | Editar | Adicionar rota publica `/pre-registo/:token` |

## Detalhes Tecnicos

### Migracao SQL

```text
1. ALTER TABLE pacientes ADD COLUMN height_cm, weight_kg, billing_name, billing_nif, billing_address, image_consent, data_consent, public_token, onboarding_completed_at
2. CREATE FUNCTION generate_patient_public_token() -- trigger BEFORE INSERT
3. UPDATE pacientes SET public_token = gen_random_uuid() WHERE public_token IS NULL
4. CREATE UNIQUE INDEX on pacientes(public_token)
```

### Edge Function (patient-onboarding)

```text
GET ?token=xxx
  -> SELECT campos do formulario FROM pacientes WHERE public_token = token
  -> Inclui logo_url e nome da clinica (JOIN com clinics)

POST ?token=xxx
  -> Valida dados recebidos
  -> UPDATE pacientes SET ... WHERE public_token = token
  -> SET onboarding_completed_at = now()
```

### Fluxo do Utilizador

```text
1. Clinica cria utente no sistema -> public_token gerado automaticamente
2. Clinica copia link: /pre-registo/{public_token}
3. Utente abre link no telemovel
4. Preenche formulario (4 secoes)
5. Clica "Atualizar Ficha"
6. Dados salvos via edge function
7. Formulario bloqueado com mensagem de sucesso
```

