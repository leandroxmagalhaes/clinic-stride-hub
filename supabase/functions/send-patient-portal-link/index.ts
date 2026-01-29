import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PortalLinkRequest {
  patientEmail: string;
  patientName: string;
  portalUrl: string;
  clinicName: string;
  clinicPhone?: string;
  clinicEmail?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const body: PortalLinkRequest = await req.json();
    const {
      patientEmail,
      patientName,
      portalUrl,
      clinicName,
      clinicPhone,
      clinicEmail,
    } = body;

    // Validate required fields
    if (!patientEmail || !patientName || !portalUrl) {
      throw new Error("Missing required fields: patientEmail, patientName, portalUrl");
    }

    console.log(`Sending portal link to ${patientEmail}`);

    const emailHtml = `
<!DOCTYPE html>
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
              <h1 style="margin: 0; color: #6366f1; font-size: 24px;">🏥 Portal do Paciente</h1>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 30px 0 20px;">
              <p style="margin: 0; color: #3f3f46; font-size: 16px;">
                Olá <strong>${patientName}</strong>,
              </p>
              <p style="margin: 16px 0 0; color: #71717a; font-size: 14px;">
                Agora você tem acesso ao Portal do Paciente da <strong>${clinicName || "nossa clínica"}</strong>!
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eef2ff; border-radius: 8px; margin-bottom: 20px; border: 1px solid #c7d2fe;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 16px; color: #3730a3; font-size: 14px; font-weight: 600;">
                No portal você pode:
              </p>
              <ul style="margin: 0; padding-left: 20px; color: #4338ca; font-size: 14px;">
                <li style="margin-bottom: 8px;">📝 Registar o seu diário de atividades</li>
                <li style="margin-bottom: 8px;">📊 Acompanhar o seu progresso</li>
                <li style="margin-bottom: 8px;">📅 Ver os seus próximos agendamentos</li>
                <li>💬 Comunicar com a equipa clínica</li>
              </ul>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center; padding: 20px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Aceder ao Portal
              </a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="margin: 8px 0 0; color: #6366f1; font-size: 12px; word-break: break-all;">
                ${portalUrl}
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-top: 30px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0 0 8px; color: #18181b; font-size: 16px; font-weight: 600;">${clinicName || "Clínica"}</p>
              ${clinicPhone ? `<p style="margin: 0 0 4px; color: #71717a; font-size: 14px;">📞 ${clinicPhone}</p>` : ""}
              ${clinicEmail ? `<p style="margin: 0; color: #71717a; font-size: 14px;">✉️ ${clinicEmail}</p>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${clinicName || "Clínica"} <onboarding@resend.dev>`,
      to: [patientEmail],
      subject: `Acesso ao Portal do Paciente - ${clinicName || "Clínica"}`,
      html: emailHtml,
    });

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
