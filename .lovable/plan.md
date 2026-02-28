

# Plano: URL Amigavel com Slug e Identidade Visual

## Estado Atual
✅ **IMPLEMENTADO** — Todas as partes do plano foram implementadas.

## O que foi feito

### 1. ✅ Migration: Coluna `slug` adicionada a `clinics`
- Coluna `slug` (text, unique, not null) adicionada
- Clínica existente populada com `'respira-desenvolve'`

### 2. ✅ Edge Function `patient-onboarding/index.ts`
- Aceita parâmetro `slug` para resolver clinic_id
- Retorna `primary_color` da `clinic_settings`
- Mantém compatibilidade com `clinic_id` e `token`

### 3. ✅ Nova rota `/r/:slug` no `App.tsx`
- Rota pública adicionada

### 4. ✅ `PreRegisto.tsx` atualizado
- Suporta slug, identidade visual completa
- Header com logo/iniciais, nome, subtítulo
- Cor primária nos botões e ícones
- Footer "Powered by Physione"
- Loading skeleton

### 5. ✅ Link genérico em `Pacientes.tsx`
- Gera link com slug (`/r/respira-desenvolve`)
