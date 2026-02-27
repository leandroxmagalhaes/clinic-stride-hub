
# Plano: URL Amigavel com Slug e Identidade Visual na Pagina Publica

## 1. Migration: Adicionar coluna `slug` a tabela `clinics`

```sql
ALTER TABLE clinics ADD COLUMN slug text UNIQUE;
UPDATE clinics SET slug = 'respira-desenvolve';
ALTER TABLE clinics ALTER COLUMN slug SET NOT NULL;
```

## 2. Edge Function: Suportar slug como parametro

No `patient-onboarding/index.ts`, alem de `clinic_id` e `token`, aceitar um novo parametro `slug`:

- GET com `?slug=respira-desenvolve`: buscar clinica por slug, retornar `{ clinic, clinic_id, mode: "new" }` incluindo `primary_color` da `clinic_settings`
- POST com `?slug=respira-desenvolve`: resolver slug para clinic_id internamente e executar a mesma logica de criacao de paciente
- GET com `?clinic_id=...`: manter compatibilidade, retornar tambem `primary_color`
- Incluir `primary_color` na resposta buscando de `clinic_settings` pelo clinic_id

## 3. Nova rota `/r/:slug` no App.tsx

Adicionar rota publica `/r/:slug` que renderiza o mesmo componente `PreRegisto`.

## 4. Atualizar `PreRegisto.tsx`

### Detetar modo por rota
- Se a rota e `/r/:slug`, usar o parametro `slug` para buscar a clinica via edge function com `?slug=...`
- Se a rota e `/pre-registo/novo?c=UUID`, redirecionar para `/r/:slug` (buscar slug primeiro, depois redirect)
- Se a rota e `/pre-registo/:token` (UUID), manter comportamento atual (modo edicao)

### Interface `ClinicInfo` expandida
```typescript
interface ClinicInfo {
  name: string;
  logo_url: string;
  primary_color: string;
  clinic_id: string; // necessario para o POST
}
```

### Identidade visual
- Header: logo da clinica (ou iniciais em circulo colorido como fallback), nome da clinica, subtitulo
- Cor primaria aplicada ao botao de submit e elementos de destaque via `style={{ backgroundColor: clinic.primary_color }}`
- Footer discreto: "Powered by Physione"
- Loading state com skeleton enquanto busca dados da clinica

## 5. Atualizar link de partilha em `Pacientes.tsx`

Trocar a geracao do link generico de:
```
/pre-registo/novo?c=${clinicId}
```
Para:
```
/r/${clinicSlug}
```

Buscar o slug da clinica a partir dos dados ja disponiveis ou da tabela `clinics`.

## Ficheiros a editar

| Ficheiro | Acao |
|---|---|
| Migration SQL | Adicionar coluna `slug` a `clinics` |
| `supabase/functions/patient-onboarding/index.ts` | Aceitar `slug`, retornar `primary_color` e `clinic_id` |
| `src/App.tsx` | Adicionar rota `/r/:slug` |
| `src/pages/PreRegisto.tsx` | Suportar slug, identidade visual, redirect, footer |
| `src/pages/Pacientes.tsx` | Gerar link com slug em vez de UUID |

## Detalhes tecnicos

- A coluna `slug` e `text UNIQUE NOT NULL` -- cada clinica tem um slug unico
- O slug e usado apenas na URL publica; internamente tudo continua a usar UUID
- A Edge Function resolve slug para clinic_id com uma query simples: `select id from clinics where slug = $1`
- A cor primaria vem de `clinic_settings.primary_color` (ja existe na tabela)
- Nenhuma logica de submissao ou notificacao e alterada
