// Webhook público da Ifthenpay. Confirma o pagamento e dispara faturação.
// URL pública: precisa de verify_jwt = false e da chave anti-phishing.
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTI_PHISHING_KEY = Deno.env.get("IFTHENPAY_ANTIPHISHING_KEY") ?? "";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const chave = url.searchParams.get("chave") ?? url.searchParams.get("key");
    const orderId = url.searchParams.get("orderId") ?? "";
    const reference = url.searchParams.get("referencia") ?? url.searchParams.get("reference") ?? "";
    const requestId = url.searchParams.get("requestId") ?? "";
    const amountStr = url.searchParams.get("valor") ?? url.searchParams.get("amount") ?? "";

    if (!ANTI_PHISHING_KEY || chave !== ANTI_PHISHING_KEY) {
      return new Response("forbidden", { status: 403 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = admin.from("payments").select("*").eq("status", "pendente").limit(1);
    if (requestId) query = query.eq("ifthenpay_request_id", requestId);
    else if (reference) query = query.eq("mb_reference", reference);
    else if (orderId) {
      // orderId é o id sem hífenes, primeiros 15 chars
      const { data: candidates } = await admin
        .from("payments")
        .select("*")
        .eq("status", "pendente");
      const match = (candidates ?? []).find(
        (p: any) => String(p.id).replace(/-/g, "").slice(0, 15) === orderId,
      );
      if (!match) return new Response("not found", { status: 404 });
      const payment = match;
      return await confirm(admin, payment, amountStr);
    } else {
      return new Response("missing identifier", { status: 400 });
    }

    const { data: payments, error } = await query;
    if (error) throw error;
    if (!payments?.length) return new Response("not found", { status: 404 });

    return await confirm(admin, payments[0], amountStr);
  } catch (e) {
    console.error("ifthenpay-callback error:", e);
    return new Response("error", { status: 500 });
  }
});

async function confirm(admin: ReturnType<typeof createClient>, payment: any, amountStr: string) {
  if (amountStr && Math.abs(parseFloat(amountStr) - parseFloat(payment.amount)) > 0.01) {
    console.error(`amount mismatch: esperado ${payment.amount}, recebido ${amountStr}`);
    return new Response("amount mismatch", { status: 400 });
  }

  const { error: updErr } = await admin
    .from("payments")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("status", "pendente");
  if (updErr) {
    console.error(updErr);
    return new Response("error", { status: 500 });
  }

  admin.functions
    .invoke("issue-toconline-invoice", { body: { payment_id: payment.id } })
    .catch((e) => console.error("issue-toconline-invoice falhou:", e));

  return new Response("ok", { status: 200 });
}
