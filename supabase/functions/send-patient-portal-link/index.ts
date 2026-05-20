import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PortalLinkRequest {
  to: string;
  patientName: string;
  subject?: string;
  includeCode?: string;
  type?: "invite" | "ready" | "access";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }


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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body: PortalLinkRequest = await req.json();
    const { to, patientName, subject, includeCode, type = "access" } = body;

    if (!to || !patientName) {
      throw new Error("Missing required fields: to, patientName");
    }

    console.log(`Sending portal link to ${to} (type: ${type})`);

    const portalUrl = "https://physione.app/portal/login";

    const codeSection = includeCode
      ? `<tr><td style="padding: 16px 0; text-align: center;">
           <p style="margin: 0 0 8px; color: #71717a; font-size: 14px;">O seu código de verificação:</p>
           <p style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #1e40af; font-family: monospace;">${includeCode}</p>
         </td></tr>`
      : "";

    const mainText = type === "ready"
      ? "O seu perfil no Portal do Paciente foi completado com sucesso! 🎉<br/>Guarde este link para aceder ao diário e acompanhar o tratamento a qualquer momento:"
      : "O seu acesso ao Portal do Paciente está activo.<br/>Use o botão abaixo para aceder ao diário e acompanhar o tratamento:";

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; color: #1e40af; font-size: 24px;">Physione</h1>
              <p style="margin: 4px 0 0; color: #71717a; font-size: 13px;">Portal do Paciente</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 0 20px;">
              <p style="margin: 0; color: #3f3f46; font-size: 16px;">
                Olá <strong>${patientName}</strong>,
              </p>
              <p style="margin: 16px 0 0; color: #71717a; font-size: 14px;">
                ${mainText}
              </p>
            </td>
          </tr>
          ${codeSection}
          <tr>
            <td style="text-align: center; padding: 20px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Aceder ao Portal
              </a>
            </td>
          </tr>
          ${type === "ready" ? `<tr><td style="padding: 16px 0;">
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #1e40af; font-size: 13px;">Pode aceder sempre que quiser para:</p>
              <ul style="margin: 8px 0 0; padding-left: 20px; color: #3b82f6; font-size: 13px;">
                <li>Escrever no diário como está o dia a dia</li>
                <li>Ver respostas da fisioterapeuta</li>
                <li>Atualizar os seus dados de saúde</li>
              </ul>
            </div>
          </td></tr>` : ""}
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="margin: 8px 0 0; color: #1e40af; font-size: 12px; word-break: break-all;">
                ${portalUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 30px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0 0 4px; color: #18181b; font-size: 14px; font-weight: 600;">Respira & Desenvolve</p>
              <p style="margin: 0; color: #71717a; font-size: 12px;">Fisioterapia Neonatal e Pediátrica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Physione <noreply@respiraedesenvolve.com>",
        to: [to],
        subject: subject || "Physione — Acesso ao Portal do Paciente",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend error: ${errText}`);
    }

    const emailResponse = await res.json();
    console.log("Portal link email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error sending portal link email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
