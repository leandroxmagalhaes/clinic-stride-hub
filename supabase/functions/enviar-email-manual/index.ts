import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated caller
  let userId: string | null = null;
  {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _authClient = (await import("https://esm.sh/@supabase/supabase-js@2.49.1")).createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: _u, error: _e } = await _authClient.auth.getUser(authHeader.slice(7));
    if (_e || !_u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = _u.user.id;
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const pacienteId = typeof body?.pacienteId === "string" ? body.pacienteId.trim() : "";
    const assunto = typeof body?.assunto === "string" ? body.assunto.trim() : "";
    const corpo = typeof body?.corpo === "string" ? body.corpo.trim() : "";

    if (!pacienteId || !assunto || !corpo) {
      throw new Error("Campos obrigatórios em falta: pacienteId, assunto e corpo.");
    }
    if (assunto.length < 3 || assunto.length > 200) {
      throw new Error("O assunto deve ter entre 3 e 200 caracteres.");
    }
    if (corpo.length < 10) {
      throw new Error("O corpo da mensagem deve ter pelo menos 10 caracteres.");
    }

    const { data: patient } = await supabase
      .from("pacientes")
      .select("full_name, email, clinic_id")
      .eq("id", pacienteId)
      .maybeSingle();

    if (!patient) throw new Error("Utente nao encontrado");
    if (!patient.email) throw new Error("Este utente nao tem email registado");

    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", patient.clinic_id)
      .maybeSingle();
    const clinicName = clinic?.name || "Clínica";

    const corpoHtml = escapeHtml(corpo).replace(/\n/g, "<br/>");

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #10B981; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">${escapeHtml(clinicName)}</h1>
  </div>
  <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="line-height: 1.6;">${corpoHtml}</div>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
    ${escapeHtml(clinicName)}
  </p>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${clinicName} <noreply@respiraedesenvolve.com>`,
        to: [patient.email],
        subject: assunto,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      const errorMsg = resendData?.message || JSON.stringify(resendData);
      await supabase.from("comunicacoes").insert({
        clinic_id: patient.clinic_id,
        paciente_id: pacienteId,
        canal: "email",
        tipo: "manual",
        origem: "ficha_utente",
        assunto,
        destinatario: patient.email,
        estado: "erro",
        erro: errorMsg,
        enviado_em: new Date().toISOString(),
        provider: "resend",
        disparado_por: userId,
      });
      throw new Error(`Falha no envio: ${errorMsg}`);
    }

    await supabase.from("comunicacoes").insert({
      clinic_id: patient.clinic_id,
      paciente_id: pacienteId,
      canal: "email",
      tipo: "manual",
      origem: "ficha_utente",
      assunto,
      destinatario: patient.email,
      estado: "enviado",
      enviado_em: new Date().toISOString(),
      provider: "resend",
      provider_id: resendData?.id || null,
      disparado_por: userId,
    });

    return new Response(JSON.stringify({ success: true, emailId: resendData?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in enviar-email-manual:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : (error as any)?.message || String(error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
