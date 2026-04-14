

## Configurar Google OAuth via Lovable Cloud

Three steps, no other changes.

### Step 1: Run "Configure Social Auth" tool for Google
Generate `src/integrations/lovable/` module using the built-in tool. This creates the managed OAuth client that handles Google sign-in through Lovable Cloud without custom credentials.

### Step 2: Update `src/pages/PortalLogin.tsx`
Replace lines 75-84:
```typescript
const handleGoogleLogin = async () => {
  setIsLoading(true);
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin + "/portal/login",
  });
  if (result.error) {
    setIsLoading(false);
    toast.error("Erro ao iniciar login com Google");
    return;
  }
  if (result.redirected) return;
  // Session set automatically — check portal account
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await checkPortalAccount(session.user.id);
  setIsLoading(false);
};
```
Add import: `import { lovable } from "@/integrations/lovable/index";`

### Step 3: Update `src/pages/PortalVerificacao.tsx`
Replace lines 216-225:
```typescript
const handleGoogleSignIn = async () => {
  if (!invite) return;
  localStorage.setItem("portal_paciente_id", invite.paciente_id);
  localStorage.setItem("portal_google_pending", "true");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin + "/portal/onboarding",
  });
  if (result.error) {
    toast.error("Erro ao iniciar login com Google");
  }
};
```
Add import: `import { lovable } from "@/integrations/lovable/index";`

### What stays untouched
Everything else — no other files modified.

