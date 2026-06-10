// STUB de faturação TOConline. Por agora apenas marca invoice_issued=true
// para fechar o fluxo. Será substituído pela integração real depois.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({ payment_id: z.string().uuid() });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ ok: false, error: parsed.error.flatten().fieldErrors }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error } = await admin
      .from("payments")
      .select("id, status, invoice_issued")
      .eq("id", parsed.data.payment_id)
      .maybeSingle();
    if (error || !payment) return json({ ok: false, error: "Pagamento não encontrado" }, 404);

    if (payment.status !== "pago") {
      return json({ ok: false, error: "Pagamento ainda não está pago" }, 409);
    }
    if (payment.invoice_issued) {
      return json({ ok: true, skipped: true });
    }

    // TODO: chamar TOConline real aqui (placeholder).
    const stubInvoiceId = `STUB-${Date.now()}`;
    const { error: updErr } = await admin
      .from("payments")
      .update({ invoice_issued: true, toconline_invoice_id: stubInvoiceId })
      .eq("id", payment.id);
    if (updErr) throw updErr;

    return json({ ok: true, invoice_id: stubInvoiceId, stub: true });
  } catch (e) {
    console.error("issue-toconline-invoice error:", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
