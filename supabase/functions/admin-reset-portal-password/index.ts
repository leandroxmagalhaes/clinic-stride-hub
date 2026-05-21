import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  paciente_id: string;
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Server-side admin check
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.paciente_id || !body?.email) {
      return new Response(JSON.stringify({ error: "Parâmetros em falta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller's clinic + profile (for audit)
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("clinic_id, full_name, email")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!callerProfile?.clinic_id) {
      return new Response(JSON.stringify({ error: "Clínica não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify patient belongs to caller's clinic
    const { data: paciente } = await admin
      .from("pacientes")
      .select("id, clinic_id, full_name")
      .eq("id", body.paciente_id)
      .maybeSingle();

    if (!paciente || paciente.clinic_id !== callerProfile.clinic_id) {
      return new Response(JSON.stringify({ error: "Utente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/$/, "") ||
      "https://physione.app";
    const redirectTo = `${origin}/portal/reset-password`;

    // Use admin generateLink for password recovery
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit (individual insert)
    await admin.from("portal_seguranca_auditoria").insert({
      clinic_id: callerProfile.clinic_id,
      paciente_id: body.paciente_id,
      accao: "reset_senha_solicitado",
      detalhes: { email, sent_by_email: true },
      realizado_por: callerId,
      realizado_por_nome: callerProfile.full_name || null,
      realizado_por_email: callerProfile.email || null,
    });

    return new Response(
      JSON.stringify({ success: true, email, action_link: linkData?.properties?.action_link || null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
