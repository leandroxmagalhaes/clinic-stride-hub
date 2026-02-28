

# Plano: URL Amigavel com Slug e Identidade Visual

## Estado Atual
Nenhuma parte deste plano foi implementada. A tabela `clinics` nao tem coluna `slug`, o codigo nao suporta slugs, e os links continuam a usar UUIDs.

## Sequencia de Implementacao

### 1. Migration: Adicionar coluna `slug` a tabela `clinics`
```sql
ALTER TABLE clinics ADD COLUMN slug text UNIQUE;
UPDATE clinics SET slug = 'respira-desenvolve';
ALTER TABLE clinics ALTER COLUMN slug SET NOT NULL;
```

### 2. Edge Function `patient-onboarding/index.ts`
Adicionar suporte ao parametro `slug`:
- **GET com `?slug=X`**: buscar clinica por slug, retornar `{ clinic: { name, logo_url, primary_color }, clinic_id, mode: "new" }`
- **POST com `?slug=X`**: resolver slug para clinic_id, executar a mesma logica de criacao
- **GET/POST com `?clinic_id=X`**: manter compatibilidade, tambem retornar `primary_color`
- Buscar `primary_color` de `clinic_settings` pelo `clinic_id` resolvido

### 3. Nova rota `/r/:slug` no `App.tsx`
Adicionar rota publica que renderiza o componente `PreRegisto` (mesmo componente, rota diferente).

### 4. Atualizar `PreRegisto.tsx`
- Detetar se a rota e `/r/:slug` e usar slug para buscar clinica via edge function
- Expandir interface `ClinicInfo` com `primary_color` e `clinic_id`
- Header com logo (ou iniciais coloridas como fallback), nome da clinica, subtitulo
- Cor primaria aplicada ao botao de submit via `style`
- Footer discreto "Powered by Physione"
- Loading state com skeleton

### 5. Atualizar link em `Pacientes.tsx`
Trocar geracao do link de `/pre-registo/novo?c=${clinicId}` para `/r/${slug}`, buscando o slug da clinica.

## Ficheiros a editar

| Ficheiro | Acao |
|---|---|
| Migration SQL | Adicionar coluna `slug` |
| `supabase/functions/patient-onboarding/index.ts` | Aceitar `slug`, retornar `primary_color` |
| `src/App.tsx` | Adicionar rota `/r/:slug` |
| `src/pages/PreRegisto.tsx` | Suportar slug, identidade visual |
| `src/pages/Pacientes.tsx` | Gerar link com slug |

