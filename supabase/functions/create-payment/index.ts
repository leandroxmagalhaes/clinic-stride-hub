// Cria/atualiza um pagamento para uma sessão. Suporta MB Way, Multibanco,
// dinheiro e transferência. Para dinheiro/transferência marca como pago e
// invoca o stub de faturação TOConline.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const IFTHENPAY_MBWAY_KEY = Deno.env.get("IFTHENPAY_MBWAY_KEY") ?? "";
const IFTHENPAY_MB_KEY = Deno.env.get("IFTHENPAY_MB_KEY") ?? "";

const BodySchema = z.object({
  session_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  method: z.enum(["mbway", "multibanco", "dinheiro", "transferencia"]),
  phone: z.string().min(6).max(20).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ ok: false, error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ ok: false, error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { session_id, patient_id, amount, method, phone } = parsed.data;

    if (method === "mbway" && !phone) {
      return json({ ok: false, error: "phone obrigatório para MB Way" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve clinic_id da sessão
    const { data: sess, error: sessErr } = await admin
      .from("sessoes")
      .select("clinic_id")
      .eq("id", session_id)
      .maybeSingle();
    if (sessErr || !sess) return json({ ok: false, error: "Sessão não encontrada" }, 404);

    // Upsert idempotente por session_id
    const { data: payment, error: upsertErr } = await admin
      .from("payments")
      .upsert(
        {
          session_id,
          patient_id,
          clinic_id: sess.clinic_id,
          amount,
          method,
          status: "pendente",
        },
        { onConflict: "session_id" },
      )
      .select()
      .single();
    if (upsertErr || !payment) throw upsertErr ?? new Error("Falha ao registar pagamento");

    const orderId = String(payment.id).replace(/-/g, "").slice(0, 15);

    // === MB Way ===
    if (method === "mbway") {
      if (!IFTHENPAY_MBWAY_KEY) {
        return json({ ok: false, error: "IFTHENPAY_MBWAY_KEY não configurada" }, 500);
      }
      const res = await fetch("https://api.ifthenpay.com/spg/payment/mbway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mbWayKey: IFTHENPAY_MBWAY_KEY,
          orderId,
          amount: amount.toFixed(2),
          mobileNumber: phone,
          description: "Sessão Fisioterapia",
        }),
      });
      const data = await res.json();
      if (data.Status !== "000") {
        throw new Error(`Ifthenpay MB Way: ${data.Message ?? data.Status}`);
      }
      await admin
        .from("payments")
        .update({
          ifthenpay_request_id: data.RequestId,
          mbway_phone: phone,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", payment.id);

      return json({ ok: true, payment_id: payment.id, request_id: data.RequestId });
    }

    // === Multibanco ===
    if (method === "multibanco") {
      if (!IFTHENPAY_MB_KEY) {
        return json({ ok: false, error: "IFTHENPAY_MB_KEY não configurada" }, 500);
      }
      const res = await fetch("https://api.ifthenpay.com/multibanco/reference/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mbKey: IFTHENPAY_MB_KEY,
          orderId,
          amount: amount.toFixed(2),
          description: "Sessão Fisioterapia",
          expiryDays: 3,
        }),
      });
      const data = await res.json();
      if (data.Status !== "0") {
        throw new Error(`Ifthenpay MB: ${data.Message ?? data.Status}`);
      }
      await admin
        .from("payments")
        .update({
          mb_entity: data.Entity,
          mb_reference: data.Reference,
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", payment.id);

      return json({
        ok: true,
        payment_id: payment.id,
        entity: data.Entity,
        reference: data.Reference,
        amount: amount.toFixed(2),
      });
    }

    // === Dinheiro / Transferência ===
    await admin
      .from("payments")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", payment.id);

    // Fire-and-forget (não bloqueia resposta se falhar)
    admin.functions
      .invoke("issue-toconline-invoice", { body: { payment_id: payment.id } })
      .catch((e) => console.error("issue-toconline-invoice falhou:", e));

    return json({ ok: true, payment_id: payment.id, status: "pago" });
  } catch (e) {
    console.error("create-payment error:", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 400);
  }
});
