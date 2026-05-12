import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") throw new Error("email obrigatório");
    const cleanEmail = email.trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Procurar paciente pelo email (case-insensitive)
    const { data: patients } = await admin
      .from("pacientes")
      .select("id, full_name, email")
      .ilike("email", cleanEmail)
      .limit(1);

    const patient = patients?.[0];

    // Resposta neutra para não revelar existência (anti-enumeração)
    if (!patient) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Invalidar convites antigos (não usados)
    await admin
      .from("portal_convites")
      .update({ utilizado: true })
      .eq("paciente_id", patient.id)
      .eq("utilizado", false);

    // 3) Gerar novo magic link via função existente
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-portal-magic-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ paciente_id: patient.id, email: patient.email || cleanEmail }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("generate-portal-magic-link failed:", txt);
      throw new Error("Não foi possível gerar novo link");
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("request-new-portal-link error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
