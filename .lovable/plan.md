

# Create Anthropic Proxy Edge Function

## Overview
Create `supabase/functions/anthropic-proxy/index.ts` with the provided code, and add its config entry.

## Prerequisite: ANTHROPIC_API_KEY
The function requires an `ANTHROPIC_API_KEY` secret which is not currently configured. After creating the function, I will prompt you to securely add this key.

**Note:** This project already has Lovable AI configured with supported models (Gemini, GPT-5). If your use case can be served by those models, no additional API key is needed. If you specifically need Anthropic/Claude, we will proceed as requested.

## Changes

### 1. Create `supabase/functions/anthropic-proxy/index.ts`
Exactly the code you provided — proxies requests to `https://api.anthropic.com/v1/messages` using the `ANTHROPIC_API_KEY` secret.

### 2. Add config entry to `supabase/config.toml`
```toml
[functions.anthropic-proxy]
verify_jwt = false
```

### 3. Request `ANTHROPIC_API_KEY` secret
Use the secrets tool to prompt you to enter the key.

No other files modified.

