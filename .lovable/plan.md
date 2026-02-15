
# Corrigir Links de Utentes Apontando para Dominio Errado

## Problema

Quando se copia o "Link Generico" ou o "Link de Pre-Registo" individual, o sistema usa `window.location.origin` para construir o URL. Se o profissional esta a usar a aplicacao pelo editor ou preview do Lovable, o link gerado aponta para `lovable.dev` -- que e a plataforma de desenvolvimento, nao a aplicacao publicada. Utentes que abrem esse link veem a pagina de login do Lovable em vez do formulario de pre-registo.

## Solucao

Criar uma funcao utilitaria `getPublicBaseUrl()` que retorna sempre o dominio correto da aplicacao publicada, e substituir todos os `window.location.origin` que geram links publicos (para utentes, portal, convites).

## Ficheiros a modificar

### 1. `src/lib/utils.ts` - Adicionar funcao `getPublicBaseUrl()`

Adicionar a seguinte funcao:

```text
getPublicBaseUrl():
  - Se o hostname atual contem "lovable.dev" ou "lovable.app" com prefixo "id-preview--",
    extrair o slug e retornar o URL publicado (https://{slug}.lovable.app)
  - Caso contrario (dominio customizado ou producao), usar window.location.origin normalmente
```

Isto garante que mesmo no editor/preview, os links gerados apontam para a versao publicada.

### 2. `src/pages/Pacientes.tsx` - Link Generico

Linha 287: Substituir `window.location.origin` por `getPublicBaseUrl()` na geracao do link generico.

### 3. `src/components/patients/SendOnboardingLinkModal.tsx` - Link Individual

Linha 28-29: Substituir `window.location.origin` por `getPublicBaseUrl()` na funcao `buildLink`.

### 4. `src/components/patients/PatientDetailModal.tsx` - Link Portal

Linha 84: Substituir `window.location.origin` por `getPublicBaseUrl()` no URL do portal do paciente.

### 5. `src/services/AutomationEngine.ts` - URL base de automacao

Linha 25: Substituir `window.location.origin` por `getPublicBaseUrl()`.

### 6. `src/services/TeamService.ts` - Convites de equipa

Linhas 238 e 257: Substituir `window.location.origin` por `getPublicBaseUrl()` nos URLs de convite.

## Ficheiros que NAO serao tocados

- `src/contexts/AuthContext.tsx` e `src/hooks/useAuth.tsx` - O `emailRedirectTo` de autenticacao deve continuar a usar `window.location.origin` pois o redirect precisa voltar ao mesmo dominio onde o utilizador esta.
- `src/contexts/DataContext.tsx`

## Detalhes Tecnicos

A funcao `getPublicBaseUrl()` em `src/lib/utils.ts`:

```typescript
export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://clinic-stride-hub.lovable.app';
  }
  const host = window.location.hostname;
  // Preview URL pattern: id-preview--{slug}.lovable.app
  const previewMatch = host.match(/^id-preview--(.+)\.lovable\.app$/);
  if (previewMatch) {
    return `https://${previewMatch[1]}.lovable.app`;
  }
  // Editor: lovable.dev
  if (host.includes('lovable.dev')) {
    return 'https://clinic-stride-hub.lovable.app';
  }
  // Production or custom domain
  return window.location.origin;
}
```

## Resultado Esperado

- Links de pre-registo apontam sempre para o dominio publicado da aplicacao
- Utentes que recebem o link veem o formulario de pre-registo, nao o login do Lovable
- Funciona independentemente de onde o profissional esta a aceder (editor, preview ou producao)
