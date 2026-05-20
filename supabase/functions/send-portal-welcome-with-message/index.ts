import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const byte of arr) result += chars[byte % chars.length];
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require authenticated caller
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
  }

  try {
    const body = await req.json();
    const {
      paciente_id,
      email,
      welcome_text,
      message_text,
      professional_name,
    } = body || {};

    if (!paciente_id) throw new Error("paciente_id é obrigatório");
    if (!email) throw new Error("email é obrigatório");
    if (!welcome_text || !message_text) throw new Error("welcome_text e message_text são obrigatórios");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Generate magic link (7d)
    const link_token = generateToken(32);
    const expira_em = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("portal_convites").insert({
      paciente_id,
      codigo: "000000",
      link_token,
      enviado_para_email: email,
      expira_em,
      tipo: "magic_link",
      max_tentativas: 1,
    });
    if (insertError) throw insertError;

    const { data: patient } = await supabase
      .from("pacientes")
      .select("full_name, clinic_id")
      .eq("id", paciente_id)
      .single();

    let clinicName = "Clínica";
    let clinicAddress = "";
    if (patient?.clinic_id) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name, address")
        .eq("id", patient.clinic_id)
        .single();
      if (clinic?.name) clinicName = clinic.name;
      if (clinic?.address) clinicAddress = clinic.address;
    }

    const baseUrl = "https://physione.app";
    const magicLink = `${baseUrl}/portal/ativar/${link_token}`;
    const firstName = patient?.full_name?.split(" ")[0] || "Utente";
    const profName = professional_name || "a sua fisioterapeuta";

    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nl2br = (s: string) => escape(s).replace(/\n/g, "<br>");

    if (resendKey) {
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc;">
          <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <h2 style="color:#1e40af;margin:0 0 16px;font-size:22px;">Olá ${escape(firstName)}!</h2>
            <p style="color:#475569;line-height:1.6;font-size:15px;">${nl2br(welcome_text)}</p>

            <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;margin:24px 0;border-radius:8px;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;font-weight:600;letter-spacing:0.5px;">
                MENSAGEM DE ${escape(profName).toUpperCase()}
              </p>
              <p style="margin:0;color:#0f172a;font-size:15px;line-height:1.5;">${nl2br(message_text)}</p>
            </div>

            <div style="text-align:center;margin:32px 0;">
              <a href="${magicLink}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                Aceder ao Portal de Acompanhamento
              </a>
            </div>

            <p style="font-size:12px;color:#94a3b8;">Este link é pessoal e expira em 7 dias. Se não foi você que solicitou, ignore este email.</p>
            <p style="color:#3b82f6;font-size:12px;word-break:break-all;">${magicLink}</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="color:#64748b;font-size:13px;margin:0;">
              ${escape(clinicName)}${clinicAddress ? `<br>${escape(clinicAddress)}` : ""}
            </p>
          </div>
        </div>
      `;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${clinicName} <noreply@respiraedesenvolve.com>`,
          to: [email],
          subject: `Mensagem de ${profName} — Portal de Acompanhamento`,
          html,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error("Resend error:", txt);
      }
    }

    return new Response(JSON.stringify({ success: true, link: magicLink, expira_em }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-portal-welcome-with-message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
