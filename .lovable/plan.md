

# Create `relatorio-respiratorio-ai` edge function and fix fetch URL

## Changes

### 1. Create `supabase/functions/relatorio-respiratorio-ai/index.ts`
Copy the exact same content from `supabase/functions/ai-respiratory-report/index.ts` (the existing edge function with Lovable AI / Gemini integration, system prompt, and tool calling). The user's instruction says "document 5" but that document wasn't provided — the existing `ai-respiratory-report/index.ts` content is the correct implementation.

### 2. Update fetch URL in `src/pages/RelatorioRespiratorio.tsx` (line 374)
Change the encoded URL from:
```
${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relat%C3%B3rio-respirat%C3%B3rio-ai
```
to:
```
${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relatorio-respiratorio-ai
```

### 3. Add config entry to `supabase/config.toml`
```toml
[functions.relatorio-respiratorio-ai]
verify_jwt = false
```

This ensures the new function is deployed and the frontend calls the correct endpoint.

