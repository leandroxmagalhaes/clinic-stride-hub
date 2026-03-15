

## Add debug logs for professional lookup

**File: `supabase/functions/send-automation-email/index.ts`**

In the block that fetches the professional (around line 93-98), capture the error from the query and add a `console.log` for both the result and error:

```typescript
const { data: prof, error: profError } = await supabase
  .from("profissionais")
  .select("full_name")
  .eq("id", session.profissional_id)
  .single();
console.log('DEBUG prof result:', JSON.stringify(prof), 'error:', profError?.message);
```

Similarly for the service lookup (around line 100-105):

```typescript
const { data: serv, error: servError } = await supabase
  .from("servicos")
  .select("name")
  .eq("id", session.servico_id)
  .single();
console.log('DEBUG serv result:', JSON.stringify(serv), 'error:', servError?.message);
```

Then deploy the edge function.

